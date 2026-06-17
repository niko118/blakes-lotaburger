import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@lib/auth/auth-options";
import { db } from "@lib/server/db";
import { reportGroups, accountMappings } from "@lib/db/schema";
import { generateReport, type ReportType } from "@lib/reports/generate-reports";
import type { ParsedFiles } from "@lib/reports/types";

export const runtime = "nodejs";

const VALID_REPORT_TYPES: ReportType[] = ["cm-vs-pm", "cy-vs-py", "summary-pnl", "balance-sheet"];

const REPORT_FILENAMES: Record<ReportType, string> = {
  "cm-vs-pm": "cm-vs-pm-detail.xlsx",
  "cy-vs-py": "cy-vs-py-detail.xlsx",
  "summary-pnl": "summary-pnl.xlsx",
  "balance-sheet": "balance-sheet-summary.xlsx",
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { reportType: ReportType; parsedFiles: ParsedFiles };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { reportType, parsedFiles } = body;

  if (!VALID_REPORT_TYPES.includes(reportType)) {
    return NextResponse.json({ error: `Invalid report type: ${reportType}` }, { status: 400 });
  }

  if (!parsedFiles) {
    return NextResponse.json({ error: "Parsed files are required" }, { status: 400 });
  }

  try {
    // Load groups and mappings from DB for summary reports
    let groups: { id: number; name: string; parentId: number | null; reportType: string; sortOrder: number; subtotalAfter: boolean; contributesAs: string | null; eliminateCommissary: boolean }[] = [];
    let mappings: { accountName: string; groupId: number | null; ignored: boolean }[] = [];

    // All P&L reports (summary + the two detail tabs) and the balance sheet are
    // seed-driven, so every report needs the groups/mappings.
    {
      [groups, mappings] = await Promise.all([
        db.select().from(reportGroups).orderBy(reportGroups.sortOrder),
        db.select({
          accountName: accountMappings.accountName,
          groupId: accountMappings.groupId,
          ignored: accountMappings.ignored,
        }).from(accountMappings),
      ]);
    }

    const buffer = generateReport({ parsedFiles, reportType, groups, mappings });
    const filename = REPORT_FILENAMES[reportType];

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("[reports/generate] Error generating report:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
