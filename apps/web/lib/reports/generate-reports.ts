import * as XLSX from "xlsx-js-style";
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

// ─────────────────────────────────────────────────────────────────────────────
// Worksheet styling — shared by all 4 reports. Every renderer emits the same
// array-of-arrays shape with consistent label conventions, so a single styler
// can classify each row and apply brand formatting without the renderers
// knowing anything about presentation.
// ─────────────────────────────────────────────────────────────────────────────

// Brand palette (from globals.css), as Excel ARGB-less hex strings.
const COLORS = {
  steel: "3D423B",
  cloud: "E4E7E2",
  fog: "F7F9F6",
  white: "FFFFFF",
  silver: "6E746C",
  primary: "6366F1",
  green: "16A34A",
  red: "DC2626",
} as const;

// Accounting number format: thousands separators, negatives in red parentheses.
const NUM_FMT = "#,##0.00;[Red](#,##0.00)";

type RowClass =
  | "title" | "meta" | "header" | "section" | "subheader"
  | "total" | "grandtotal" | "check" | "detail" | "blank";

// Grand totals get the strongest emphasis (accent fill, white text).
const GRAND_TOTAL_LABELS = new Set([
  "NET INCOME / (LOSS)",
  "Total Assets",
  "Total Liabilities & Equity",
  "TOTAL",
]);

// Classify a row purely from its first cell + shape. Renderer label conventions:
// row 0 is the title; meta rows precede the header; section headers are the only
// UPPERCASE labels with no values; detail rows are indented with two spaces;
// subtotals/totals start with "Total "; the balance check starts with "Balance".
function classifyRow(row: (string | number | null)[], rowIndex: number, headerRowIndex: number): RowClass {
  const first = row[0];
  if (rowIndex === 0) return "title";
  if (first === null || first === undefined || first === "") return "blank";
  if (rowIndex === headerRowIndex) return "header";
  if (headerRowIndex > 0 && rowIndex < headerRowIndex) return "meta";

  const label = String(first);
  if (label.startsWith("Balance Check")) return "check";
  if (GRAND_TOTAL_LABELS.has(label)) return "grandtotal";
  if (label.startsWith("Total ")) return "total";
  // A label with no values is a header: UPPERCASE → top-level section,
  // otherwise → subgroup header (e.g. "Food Sales", "Salaries and Wages").
  const restEmpty = row.slice(1).every((c) => c === null || c === undefined || c === "");
  if (restEmpty) return label === label.toUpperCase() ? "section" : "subheader";
  return "detail";
}

const solidFill = (rgb: string) => ({ patternType: "solid", fgColor: { rgb } });
const topBorder = { top: { style: "thin", color: { rgb: COLORS.steel } } };
const topBottomBorder = {
  top: { style: "thin", color: { rgb: COLORS.steel } },
  bottom: { style: "thin", color: { rgb: COLORS.steel } },
};

// Per-class cell style fragments (font / fill / border). Alignment and number
// format are applied separately per cell based on its value type.
const ROW_STYLE: Partial<Record<RowClass, Record<string, unknown>>> = {
  title: { font: { bold: true, sz: 14, color: { rgb: COLORS.steel } } },
  meta: { font: { italic: true, sz: 10, color: { rgb: COLORS.silver } } },
  header: { font: { bold: true, color: { rgb: COLORS.white } }, fill: solidFill(COLORS.steel) },
  section: { font: { bold: true, color: { rgb: COLORS.steel } }, fill: solidFill(COLORS.cloud) },
  subheader: { font: { bold: true, color: { rgb: COLORS.steel } } },
  total: { font: { bold: true, color: { rgb: COLORS.steel } }, fill: solidFill(COLORS.fog), border: topBorder },
  grandtotal: { font: { bold: true, color: { rgb: COLORS.white } }, fill: solidFill(COLORS.primary), border: topBottomBorder },
  check: { font: { bold: true }, fill: solidFill(COLORS.fog) },
};

// Classes whose fill must span the full table width — empty cells are created so
// the background color does not stop at the first (only populated) cell.
const FULL_WIDTH_FILL = new Set<RowClass>(["header", "section", "total", "grandtotal", "check"]);

// Build a worksheet from an array-of-arrays: auto-size every column to its widest
// cell, then apply brand styling (bold/fills/borders), accounting number format,
// and right-alignment to numeric and percentage columns.
function sheetWithAutoWidth(data: (string | number | null)[][]): XLSX.WorkSheet {
  const widths: number[] = [];
  for (const row of data) {
    row.forEach((cell, i) => {
      let len = 0;
      if (cell === null || cell === undefined) len = 0;
      else if (typeof cell === "number") len = cell.toLocaleString("en-US", { maximumFractionDigits: 2 }).length;
      else len = String(cell).length;
      widths[i] = Math.max(widths[i] ?? 0, len);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  // +2 padding; clamp so labels stay readable and number columns don't sprawl.
  ws["!cols"] = widths.map((w) => ({ wch: Math.min(Math.max(w + 2, 10), 60) }));

  const ncols = data.reduce((max, row) => Math.max(max, row.length), 0);
  const headerRowIndex = data.findIndex((r) => r[0] === "Account Name" || r[0] === "Line Item");

  for (let r = 0; r < data.length; r++) {
    const cls = classifyRow(data[r], r, headerRowIndex);
    if (cls === "blank") continue;
    const classStyle = ROW_STYLE[cls];
    const cols = FULL_WIDTH_FILL.has(cls) ? ncols : data[r].length;

    for (let c = 0; c < cols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      // Materialize empty cells on full-width fill rows so the color spans across.
      const cell = ws[addr] ?? (FULL_WIDTH_FILL.has(cls) ? (ws[addr] = { t: "s", v: "" }) : undefined);
      if (!cell) continue;

      const isNumber = cell.t === "n";
      const isPercent = typeof cell.v === "string" && cell.v.endsWith("%");

      const style: Record<string, unknown> = {
        ...classStyle,
        // Number format lives inside the style object (xlsx-js-style ignores cell.z
        // once a style is present); maps to Excel builtin 40.
        ...(isNumber ? { numFmt: NUM_FMT } : {}),
        alignment: { horizontal: isNumber || isPercent ? "right" : "left", vertical: "center" },
      };
      // Balance check: green when the identity holds (0), red when it drifts.
      if (cls === "check" && isNumber) {
        style.font = { bold: true, color: { rgb: cell.v === 0 ? COLORS.green : COLORS.red } };
      }
      cell.s = style;
    }
  }

  return ws;
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
      if (group.accounts.length === 1) {
        // Single-account group: one line at the group level (no header/subtotal).
        line(group.accounts[0].name, group.vals);
      } else if (group.accounts.length > 1) {
        // Multi-account group: header + accounts + a "Total {group}" subtotal —
        // unless the group already drives a section-level intermediate subtotal
        // (subtotalAfter), which would duplicate it.
        data.push([group.name, null, null, null, null, null, null]);
        for (const acc of group.accounts) line(`  ${acc.name}`, acc.vals);
        if (!group.subtotalAfter) line(`Total ${group.name}`, group.vals);
      }
      addVals(running, group.vals);
      // Intermediate section subtotal (pre-elimination), e.g. raw "Total Food Cost".
      if (group.subtotalAfter) line(`Total ${section.name}`, running);
    }

    if (section.eliminate) line("  Commissary Elimination", negVals(section.eliminate));
    line(`Total ${section.name}`, section.total);
    data.push([]);
  }

  line("NET INCOME / (LOSS)", model.netIncome);
  return sheetWithAutoWidth(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary P&L (account-mapping based)
// ─────────────────────────────────────────────────────────────────────────────

function renderSummaryPnL(model: PnLModel, meta: ParsedPnL): XLSX.WorkSheet {
  // Year-to-date summary: one line per group (no account detail), two value
  // columns (current vs prior year) plus variance. The detail reports carry the
  // account-level and period/%-of-sales breakdowns; this stays a summary.
  const data: (string | number | null)[][] = [];
  data.push(["Summary P&L"]);
  data.push([`Period: ${meta.periodEnding}`]);
  data.push([`Location: ${meta.location}`]);
  data.push([]);
  data.push(["Line Item", "YTD Actual", "Prior Year YTD", "$ Variance", "% Variance"]);

  const row = (label: string, v: Vals): void => {
    data.push([label, v.ytd || null, v.ytdPY || null, variance(v.ytd, v.ytdPY), variancePct(v.ytd, v.ytdPY)]);
  };

  // Prime Cost = Food Cost + Labor Cost (standard restaurant operating metric),
  // emitted right after the Labor Cost section closes.
  const PRIME_SECTIONS = new Set(["Food Cost", "Labor Cost"]);
  const primeCost = zeroVals();

  for (const section of model.sections) {
    data.push([section.name.toUpperCase(), null, null, null, null]);

    const running = zeroVals();
    for (const group of section.groups) {
      row(`  ${group.name}`, group.vals);
      addVals(running, group.vals);
      // Intermediate subtotal (pre-elimination), e.g. raw "Total Food Cost".
      if (group.subtotalAfter) row(`Total ${section.name}`, running);
    }

    if (section.eliminate) {
      const e = negVals(section.eliminate);
      data.push(["  Commissary Elimination", e.ytd || null, null, null, null]);
    }

    row(`Total ${section.name}`, section.total);

    if (PRIME_SECTIONS.has(section.name)) addVals(primeCost, section.total);
    if (section.name === "Labor Cost") row("Total Prime Costs", primeCost);

    data.push([]);
  }

  row("NET INCOME / (LOSS)", model.netIncome);

  return sheetWithAutoWidth(data);
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
  // 'asset' rolls up to "Total Assets", 'liability' to "Total Liabilities",
  // 'equity' to "Total Equity"; liabilities + equity give "Total Liabilities &
  // Equity", which must equal Total Assets (the accounting identity
  // Assets = Liabilities + Equity). We emit a balance check to surface drift.
  // Legacy 'liability_equity' (pre-split seed) is treated as equity so the grand
  // total stays correct; only the "Total Liabilities" line is absent until
  // re-seeded. When no section carries a side flag, fall back to a single TOTAL.
  const SIDES = new Set(["asset", "liability", "equity"]);
  const sideConfigured = sections.some((s) => SIDES.has(s.contributesAs ?? ""));
  const sideList = sections.map((s) => s.contributesAs);
  const lastAssetIdx = sideConfigured ? sideList.lastIndexOf("asset") : -1;
  const lastLiabIdx = sideConfigured ? sideList.lastIndexOf("liability") : -1;

  let assetsCY = 0, assetsPY = 0;
  let liabCY = 0, liabPY = 0;
  let equityCY = 0, equityPY = 0;
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
    if (section.contributesAs === "asset") {
      assetsCY += sectionCY;
      assetsPY += sectionPY;
    } else if (section.contributesAs === "liability") {
      liabCY += sectionCY;
      liabPY += sectionPY;
    } else {
      // 'equity' and legacy 'liability_equity' both roll into equity.
      equityCY += sectionCY;
      equityPY += sectionPY;
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

    // "Total Liabilities" closes the liability block, before the Equity section.
    if (sideConfigured && idx === lastLiabIdx) {
      data.push([
        "Total Liabilities",
        liabCY || null,
        liabPY || null,
        variance(liabCY, liabPY),
        variancePct(liabCY, liabPY),
      ]);
      data.push([]);
    }
  });

  if (sideConfigured) {
    const liabEqCY = liabCY + equityCY;
    const liabEqPY = liabPY + equityPY;
    data.push([
      "Total Liabilities & Equity",
      liabEqCY || null,
      liabEqPY || null,
      variance(liabEqCY, liabEqPY),
      variancePct(liabEqCY, liabEqPY),
    ]);
    // Accounting identity check: should be 0 in both columns. Round to cents so
    // floating-point dust (e.g. -1.49e-08) shows as 0.00 instead of in
    // scientific notation.
    const roundCents = (n: number) => Math.round(n * 100) / 100;
    data.push([
      "Balance Check (Assets − Liabilities & Equity)",
      roundCents(assetsCY - liabEqCY),
      roundCents(assetsPY - liabEqPY),
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

  return sheetWithAutoWidth(data);
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
