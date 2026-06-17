import { utils } from "xlsx";
import type { WorkSheet } from "xlsx";
import type { ParsedPnL, PnLRow } from "./types";

// Column indices in the R365 P&L export (0-based).
// Cols 4-6 are Period Budget (blank when no budget set), which shifts PY and beyond by 1.
// Verified against real FY25 PD12 files.
const COL = {
  NAME: 0,
  PERIOD_ACTUAL: 2,
  PERIOD_PCT: 3,
  PERIOD_PY: 7,
  PERIOD_PY_PCT: 8,
  PERIOD_VAR: 11,
  PERIOD_VAR_PCT: 12,
  YTD_ACTUAL: 14,
  YTD_PCT: 15,
  YTD_PY: 20,
  YTD_PY_PCT: 21,
  YTD_VAR: 24,
  YTD_VAR_PCT: 25,
} as const;

// Data rows start after the 7-row header block
const DATA_START_ROW = 7;

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

export function parsePnL(ws: WorkSheet): ParsedPnL {
  const rawRows = utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  const periodEnding = String(rawRows[1]?.[0] ?? "")
    .replace("Period Ending ", "")
    .trim();

  const location = String(rawRows[3]?.[0] ?? "").trim();

  const rows: PnLRow[] = [];

  for (let i = DATA_START_ROW; i < rawRows.length; i++) {
    const raw = rawRows[i] as unknown[];
    const name = String(raw[COL.NAME] ?? "").trim();
    if (!name) continue;

    const periodActual = toNum(raw[COL.PERIOD_ACTUAL]);
    const ytdActual = toNum(raw[COL.YTD_ACTUAL]);
    const periodPY = toNum(raw[COL.PERIOD_PY]);
    const ytdPY = toNum(raw[COL.YTD_PY]);

    // Section headers have no numeric data in any column
    const isSectionHeader =
      periodActual === null &&
      ytdActual === null &&
      periodPY === null &&
      ytdPY === null;

    rows.push({
      name,
      periodActual,
      periodPctOfSales: toNum(raw[COL.PERIOD_PCT]),
      periodPriorYear: periodPY,
      periodPriorYearPct: toNum(raw[COL.PERIOD_PY_PCT]),
      periodVariance: toNum(raw[COL.PERIOD_VAR]),
      periodVariancePct: toNum(raw[COL.PERIOD_VAR_PCT]),
      ytdActual,
      ytdPctOfSales: toNum(raw[COL.YTD_PCT]),
      ytdPriorYear: ytdPY,
      ytdPriorYearPct: toNum(raw[COL.YTD_PY_PCT]),
      ytdVariance: toNum(raw[COL.YTD_VAR]),
      ytdVariancePct: toNum(raw[COL.YTD_VAR_PCT]),
      isTotal: name.startsWith("Total"),
      isSectionHeader,
    });
  }

  return { periodEnding, location, rows };
}
