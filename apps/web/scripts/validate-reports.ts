/**
 * Validation harness: reconciles our generated report totals against the
 * legacy manual workbook ("Profit and Loss Workbook PD 12 2025.xlsx").
 *
 * It runs the REAL generation code path (generateReport) on the same R365
 * source files the analyst used, then extracts every subtotal / total / grand
 * total and lines them up against the workbook's own summary tabs so we can
 * see — line by line — where we agree and where we diverge.
 *
 * Run:
 *   npx tsx scripts/validate-reports.ts
 *
 * The detail reports (CM vs PM, CY vs PY) need NO database — they sum the
 * consolidated P&L sections directly. This script therefore validates the
 * parser + elimination + totalling logic without a running DB.
 */

import * as XLSX from "xlsx";
import { readFileSync } from "fs";
import { join } from "path";
import { parsePnL } from "../lib/reports/parse-pnl";
import { parseBalanceSheet } from "../lib/reports/parse-balance-sheet";
import { generateReport } from "../lib/reports/generate-reports";
import type { ParsedFiles } from "../lib/reports/types";

const DIR = "/Users/nicogarcia/Documents/GitHub/blakes-lotaburger/Example Files/reports";

function readWb(name: string) {
  return XLSX.read(readFileSync(join(DIR, name)), { type: "buffer" });
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  if (typeof n !== "number") return String(n);
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Load + parse the R365 source files (our input) ──────────────────────────
const consolidatedPnL = parsePnL(readWb("FY25 PD12 Consolo Profit and Loss.xlsx").Sheets["Sheet1"] ??
  Object.values(readWb("FY25 PD12 Consolo Profit and Loss.xlsx").Sheets)[0]);
const commissaryPnL = parsePnL(Object.values(readWb("FY25 PD12 COMM Profit and Loss.xlsx").Sheets)[0]);
const currentYearBS = parseBalanceSheet(Object.values(readWb("FY25 PD12 BS.xlsx").Sheets)[0]);
const priorYearBS = parseBalanceSheet(Object.values(readWb("FY24 PD12 BS.xlsx").Sheets)[0]);

const parsedFiles: ParsedFiles = { consolidatedPnL, commissaryPnL, currentYearBS, priorYearBS };

// ── Run our real generation code path ───────────────────────────────────────
function sheetAoA(buf: Buffer): (string | number | null)[][] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

const cmAoA = sheetAoA(generateReport({ parsedFiles, reportType: "cm-vs-pm" }));
const cyAoA = sheetAoA(generateReport({ parsedFiles, reportType: "cy-vs-py" }));

// ── Helper: print every total/elimination/grand row from one of our sheets ──
function printOurTotals(label: string, aoa: (string | number | null)[][]) {
  console.log(`\n========= OUR ${label} =========`);
  for (const r of aoa) {
    const name = String(r[0] ?? "");
    if (/^total|^net|elimination|^TOTAL/i.test(name)) {
      console.log(`  ${name.padEnd(34)} cur=${fmt(r[1] as number).padStart(16)}  prior=${fmt(r[2] as number).padStart(16)}`);
    }
  }
}

printOurTotals("CM vs PM (period)", cmAoA);
printOurTotals("CY vs PY (YTD)", cyAoA);

// ── Workbook ground truth: pull labelled total rows ─────────────────────────
function printWbTotals(sheetName: string, curCol: number, priCol: number) {
  const wb = readWb("Profit and Loss Workbook PD 12 2025.xlsx");
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[sheetName], { header: 1, defval: null });
  console.log(`\n========= WORKBOOK "${sheetName}" =========`);
  for (const r of aoa) {
    const name = String(r[0] ?? "");
    if (/^total|^net|elimination/i.test(name)) {
      console.log(`  ${name.padEnd(40)} cur=${fmt(r[curCol] as number).padStart(16)}  prior=${fmt(r[priCol] as number).padStart(16)}`);
    }
  }
}

printWbTotals("CM vs PM detail", 1, 4);
printWbTotals("CY vs PY detail", 1, 4);

// ── Summary P&L (workbook) key anchors ──────────────────────────────────────
const sumWb = readWb("Profit and Loss Workbook PD 12 2025.xlsx");
const sumAoA = XLSX.utils.sheet_to_json<(string | number | null)[]>(sumWb.Sheets["Summary P&L"], { header: 1, defval: null });
console.log(`\n========= WORKBOOK "Summary P&L" (YTD anchors) =========`);
for (const r of sumAoA) {
  const name = String(r[0] ?? "");
  if (name) console.log(`  ${name.padEnd(40)} 2025=${fmt(r[1] as number).padStart(16)}  2024=${fmt(r[2] as number).padStart(16)}`);
}

// ── Elimination reconciliation ──────────────────────────────────────────────
console.log(`\n========= ELIMINATION =========`);
console.log(`  Workbook 'Elimination for Comissary Sales to Stores' (period) = -592,723.69`);
console.log(`  (Our value appears as 'Commissary Elimination' in the OUR CM vs PM output above.)`);

console.log(`\nParsed counts: consolidated rows=${consolidatedPnL.rows.length}, commissary rows=${commissaryPnL.rows.length}`);
console.log(`Period ending=${consolidatedPnL.periodEnding}, location=${consolidatedPnL.location}`);
