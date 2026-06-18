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
// Shared P&L aggregation — the single model the 3 P&L reports render from.
// Summary renders group subtotals; CM/CY render each account; both reuse this.
// ─────────────────────────────────────────────────────────────────────────────

// Period + YTD, actual + prior year, carried together so renderers pick columns.
interface Vals { period: number; periodPY: number; ytd: number; ytdPY: number; }
const zeroVals = (): Vals => ({ period: 0, periodPY: 0, ytd: 0, ytdPY: 0 });
function addRow(t: Vals, r: PnLRow): void {
  t.period += r.periodActual ?? 0;
  t.periodPY += r.periodPriorYear ?? 0;
  t.ytd += r.ytdActual ?? 0;
  t.ytdPY += r.ytdPriorYear ?? 0;
}
function addVals(t: Vals, v: Vals): void {
  t.period += v.period; t.periodPY += v.periodPY; t.ytd += v.ytd; t.ytdPY += v.ytdPY;
}
function negVals(v: Vals): Vals {
  return { period: -v.period, periodPY: -v.periodPY, ytd: -v.ytd, ytdPY: -v.ytdPY };
}

interface PnLAccount { name: string; vals: Vals; }
interface PnLGroup { name: string; subtotalAfter: boolean; vals: Vals; accounts: PnLAccount[]; }
interface PnLSection {
  name: string;
  isRevenue: boolean;
  groups: PnLGroup[];
  eliminate: Vals | null; // commissary amount netted out of this section, or null
  total: Vals; // section total, AFTER elimination
}
interface PnLModel { sections: PnLSection[]; netIncome: Vals; salesBase: Vals; }

function aggregatePnL(parsedFiles: ParsedFiles, groups: DbGroup[], mappings: DbMapping[]): PnLModel {
  const { consolidatedPnL, commissaryPnL } = parsedFiles;

  const mappingMap = new Map<string, number | null>();
  const ignoredSet = new Set<string>();
  for (const m of mappings) {
    if (m.ignored) ignoredSet.add(m.accountName);
    else mappingMap.set(m.accountName, m.groupId);
  }

  const pnlGroups = groups.filter((g) => g.reportType === "pnl");
  const sectionDefs = pnlGroups.filter((g) => g.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder);
  const groupDefsByParent = new Map<number, DbGroup[]>();
  for (const g of pnlGroups) {
    if (g.parentId !== null) {
      const arr = groupDefsByParent.get(g.parentId) ?? [];
      arr.push(g);
      groupDefsByParent.set(g.parentId, arr);
    }
  }

  // Consolidated accounts collected per group, preserving R365 file order.
  const accountsByGroup = new Map<number, PnLAccount[]>();
  for (const row of consolidatedPnL.rows) {
    if (row.isSectionHeader || row.isTotal) continue;
    if (ignoredSet.has(row.name)) continue;
    const groupId = mappingMap.get(row.name);
    if (!groupId) continue; // unmapped — excluded (accounts are force-mapped before generation)
    const vals = zeroVals();
    addRow(vals, row);
    const arr = accountsByGroup.get(groupId) ?? [];
    arr.push({ name: row.name, vals });
    accountsByGroup.set(groupId, arr);
  }

  // Commissary elimination = commissary total sales (revenue-flagged sections),
  // netted out of every section flagged eliminateCommissary, on all 4 columns.
  const revenueSectionIds = new Set(sectionDefs.filter((s) => s.contributesAs === "revenue").map((s) => s.id));
  const revenueGroupIds = new Set(
    pnlGroups.filter((g) => g.parentId !== null && revenueSectionIds.has(g.parentId)).map((g) => g.id)
  );
  const elim: Vals = {
    period: commissarySalesTotal(commissaryPnL, mappingMap, ignoredSet, revenueGroupIds, (r) => r.periodActual),
    periodPY: commissarySalesTotal(commissaryPnL, mappingMap, ignoredSet, revenueGroupIds, (r) => r.periodPriorYear),
    ytd: commissarySalesTotal(commissaryPnL, mappingMap, ignoredSet, revenueGroupIds, (r) => r.ytdActual),
    ytdPY: commissarySalesTotal(commissaryPnL, mappingMap, ignoredSet, revenueGroupIds, (r) => r.ytdPriorYear),
  };

  const sections: PnLSection[] = [];
  const netIncome = zeroVals();
  const salesBase = zeroVals();

  for (const sec of sectionDefs) {
    const isRevenue = sec.contributesAs === "revenue";
    const groupList: PnLGroup[] = [];
    const total = zeroVals();

    const defs = (groupDefsByParent.get(sec.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
    for (const gd of defs) {
      const accounts = accountsByGroup.get(gd.id) ?? [];
      const gvals = zeroVals();
      for (const a of accounts) addVals(gvals, a.vals);
      groupList.push({ name: gd.name, subtotalAfter: gd.subtotalAfter, vals: gvals, accounts });
      addVals(total, gvals);
    }

    const eliminate = sec.eliminateCommissary ? elim : null;
    if (eliminate) addVals(total, negVals(eliminate));

    sections.push({ name: sec.name, isRevenue, groups: groupList, eliminate, total });

    // Net Income: revenue adds, cost subtracts. Revenue defines the % sales base.
    if (isRevenue) { addVals(netIncome, total); addVals(salesBase, total); }
    else addVals(netIncome, negVals(total));
  }

  return { sections, netIncome, salesBase };
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail renderer (CM vs PM = period columns, CY vs PY = YTD columns).
// Lists every account; group subtotals only where subtotalAfter is set.
// ─────────────────────────────────────────────────────────────────────────────

function renderDetailPnL(model: PnLModel, meta: ParsedPnL, mode: "period" | "ytd"): XLSX.WorkSheet {
  const cur = (v: Vals) => (mode === "period" ? v.period : v.ytd);
  const pri = (v: Vals) => (mode === "period" ? v.periodPY : v.ytdPY);
  const sales = cur(model.salesBase);
  const salesPrior = pri(model.salesBase);

  const title = mode === "period"
    ? "CM vs PM (Current Period vs Prior Year Period)"
    : "CY vs PY (YTD vs Prior Year YTD)";
  const curLabel = mode === "period" ? "Current Period" : "YTD Actual";
  const priLabel = mode === "period" ? "Prior Year Period" : "Prior Year YTD";

  const data: (string | number | null)[][] = [];
  data.push([`Report: ${title}`]);
  data.push([`Period: ${meta.periodEnding}`]);
  data.push([`Location: ${meta.location}`]);
  data.push([]);
  data.push(["Account Name", curLabel, "% Sales", priLabel, "PY % Sales", "$ Variance", "% Variance"]);

  const line = (label: string, vals: Vals) => {
    const c = cur(vals), p = pri(vals);
    data.push([label, c || null, pct(c, sales), p || null, pct(p, salesPrior), variance(c, p), variancePct(c, p)]);
  };

  for (const section of model.sections) {
    data.push([section.name.toUpperCase(), null, null, null, null, null, null]);

    const running = zeroVals();
    for (const group of section.groups) {
      for (const acc of group.accounts) line(`  ${acc.name}`, acc.vals);
      addVals(running, group.vals);
      // Intermediate subtotal (pre-elimination), e.g. raw "Total Food Cost".
      if (group.subtotalAfter) line(`Total ${section.name}`, running);
    }

    if (section.eliminate) line("  Commissary Elimination", negVals(section.eliminate));
    line(`Total ${section.name}`, section.total);
    data.push([]);
  }

  line("NET INCOME / (LOSS)", model.netIncome);
  return XLSX.utils.aoa_to_sheet(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary P&L (account-mapping based)
// ─────────────────────────────────────────────────────────────────────────────

function renderSummaryPnL(model: PnLModel, meta: ParsedPnL): XLSX.WorkSheet {
  const sales = model.salesBase;

  const data: (string | number | null)[][] = [];
  data.push(["Summary P&L"]);
  data.push([`Period: ${meta.periodEnding}`]);
  data.push([`Location: ${meta.location}`]);
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

  for (const section of model.sections) {
    // Section header row
    data.push([section.name.toUpperCase(), null, null, null, null, null, null, null, null, null, null, null, null]);

    const running = zeroVals();
    for (const group of section.groups) {
      const v = group.vals;
      data.push([
        `  ${group.name}`,
        v.period || null,
        null, // group-level % of sales intentionally omitted
        v.periodPY || null,
        null,
        variance(v.period, v.periodPY),
        variancePct(v.period, v.periodPY),
        v.ytd || null,
        null,
        v.ytdPY || null,
        null,
        variance(v.ytd, v.ytdPY),
        variancePct(v.ytd, v.ytdPY),
      ]);

      addVals(running, v);
      // Intermediate subtotal (pre-elimination), e.g. raw "Total Food Cost".
      if (group.subtotalAfter) {
        data.push([
          `Total ${section.name}`,
          running.period || null,
          null,
          running.periodPY || null,
          null,
          variance(running.period, running.periodPY),
          variancePct(running.period, running.periodPY),
          running.ytd || null,
          null,
          running.ytdPY || null,
          null,
          variance(running.ytd, running.ytdPY),
          variancePct(running.ytd, running.ytdPY),
        ]);
      }
    }

    if (section.eliminate) {
      const e = negVals(section.eliminate);
      data.push([
        "  Commissary Elimination",
        e.period || null,
        null, null, null,
        null, null,
        e.ytd || null,
        null, null, null, null, null,
      ]);
    }

    const t = section.total;
    data.push([
      `Total ${section.name}`,
      t.period || null,
      pct(t.period, sales.period),
      t.periodPY || null,
      pct(t.periodPY, sales.period),
      variance(t.period, t.periodPY),
      variancePct(t.period, t.periodPY),
      t.ytd || null,
      pct(t.ytd, sales.ytd),
      t.ytdPY || null,
      pct(t.ytdPY, sales.ytd),
      variance(t.ytd, t.ytdPY),
      variancePct(t.ytd, t.ytdPY),
    ]);
    data.push([]);
  }

  const n = model.netIncome;
  data.push([
    "NET INCOME / (LOSS)",
    n.period || null,
    pct(n.period, sales.period),
    n.periodPY || null,
    pct(n.periodPY, sales.period),
    variance(n.period, n.periodPY),
    variancePct(n.period, n.periodPY),
    n.ytd || null,
    pct(n.ytd, sales.ytd),
    n.ytdPY || null,
    pct(n.ytdPY, sales.ytd),
    variance(n.ytd, n.ytdPY),
    variancePct(n.ytd, n.ytdPY),
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

  // Balance-sheet sides are data-driven via contributesAs on each section:
  // 'asset' rolls up to "Total Assets", 'liability_equity' to "Total
  // Liabilities & Equity". The two must be equal (the accounting identity
  // Assets = Liabilities + Equity); we emit a balance check to surface drift.
  // When no section carries a side flag (unseeded), fall back to a single TOTAL.
  const sideConfigured = sections.some(
    (s) => s.contributesAs === "asset" || s.contributesAs === "liability_equity"
  );
  const lastAssetIdx = sideConfigured
    ? sections.map((s) => s.contributesAs).lastIndexOf("asset")
    : -1;

  let assetsCY = 0, assetsPY = 0;
  let liabEqCY = 0, liabEqPY = 0;
  let grandCY = 0, grandPY = 0;

  sections.forEach((section, idx) => {
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
    if (section.contributesAs === "liability_equity") {
      liabEqCY += sectionCY;
      liabEqPY += sectionPY;
    } else {
      assetsCY += sectionCY;
      assetsPY += sectionPY;
    }

    // "Total Assets" closes the asset block, right after the last asset section.
    if (sideConfigured && idx === lastAssetIdx) {
      data.push([
        "Total Assets",
        assetsCY || null,
        assetsPY || null,
        variance(assetsCY, assetsPY),
        variancePct(assetsCY, assetsPY),
      ]);
      data.push([]);
    }
  });

  if (sideConfigured) {
    data.push([
      "Total Liabilities & Equity",
      liabEqCY || null,
      liabEqPY || null,
      variance(liabEqCY, liabEqPY),
      variancePct(liabEqCY, liabEqPY),
    ]);
    // Accounting identity check: should be ~0 in both columns.
    data.push([
      "Balance Check (Assets − Liabilities & Equity)",
      assetsCY - liabEqCY,
      assetsPY - liabEqPY,
      null,
      null,
    ]);
  } else {
    data.push([
      "TOTAL",
      grandCY || null,
      grandPY || null,
      variance(grandCY, grandPY),
      variancePct(grandCY, grandPY),
    ]);
  }

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
      ws = renderDetailPnL(aggregatePnL(parsedFiles, groups, mappings), parsedFiles.consolidatedPnL, "period");
      break;
    case "cy-vs-py":
      ws = renderDetailPnL(aggregatePnL(parsedFiles, groups, mappings), parsedFiles.consolidatedPnL, "ytd");
      break;
    case "summary-pnl":
      ws = renderSummaryPnL(aggregatePnL(parsedFiles, groups, mappings), parsedFiles.consolidatedPnL);
      break;
    case "balance-sheet":
      ws = buildBalanceSheetSheet(parsedFiles, groups, mappings);
      break;
  }

  XLSX.utils.book_append_sheet(wb, ws, REPORT_LABELS[reportType]);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}
