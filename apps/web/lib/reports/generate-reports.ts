import * as XLSX from "xlsx";
import type { ParsedFiles, ParsedPnL, PnLRow } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types used only within generation
// ─────────────────────────────────────────────────────────────────────────────

export type ReportType = "cm-vs-pm" | "cy-vs-py" | "summary-pnl" | "balance-sheet";

interface DbGroup {
  id: number;
  name: string;
  parentId: number | null;
  reportType: string;
  sortOrder: number;
  subtotalAfter: boolean;
  // P&L net-income sign on top-level sections: 'revenue' adds, 'cost' subtracts.
  contributesAs?: string | null;
  // When true, the section nets out the commissary intercompany (total sales).
  eliminateCommissary?: boolean;
}

interface DbMapping {
  accountName: string;
  groupId: number | null;
  ignored: boolean;
}

export interface ReportGenerationInput {
  parsedFiles: ParsedFiles;
  reportType: ReportType;
  groups?: DbGroup[];
  mappings?: DbMapping[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pct(part: number | null, whole: number | null): string {
  if (!part || !whole || whole === 0) return "";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function variance(current: number | null, prior: number | null): number | null {
  if (current === null && prior === null) return null;
  return (current ?? 0) - (prior ?? 0);
}

function variancePct(current: number | null, prior: number | null): string {
  const v = variance(current, prior);
  if (v === null || !prior || prior === 0) return "";
  return `${((v / Math.abs(prior)) * 100).toFixed(1)}%`;
}

// Group rows by section (section header → atomic accounts). Skips R365 Total rows.
interface Section {
  header: string;
  accounts: PnLRow[];
}

function groupPnLBySections(rows: PnLRow[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const row of rows) {
    if (row.isSectionHeader) {
      if (current) sections.push(current);
      current = { header: row.name, accounts: [] };
    } else if (!row.isTotal && current) {
      current.accounts.push(row);
    }
    // isTotal rows from R365 are intentionally skipped; we compute our own totals
  }
  if (current) sections.push(current);
  return sections;
}

// LEGACY — used only by the detail reports (buildDetailSheet), which are
// pending a refactor to the seed-driven engine. Do NOT use for new code.
// The workbook's actual elimination is commissary total SALES (see
// commissarySalesTotal), not sales − food cost.
function computeElimination(
  commissaryPnL: ParsedPnL,
  getValue: (row: PnLRow) => number | null
): number {
  let totalSales = 0;
  let totalFoodCost = 0;
  let currentSection = "";

  for (const row of commissaryPnL.rows) {
    if (row.isSectionHeader) {
      currentSection = row.name.toLowerCase();
      continue;
    }
    if (row.isTotal) continue;

    const val = getValue(row) ?? 0;
    if (currentSection.includes("sale")) {
      totalSales += val;
    } else if (currentSection.includes("food") || currentSection.includes("cost of food")) {
      totalFoodCost += val;
    }
  }

  return totalSales - totalFoodCost;
}

// Commissary intercompany elimination amount, fully data-driven: the sum of the
// commissary P&L's revenue accounts — identified via the account mapping
// (accounts mapped to a group whose section is flagged contributesAs='revenue').
// This is the amount the workbook nets out of BOTH Total Sales and Total Food
// Cost, so the consolidated view excludes the commissary→stores transfer.
function commissarySalesTotal(
  commissaryPnL: ParsedPnL,
  mappingMap: Map<string, number | null>,
  ignoredSet: Set<string>,
  revenueGroupIds: Set<number>,
  getValue: (row: PnLRow) => number | null
): number {
  let total = 0;
  for (const row of commissaryPnL.rows) {
    if (row.isSectionHeader || row.isTotal) continue;
    if (ignoredSet.has(row.name)) continue;
    const groupId = mappingMap.get(row.name);
    if (groupId && revenueGroupIds.has(groupId)) {
      total += getValue(row) ?? 0;
    }
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail report builder (CM vs PM and CY vs PY share the same structure)
// ─────────────────────────────────────────────────────────────────────────────

type ValueSet = {
  current: number | null;
  prior: number | null;
};

function getDetailValues(row: PnLRow, mode: "period" | "ytd"): ValueSet {
  return mode === "period"
    ? { current: row.periodActual, prior: row.periodPriorYear }
    : { current: row.ytdActual, prior: row.ytdPriorYear };
}

function buildDetailSheet(
  parsedFiles: ParsedFiles,
  mode: "period" | "ytd"
): XLSX.WorkSheet {
  const { consolidatedPnL, commissaryPnL } = parsedFiles;
  const colLabel = mode === "period" ? "Current Period" : "YTD";
  const priorLabel = mode === "period" ? "Prior Year Period" : "Prior Year YTD";

  const periodElim = computeElimination(commissaryPnL, (r) =>
    mode === "period" ? r.periodActual : r.ytdActual
  );

  const data: (string | number | null)[][] = [];

  // Title rows
  data.push([`Report: ${mode === "period" ? "CM vs PM (Current Period vs Prior Year Period)" : "CY vs PY (YTD vs Prior Year YTD)"}`]);
  data.push([`Period: ${consolidatedPnL.periodEnding}`]);
  data.push([`Location: ${consolidatedPnL.location}`]);
  data.push([]);

  // Header row
  data.push(["Account Name", colLabel, priorLabel, "$ Variance", "% Variance"]);

  const sections = groupPnLBySections(consolidatedPnL.rows);

  let grandCurrentTotal = 0;
  let grandPriorTotal = 0;

  for (const section of sections) {
    // Section header
    data.push([section.header.toUpperCase(), null, null, null, null]);

    let sectionCurrentTotal = 0;
    let sectionPriorTotal = 0;

    for (const row of section.accounts) {
      const { current, prior } = getDetailValues(row, mode);
      const var$ = variance(current, prior);
      sectionCurrentTotal += current ?? 0;
      sectionPriorTotal += prior ?? 0;
      data.push([row.name, current, prior, var$, variancePct(current, prior)]);
    }

    // Commissary elimination: insert after food cost / cost of food section
    const isFoodSection =
      section.header.toLowerCase().includes("food") ||
      section.header.toLowerCase().includes("cost of food");

    if (isFoodSection && periodElim !== 0) {
      const elimVal = -periodElim; // negative = reducing food cost
      sectionCurrentTotal += elimVal;
      data.push(["  Commissary Elimination", elimVal, null, null, null]);
    }

    // Section total
    const secVar = variance(sectionCurrentTotal, sectionPriorTotal);
    data.push([
      `Total ${section.header}`,
      sectionCurrentTotal,
      sectionPriorTotal,
      secVar,
      variancePct(sectionCurrentTotal, sectionPriorTotal),
    ]);
    data.push([]);

    grandCurrentTotal += sectionCurrentTotal;
    grandPriorTotal += sectionPriorTotal;
  }

  // Grand total
  const grandVar = variance(grandCurrentTotal, grandPriorTotal);
  data.push([
    "TOTAL",
    grandCurrentTotal,
    grandPriorTotal,
    grandVar,
    variancePct(grandCurrentTotal, grandPriorTotal),
  ]);

  return XLSX.utils.aoa_to_sheet(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary P&L (account-mapping based)
// ─────────────────────────────────────────────────────────────────────────────

function buildSummaryPnLSheet(
  parsedFiles: ParsedFiles,
  groups: DbGroup[],
  mappings: DbMapping[]
): XLSX.WorkSheet {
  const { consolidatedPnL, commissaryPnL } = parsedFiles;

  // Build lookup: accountName → groupId
  const mappingMap = new Map<string, number | null>();
  const ignoredSet = new Set<string>();
  for (const m of mappings) {
    if (m.ignored) {
      ignoredSet.add(m.accountName);
    } else {
      mappingMap.set(m.accountName, m.groupId);
    }
  }

  // Build group hierarchy: sections (parentId=null) and their children
  const pnlGroups = groups.filter((g) => g.reportType === "pnl");
  const sections = pnlGroups.filter((g) => g.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder);
  const childrenByParent = new Map<number, DbGroup[]>();
  for (const g of pnlGroups) {
    if (g.parentId !== null) {
      const arr = childrenByParent.get(g.parentId) ?? [];
      arr.push(g);
      childrenByParent.set(g.parentId, arr);
    }
  }

  // Aggregate consolidated P&L atomic accounts into groups
  interface GroupTotals {
    period: number;
    periodPY: number;
    ytd: number;
    ytdPY: number;
  }
  const groupTotals = new Map<number, GroupTotals>();

  for (const row of consolidatedPnL.rows) {
    if (row.isSectionHeader || row.isTotal) continue;
    if (ignoredSet.has(row.name)) continue;

    const groupId = mappingMap.get(row.name);
    if (!groupId) continue; // unmapped — excluded

    const existing = groupTotals.get(groupId) ?? { period: 0, periodPY: 0, ytd: 0, ytdPY: 0 };
    groupTotals.set(groupId, {
      period: existing.period + (row.periodActual ?? 0),
      periodPY: existing.periodPY + (row.periodPriorYear ?? 0),
      ytd: existing.ytd + (row.ytdActual ?? 0),
      ytdPY: existing.ytdPY + (row.ytdPriorYear ?? 0),
    });
  }

  // Group ids whose parent section is flagged as revenue — used to identify
  // commissary revenue accounts for the intercompany elimination.
  const revenueSectionIds = new Set(
    sections.filter((s) => s.contributesAs === "revenue").map((s) => s.id)
  );
  const revenueGroupIds = new Set(
    pnlGroups.filter((g) => g.parentId !== null && revenueSectionIds.has(g.parentId)).map((g) => g.id)
  );

  // Commissary intercompany elimination = commissary total sales (period & YTD).
  // Netted out of BOTH the Sales and Food Cost sections (flagged eliminateCommissary).
  const periodElim = commissarySalesTotal(commissaryPnL, mappingMap, ignoredSet, revenueGroupIds, (r) => r.periodActual);
  const ytdElim = commissarySalesTotal(commissaryPnL, mappingMap, ignoredSet, revenueGroupIds, (r) => r.ytdActual);

  // Sales base for "% of sales" (net revenue-section totals)
  let totalSalesPeriod = 0;
  let totalSalesYTD = 0;

  // Build output
  const data: (string | number | null)[][] = [];

  data.push(["Summary P&L"]);
  data.push([`Period: ${consolidatedPnL.periodEnding}`]);
  data.push([`Location: ${consolidatedPnL.location}`]);
  data.push([]);
  data.push([
    "Line Item",
    "Period Actual",
    "% Sales",
    "Period PY",
    "PY % Sales",
    "$ Var",
    "% Var",
    "YTD Actual",
    "% Sales",
    "YTD PY",
    "PY % Sales",
    "$ Var",
    "% Var",
  ]);

  // Net income is accumulated by sign: revenue sections add, cost sections
  // subtract. Driven by the section's contributesAs flag (no name matching).
  let revenuePeriod = 0;
  let revenuePeriodPY = 0;
  let revenueYTD = 0;
  let revenueYTDPY = 0;
  let costPeriod = 0;
  let costPeriodPY = 0;
  let costYTD = 0;
  let costYTDPY = 0;

  for (const section of sections) {
    const children = (childrenByParent.get(section.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
    const isRevenueSection = section.contributesAs === "revenue";
    const applyElim = section.eliminateCommissary === true;

    let sectionPeriod = 0;
    let sectionPeriodPY = 0;
    let sectionYTD = 0;
    let sectionYTDPY = 0;

    // Section header row
    data.push([section.name.toUpperCase(), null, null, null, null, null, null, null, null, null, null, null, null]);

    for (const group of children) {
      const totals = groupTotals.get(group.id);
      const p = totals?.period ?? 0;
      const pPY = totals?.periodPY ?? 0;
      const y = totals?.ytd ?? 0;
      const yPY = totals?.ytdPY ?? 0;

      sectionPeriod += p;
      sectionPeriodPY += pPY;
      sectionYTD += y;
      sectionYTDPY += yPY;

      const pVar = variance(p, pPY);
      const yVar = variance(y, yPY);

      data.push([
        `  ${group.name}`,
        p || null,
        null, // % of sales computed after we know section sales total
        pPY || null,
        null,
        pVar,
        variancePct(p, pPY),
        y || null,
        null,
        yPY || null,
        null,
        yVar,
        variancePct(y, yPY),
      ]);

      // Intermediate subtotal: emit a running subtotal of the section up to
      // and including this group (e.g. "Total Food Cost" for raw food only,
      // before Beverage Cost and Freight are added in).
      if (group.subtotalAfter) {
        data.push([
          `Total ${section.name}`,
          sectionPeriod || null,
          null, // % of sales filled in below once section sales known
          sectionPeriodPY || null,
          null,
          variance(sectionPeriod, sectionPeriodPY),
          variancePct(sectionPeriod, sectionPeriodPY),
          sectionYTD || null,
          null,
          sectionYTDPY || null,
          null,
          variance(sectionYTD, sectionYTDPY),
          variancePct(sectionYTD, sectionYTDPY),
        ]);
      }
    }

    // Apply commissary elimination to every flagged section (Sales and Food
    // Cost). The same amount (commissary total sales) is netted out of both.
    if (applyElim && (periodElim !== 0 || ytdElim !== 0)) {
      sectionPeriod += -periodElim;
      sectionYTD += -ytdElim;
      data.push([
        "  Commissary Elimination",
        -periodElim || null,
        null, null, null,
        null, null,
        -ytdElim || null,
        null, null, null, null, null,
      ]);
    }

    // Section total. Revenue section establishes the "% of sales" base.
    if (isRevenueSection) {
      totalSalesPeriod += sectionPeriod;
      totalSalesYTD += sectionYTD;
    }

    const pSecVar = variance(sectionPeriod, sectionPeriodPY);
    const ySecVar = variance(sectionYTD, sectionYTDPY);

    data.push([
      `Total ${section.name}`,
      sectionPeriod || null,
      pct(sectionPeriod, totalSalesPeriod),
      sectionPeriodPY || null,
      pct(sectionPeriodPY, totalSalesPeriod),
      pSecVar,
      variancePct(sectionPeriod, sectionPeriodPY),
      sectionYTD || null,
      pct(sectionYTD, totalSalesYTD),
      sectionYTDPY || null,
      pct(sectionYTDPY, totalSalesYTD),
      ySecVar,
      variancePct(sectionYTD, sectionYTDPY),
    ]);
    data.push([]);

    if (isRevenueSection) {
      revenuePeriod += sectionPeriod;
      revenuePeriodPY += sectionPeriodPY;
      revenueYTD += sectionYTD;
      revenueYTDPY += sectionYTDPY;
    } else {
      costPeriod += sectionPeriod;
      costPeriodPY += sectionPeriodPY;
      costYTD += sectionYTD;
      costYTDPY += sectionYTDPY;
    }
  }

  // Net Income = revenue − costs (subtracting cost sections regardless of sign;
  // a net-income section like Corporate Overhead that is negative adds back).
  const netPeriod = revenuePeriod - costPeriod;
  const netPeriodPY = revenuePeriodPY - costPeriodPY;
  const netYTD = revenueYTD - costYTD;
  const netYTDPY = revenueYTDPY - costYTDPY;

  data.push([
    "NET INCOME / (LOSS)",
    netPeriod || null,
    pct(netPeriod, totalSalesPeriod),
    netPeriodPY || null,
    pct(netPeriodPY, totalSalesPeriod),
    variance(netPeriod, netPeriodPY),
    variancePct(netPeriod, netPeriodPY),
    netYTD || null,
    pct(netYTD, totalSalesYTD),
    netYTDPY || null,
    pct(netYTDPY, totalSalesYTD),
    variance(netYTD, netYTDPY),
    variancePct(netYTD, netYTDPY),
  ]);

  return XLSX.utils.aoa_to_sheet(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Balance Sheet Summary (account-mapping based)
// ─────────────────────────────────────────────────────────────────────────────

function buildBalanceSheetSheet(
  parsedFiles: ParsedFiles,
  groups: DbGroup[],
  mappings: DbMapping[]
): XLSX.WorkSheet {
  const { currentYearBS, priorYearBS } = parsedFiles;

  const mappingMap = new Map<string, number | null>();
  const ignoredSet = new Set<string>();
  for (const m of mappings) {
    if (m.ignored) {
      ignoredSet.add(m.accountName);
    } else {
      mappingMap.set(m.accountName, m.groupId);
    }
  }

  const bsGroups = groups.filter((g) => g.reportType === "bs");
  const sections = bsGroups.filter((g) => g.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder);
  const childrenByParent = new Map<number, DbGroup[]>();
  for (const g of bsGroups) {
    if (g.parentId !== null) {
      const arr = childrenByParent.get(g.parentId) ?? [];
      arr.push(g);
      childrenByParent.set(g.parentId, arr);
    }
  }

  // Aggregate CY balance sheet rows into groups
  const cyTotals = new Map<number, number>();
  for (const row of currentYearBS.rows) {
    if (row.isSectionHeader || row.isTotal) continue;
    if (ignoredSet.has(row.name)) continue;
    const groupId = mappingMap.get(row.name);
    if (!groupId) continue;
    cyTotals.set(groupId, (cyTotals.get(groupId) ?? 0) + (row.ytd ?? 0));
  }

  // Aggregate PY balance sheet rows into groups
  const pyTotals = new Map<number, number>();
  for (const row of priorYearBS.rows) {
    if (row.isSectionHeader || row.isTotal) continue;
    if (ignoredSet.has(row.name)) continue;
    const groupId = mappingMap.get(row.name);
    if (!groupId) continue;
    pyTotals.set(groupId, (pyTotals.get(groupId) ?? 0) + (row.ytd ?? 0));
  }

  const data: (string | number | null)[][] = [];

  data.push(["Balance Sheet Summary"]);
  data.push([`As of: ${currentYearBS.asOf}`]);
  data.push([`Prior Year As of: ${priorYearBS.asOf}`]);
  data.push([]);
  data.push(["Line Item", "Current Year", "Prior Year", "$ Variance", "% Variance"]);

  let grandCY = 0;
  let grandPY = 0;

  for (const section of sections) {
    const children = (childrenByParent.get(section.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

    let sectionCY = 0;
    let sectionPY = 0;

    data.push([section.name.toUpperCase(), null, null, null, null]);

    for (const group of children) {
      const cy = cyTotals.get(group.id) ?? 0;
      const py = pyTotals.get(group.id) ?? 0;
      sectionCY += cy;
      sectionPY += py;

      const var$ = variance(cy, py);
      data.push([
        `  ${group.name}`,
        cy || null,
        py || null,
        var$,
        variancePct(cy, py),
      ]);

      // Intermediate subtotal of the section up to and including this group
      if (group.subtotalAfter) {
        data.push([
          `Total ${section.name}`,
          sectionCY || null,
          sectionPY || null,
          variance(sectionCY, sectionPY),
          variancePct(sectionCY, sectionPY),
        ]);
      }
    }

    const secVar = variance(sectionCY, sectionPY);
    data.push([
      `Total ${section.name}`,
      sectionCY || null,
      sectionPY || null,
      secVar,
      variancePct(sectionCY, sectionPY),
    ]);
    data.push([]);

    grandCY += sectionCY;
    grandPY += sectionPY;
  }

  const grandVar = variance(grandCY, grandPY);
  data.push([
    "TOTAL",
    grandCY || null,
    grandPY || null,
    grandVar,
    variancePct(grandCY, grandPY),
  ]);

  return XLSX.utils.aoa_to_sheet(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

const REPORT_LABELS: Record<ReportType, string> = {
  "cm-vs-pm": "CM vs PM Detail",
  "cy-vs-py": "CY vs PY Detail",
  "summary-pnl": "Summary P&L",
  "balance-sheet": "Balance Sheet Summary",
};

export function generateReport(input: ReportGenerationInput): Buffer {
  const { parsedFiles, reportType, groups = [], mappings = [] } = input;
  const wb = XLSX.utils.book_new();

  let ws: XLSX.WorkSheet;

  switch (reportType) {
    case "cm-vs-pm":
      ws = buildDetailSheet(parsedFiles, "period");
      break;
    case "cy-vs-py":
      ws = buildDetailSheet(parsedFiles, "ytd");
      break;
    case "summary-pnl":
      ws = buildSummaryPnLSheet(parsedFiles, groups, mappings);
      break;
    case "balance-sheet":
      ws = buildBalanceSheetSheet(parsedFiles, groups, mappings);
      break;
  }

  XLSX.utils.book_append_sheet(wb, ws, REPORT_LABELS[reportType]);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}
