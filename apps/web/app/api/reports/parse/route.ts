import { type NextRequest, NextResponse } from "next/server";
import { read, utils } from "xlsx";
import type { WorkSheet } from "xlsx";
import { parsePnL } from "@lib/reports/parse-pnl";
import { parseBalanceSheet } from "@lib/reports/parse-balance-sheet";
import type { ReportParseResponse, ValidationIssue } from "@lib/reports/types";
import { getServerSession } from "@lib/auth/session";
import { db } from "@lib/server/db";
import { accountMappings } from "@lib/db/schema";
import { inArray } from "drizzle-orm";

export const runtime = "nodejs";

type FileField = "currentYearBS" | "priorYearBS" | "commissaryPnL" | "consolidatedPnL";
type FileType = "pnl" | "bs";

const FILE_CONFIGS: Record<FileField, { label: string; type: FileType }> = {
  currentYearBS: { label: "Current Year Balance Sheet", type: "bs" },
  priorYearBS: { label: "Prior Year Balance Sheet", type: "bs" },
  commissaryPnL: { label: "Commissary P&L", type: "pnl" },
  consolidatedPnL: { label: "Consolidated P&L", type: "pnl" },
};

// R365 structure markers (row 1, col 0, 0-based)
const PNL_MARKER = "period ending";
const BS_MARKER = "as of";

function getCell(sheet: WorkSheet, row: number, col: number): string {
  const raw = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  return String(raw[row]?.[col as never] ?? "").trim().toLowerCase();
}

async function parseAndValidateFile(
  file: File,
  field: FileField
): Promise<{ sheet: WorkSheet; issue?: ValidationIssue }> {
  const config = FILE_CONFIGS[field];

  // Validate file extension
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return {
      sheet: {} as WorkSheet,
      issue: {
        severity: "error",
        type: "parse_error",
        source: field,
        message: `${config.label}: file must be an .xlsx file (got "${file.name}")`,
      },
    };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return {
      sheet: {} as WorkSheet,
      issue: {
        severity: "error",
        type: "parse_error",
        source: field,
        message: `${config.label}: could not read file — it may be corrupted`,
      },
    };
  }

  let sheet: WorkSheet;
  try {
    const wb = read(buffer, { type: "array" });
    if (!wb.SheetNames.length) {
      return {
        sheet: {} as WorkSheet,
        issue: {
          severity: "error",
          type: "empty_file",
          source: field,
          message: `${config.label}: the workbook contains no sheets`,
        },
      };
    }
    sheet = wb.Sheets[wb.SheetNames[0]];
  } catch {
    return {
      sheet: {} as WorkSheet,
      issue: {
        severity: "error",
        type: "parse_error",
        source: field,
        message: `${config.label}: not a valid Excel file — make sure to export as .xlsx from R365`,
      },
    };
  }

  // Validate R365 structure marker in row 1, col 0
  const marker = getCell(sheet, 1, 0);
  const expectedMarker = config.type === "pnl" ? PNL_MARKER : BS_MARKER;

  if (!marker.includes(expectedMarker)) {
    const expected =
      config.type === "pnl"
        ? '"Period Ending …" in cell A2'
        : '"As of …" in cell A2';
    return {
      sheet,
      issue: {
        severity: "error",
        type: "parse_error",
        source: field,
        message: `${config.label}: unexpected R365 format — expected ${expected}. Got: "${marker || "(empty)"}"`,
      },
    };
  }

  return { sheet };
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<ReportParseResponse>> {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { success: false, issues: [], error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const formData = await req.formData();

    // Check all 4 files are present
    const presenceIssues: ValidationIssue[] = [];
    for (const [field, config] of Object.entries(FILE_CONFIGS)) {
      const file = formData.get(field) as File | null;
      if (!file || file.size === 0) {
        presenceIssues.push({
          severity: "error",
          type: "missing_sheet",
          source: field,
          message: `${config.label}: file is required`,
        });
      }
    }

    if (presenceIssues.length > 0) {
      return NextResponse.json(
        { success: false, issues: presenceIssues, error: "Required files are missing" },
        { status: 400 }
      );
    }

    // Parse and validate each file — run in parallel but collect all errors
    const fields: FileField[] = ["currentYearBS", "priorYearBS", "commissaryPnL", "consolidatedPnL"];
    const results = await Promise.all(
      fields.map((field) =>
        parseAndValidateFile(formData.get(field) as File, field).then((r) => ({
          field,
          ...r,
        }))
      )
    );

    const formatIssues = results.filter((r) => r.issue).map((r) => r.issue!);
    if (formatIssues.length > 0) {
      return NextResponse.json(
        { success: false, issues: formatIssues, error: "One or more files have format errors" },
        { status: 400 }
      );
    }

    const sheetMap = Object.fromEntries(
      results.map((r) => [r.field, r.sheet])
    ) as Record<FileField, WorkSheet>;

    const parsedData = {
      currentYearBS: parseBalanceSheet(sheetMap.currentYearBS),
      priorYearBS: parseBalanceSheet(sheetMap.priorYearBS),
      commissaryPnL: parsePnL(sheetMap.commissaryPnL),
      consolidatedPnL: parsePnL(sheetMap.consolidatedPnL),
    };

    // Collect atomic account names that carry a non-zero balance across the
    // uploaded files (consolidated P&L + both balance sheets). Accounts that are
    // zero everywhere contribute nothing to any report, so we don't force the
    // user to map them or block generation on their behalf.
    const nonZero = (v: number | null | undefined) =>
      v !== null && v !== undefined && v !== 0;

    // Track each account's statement ('pnl' | 'bs') from its source file, so new
    // accounts are classified before they have a group. P&L and BS account names
    // are disjoint, so there is no conflict.
    const accountType = new Map<string, "pnl" | "bs">();

    for (const r of [...parsedData.consolidatedPnL.rows, ...parsedData.commissaryPnL.rows]) {
      if (r.isSectionHeader || r.isTotal) continue;
      if (
        nonZero(r.periodActual) ||
        nonZero(r.ytdActual) ||
        nonZero(r.periodPriorYear) ||
        nonZero(r.ytdPriorYear)
      ) {
        accountType.set(r.name, "pnl");
      }
    }

    for (const r of [...parsedData.currentYearBS.rows, ...parsedData.priorYearBS.rows]) {
      if (r.isSectionHeader || r.isTotal) continue;
      if (nonZero(r.ytd)) accountType.set(r.name, "bs");
    }

    const accountNames = [...accountType.keys()];

    let unmappedAccounts: string[] = [];

    if (accountNames.length > 0) {
      const existing = await db
        .select({
          accountName: accountMappings.accountName,
          groupId: accountMappings.groupId,
          ignored: accountMappings.ignored,
        })
        .from(accountMappings)
        .where(inArray(accountMappings.accountName, accountNames));

      const knownMap = new Map(existing.map((r) => [r.accountName, r]));

      // Insert accounts that have never been seen before as unmapped records
      // so they appear in the Account Mapping page for the user to assign
      const newAccounts = accountNames.filter((name) => !knownMap.has(name));
      if (newAccounts.length > 0) {
        const now = new Date();
        await db
          .insert(accountMappings)
          .values(newAccounts.map((name) => ({ accountName: name, groupId: null, reportType: accountType.get(name)!, ignored: false, createdAt: now, updatedAt: now })))
          .onConflictDoNothing({ target: accountMappings.accountName });
      }

      for (const name of accountNames) {
        const entry = knownMap.get(name);
        if (!entry) {
          unmappedAccounts.push(name); // newly inserted — unmapped by definition
        } else if (!entry.ignored && entry.groupId === null) {
          unmappedAccounts.push(name); // previously seen but still unassigned
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
      issues: [],
      unmappedAccounts,
    });
  } catch (err) {
    console.error("[reports/parse]", err);
    return NextResponse.json(
      { success: false, issues: [], error: "Failed to process files" },
      { status: 500 }
    );
  }
}
