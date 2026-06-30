/**
 * Validation harness: reconciles our generated report totals against the
 * legacy manual workbook ("Profit and Loss Workbook PD 12 2025.xlsx").
 *
 * It runs the REAL generation code path (generateReport) on the same R365
 * source files the analyst used — building the report groups + account mappings
 * in memory via buildSeedData (the same baseline the DB seed writes) — then
 * asserts our section totals and Net Income match the workbook. Exits non-zero
 * on any mismatch so it can be wired into CI / a pre-push check. No database
 * required.
 *
 * Run:
 *   npx tsx scripts/validate-reports.ts
 *
 * Note on Food Cost: the detail reports fold the commissary elimination INTO
 * the section total, while the workbook shows it as a separate line below a
 * pre-elimination "Total Food Cost". We therefore reconcile our food cost
 * against (workbook pre-elim total + workbook elimination line) — same net.
 */

import * as XLSX from "xlsx";
import { readFileSync } from "fs";
import { join } from "path";
import { parsePnL } from "../lib/reports/parse-pnl";
import { parseBalanceSheet } from "../lib/reports/parse-balance-sheet";
import { generateReport, type ReportType } from "../lib/reports/generate-reports";
import { buildSeedData } from "./seed-report-mappings";
import type { ParsedFiles } from "../lib/reports/types";

const DIR = "/Users/nicogarcia/Documents/GitHub/blakes-lotaburger/Example Files/reports";
const WORKBOOK = "Profit and Loss Workbook PD 12 2025.xlsx";
const TOLERANCE = 0.01; // cents

type Row = (string | number | null)[];

const readWb = (name: string) => XLSX.read(readFileSync(join(DIR, name)), { type: "buffer" });
const firstSheet = (name: string) => Object.values(readWb(name).Sheets)[0];
const aoaOf = (sheet: XLSX.WorkSheet): Row[] => XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: null });

function fmt(n: number | null | undefined): string {
  if (typeof n !== "number") return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generatedAoA(input: Parameters<typeof generateReport>[0]): Row[] {
  const wb = XLSX.read(generateReport(input), { type: "buffer" });
  return aoaOf(wb.Sheets[wb.SheetNames[0]]);
}

// Find the first row whose first cell (trimmed) matches a label, return a column.
function valueAt(rows: Row[], label: string, col: number): number | null {
  for (const r of rows) {
    if (String(r[0] ?? "").trim() === label) {
      const v = r[col];
      return typeof v === "number" ? v : null;
    }
  }
  return null;
}

// Workbook detail tabs can repeat a label ("Total Food Cost" twice); grab the
// LAST occurrence (the grand subtotal) when needed.
function lastValueAt(rows: Row[], label: string, col: number): number | null {
  let found: number | null = null;
  for (const r of rows) {
    if (String(r[0] ?? "").trim() === label) {
      const v = r[col];
      if (typeof v === "number") found = v;
    }
  }
  return found;
}

interface Check { label: string; ours: number | null; expected: number | null; }
const checks: Check[] = [];
let failures = 0;

function expect(label: string, ours: number | null, expected: number | null): void {
  checks.push({ label, ours, expected });
  const ok = ours !== null && expected !== null && Math.abs(ours - expected) < TOLERANCE;
  if (!ok) failures++;
  const flag = ok ? "✓" : "✗";
  const diff = ours !== null && expected !== null ? `  diff=${fmt(ours - expected)}` : "  (missing)";
  console.log(`  ${flag} ${label.padEnd(36)} ours=${fmt(ours).padStart(16)}  expected=${fmt(expected).padStart(16)}${ok ? "" : diff}`);
}

async function main(): Promise<void> {
  const parsedFiles: ParsedFiles = {
    consolidatedPnL: parsePnL(firstSheet("FY25 PD12 Consolo Profit and Loss.xlsx")),
    commissaryPnL: parsePnL(firstSheet("FY25 PD12 COMM Profit and Loss.xlsx")),
    currentYearBS: parseBalanceSheet(firstSheet("FY25 PD12 BS.xlsx")),
    priorYearBS: parseBalanceSheet(firstSheet("FY24 PD12 BS.xlsx")),
  };

  const { groups, mappings } = buildSeedData();

  const wbBook = readWb(WORKBOOK);

  // ── Detail reports: ours folds elimination into Total Food Cost, so compare
  //    food cost against (workbook pre-elim total + workbook elimination). ────
  for (const [reportType, wbSheet, mode] of [
    ["cm-vs-pm", "CM vs PM detail", "period"],
    ["cy-vs-py", "CY vs PY detail", "ytd"],
  ] as const) {
    const ours = generatedAoA({ parsedFiles, reportType, groups, mappings });
    const wb = aoaOf(wbBook.Sheets[wbSheet]);
    const ourCol = 1; // current value
    const wbCol = 1;
    const wbFoodCost = lastValueAt(wb, "Total Food Cost", wbCol); // grand, pre-elim
    const wbElim = valueAt(wb, "Elimination for Comissary Sales to Stores", wbCol);
    const wbFoodNet = wbFoodCost !== null && wbElim !== null ? wbFoodCost + wbElim : null;

    console.log(`\n===== ${reportType.toUpperCase()} (${mode}) vs "${wbSheet}" =====`);
    expect(`${mode} Total Sales`, valueAt(ours, "Total Sales", ourCol), valueAt(wb, "Total Sales", wbCol));
    expect(`${mode} Total Food Cost (net)`, lastValueAt(ours, "Total Food Cost", ourCol), wbFoodNet);
    expect(`${mode} Total Labor Cost`, valueAt(ours, "Total Labor Cost", ourCol), valueAt(wb, "Total Labor Cost", wbCol));
    expect(`${mode} Total Operating Expense`, valueAt(ours, "Total Operating Expense", ourCol), valueAt(wb, "Total Operating Expense", wbCol));
    expect(`${mode} Total Non Controllable Expense`, valueAt(ours, "Total Non Controllable Expense", ourCol), valueAt(wb, "Total Non Controllable Expense", wbCol));
    expect(`${mode} Net Income`, valueAt(ours, "NET INCOME / (LOSS)", ourCol), valueAt(wb, "Net Profit", wbCol));
  }

  // ── Summary P&L: workbook's grouped "Net Profit" carries a known 319.56
  //    rounding gap vs R365; the authoritative figure is its "Net Profit P&L"
  //    line, which equals R365's actual bottom line — and our engine. ────────
  const sumOurs = generatedAoA({ parsedFiles, reportType: "summary-pnl", groups, mappings });
  const sumWb = aoaOf(wbBook.Sheets["Summary P&L"]);
  console.log(`\n===== SUMMARY P&L (YTD 2025) vs "Summary P&L" =====`);
  const ytdCol = 1; // our Summary YTD Actual column
  // Use lastValueAt for section totals: the Summary repeats "Total Food Cost"
  // (raw-food intermediate subtotal, then the final section total).
  expect("YTD Total Sales", lastValueAt(sumOurs, "Total Sales", ytdCol), valueAt(sumWb, "Total Sales", 1));
  expect("YTD Total Food Cost", lastValueAt(sumOurs, "Total Food Cost", ytdCol), valueAt(sumWb, "Total Food Cost", 1));
  expect("YTD Total Labor Cost", lastValueAt(sumOurs, "Total Labor Cost", ytdCol), valueAt(sumWb, "Total Labor Cost", 1));
  // Authoritative R365 bottom line (workbook "Net Profit P&L"), not its grouped "Net Profit".
  expect("YTD Net Income (vs R365 actual)", valueAt(sumOurs, "NET INCOME / (LOSS)", ytdCol), valueAt(sumWb, "Net Profit P&L", 1));

  // ── Balance Sheet: section totals against the workbook's BS Summary tab. ──
  const bsOurs = generatedAoA({ parsedFiles, reportType: "balance-sheet", groups, mappings });
  const bsWb = aoaOf(wbBook.Sheets["Balance Sheet Summary"]);
  console.log(`\n===== BALANCE SHEET vs "Balance Sheet Summary" =====`);
  const bsWbCol = 3; // workbook current-year value column
  for (const section of ["Total Current Asset", "Total Inventory", "Total Fixed Asset", "Total Other Asset", "Total Current Liability", "Total Long Term Liability", "Total Liabilities", "Total Equity"]) {
    expect(section, valueAt(bsOurs, section, 1), valueAt(bsWb, section, bsWbCol));
  }

  // ── Structural assertions: the line items the analyst feedback was about must
  //    be present (group subtotals in the detail, Total Liabilities in the BS,
  //    Total Prime Costs in the summary). Guards against regressing the fix. ──
  console.log(`\n===== STRUCTURE (line items present) =====`);
  const present = (rows: Row[], label: string): boolean =>
    rows.some((r) => String(r[0] ?? "").trim() === label);
  const expectPresent = (label: string, ok: boolean): void => {
    checks.push({ label, ours: ok ? 1 : null, expected: 1 });
    if (!ok) failures++;
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  };

  const detail = generatedAoA({ parsedFiles, reportType: "cm-vs-pm", groups, mappings });
  for (const sub of ["Total Food Sales", "Total Comps and Discounts", "Total Salaries and Wages", "Total Direct Operating Expense", "Total Marketing", "Total Occupancy Costs"]) {
    expectPresent(`detail: ${sub}`, present(detail, sub));
  }
  expectPresent("balance sheet: Total Liabilities", present(bsOurs, "Total Liabilities"));
  expectPresent("summary: Total Prime Costs", present(sumOurs, "Total Prime Costs"));

  console.log(`\n${failures === 0 ? "✅ ALL CHECKS PASSED" : `❌ ${failures} CHECK(S) FAILED`} (${checks.length} total)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
