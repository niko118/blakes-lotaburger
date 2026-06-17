import { utils } from "xlsx";
import type { WorkSheet } from "xlsx";
import type { ParsedBalanceSheet, BalanceSheetRow } from "./types";

// Column indices in the R365 Balance Sheet export (0-based)
const COL_NAME = 0;
const COL_VALUE = 3;

// Data rows start after the 6-row header block (title, date, blank, company, blank, "YTD")
const DATA_START_ROW = 6;

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

export function parseBalanceSheet(ws: WorkSheet): ParsedBalanceSheet {
  const rawRows = utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  const asOf = String(rawRows[1]?.[0] ?? "")
    .replace("As of ", "")
    .trim();

  const rows: BalanceSheetRow[] = [];

  for (let i = DATA_START_ROW; i < rawRows.length; i++) {
    const raw = rawRows[i] as unknown[];
    const name = String(raw[COL_NAME] ?? "").trim();
    if (!name) continue;

    const ytd = toNum(raw[COL_VALUE]);

    rows.push({
      name,
      ytd,
      isTotal: name.startsWith("Total"),
      // Section headers (ASSETS, LIABILITIES, etc.) have no numeric value
      isSectionHeader: ytd === null,
    });
  }

  return { asOf, rows };
}
