"use client";

import { useState, useRef } from "react";
import { read, utils } from "xlsx";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  BarChart2,
  FileDown,
  Lock,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import type { ReportParseResponse, ParsedFiles } from "@lib/reports/types";
import type { ReportType } from "@lib/reports/generate-reports";

type FileKey = "currentYearBS" | "priorYearBS" | "commissaryPnL" | "consolidatedPnL";
type FileType = "pnl" | "bs";

interface FileSlot {
  key: FileKey;
  label: string;
  description: string;
  example: string;
  type: FileType;
}

const FILE_SLOTS: FileSlot[] = [
  {
    key: "currentYearBS",
    label: "Current Year Balance Sheet",
    description: "FY_PD_BS for the current fiscal year",
    example: "FY25 PD12 BS.xlsx",
    type: "bs",
  },
  {
    key: "priorYearBS",
    label: "Prior Year Balance Sheet",
    description: "FY_PD_BS for the prior fiscal year",
    example: "FY24 PD12 BS.xlsx",
    type: "bs",
  },
  {
    key: "commissaryPnL",
    label: "Commissary P&L",
    description: "Profit & Loss — Location 500",
    example: "FY25 PD12 COMM Profit and Loss.xlsx",
    type: "pnl",
  },
  {
    key: "consolidatedPnL",
    label: "Consolidated P&L",
    description: "Profit & Loss — All locations",
    example: "FY25 PD12 Consolo Profit and Loss.xlsx",
    type: "pnl",
  },
];

interface ReportDefinition {
  type: ReportType;
  name: string;
  desc: string;
  requiresMapping: boolean;
}

const REPORTS: ReportDefinition[] = [
  {
    type: "cm-vs-pm",
    name: "CM vs PM Detail",
    desc: "Current period vs prior year period, full account breakdown",
    requiresMapping: false,
  },
  {
    type: "cy-vs-py",
    name: "CY vs PY Detail",
    desc: "Current YTD vs prior year YTD, full account breakdown",
    requiresMapping: false,
  },
  {
    type: "summary-pnl",
    name: "Summary P&L",
    desc: "High-level P&L grouped by category with commissary elimination",
    requiresMapping: true,
  },
  {
    type: "balance-sheet",
    name: "Balance Sheet Summary",
    desc: "Consolidated balance sheet grouped by category, CY vs PY",
    requiresMapping: true,
  },
];

const styles = {
  page: "space-y-8",
  header: "space-y-1",
  title: "text-3xl font-bold text-steel tracking-tight",
  subtitle: "text-dark-grey text-lg",

  filesGrid: "grid gap-4 md:grid-cols-2",
  fileCard: "bg-white border-cloud cursor-pointer hover:border-primary/40 transition-colors select-none",
  fileCardActive: "border-primary bg-primary/5",
  fileCardError: "border-red/40 bg-red/5",
  fileCardHeaderPadding: "px-4 pt-4 pb-2",
  fileCardHeaderRow: "flex items-start justify-between",
  fileCardInnerWrapper: "min-w-0",
  fileCardLabel: "text-sm font-semibold text-steel",
  fileCardDesc: "text-xs text-silver mt-0.5",
  fileCardExample: "text-xs text-rain font-mono mt-1",
  fileCardIcon: "h-5 w-5 text-silver flex-shrink-0 mt-0.5",
  fileCardIconActive: "text-primary",
  fileCardIconError: "text-red",
  fileCardContentPadding: "px-4 pb-4",
  fileSelectedRow: "flex items-center gap-2 mt-2",
  fileSelectedIconWrapper: "min-w-0",
  fileSelectedIcon: "h-4 w-4 text-green flex-shrink-0",
  fileErrorIcon: "h-4 w-4 text-red flex-shrink-0",
  fileSelectedName: "text-xs font-medium text-steel truncate",
  fileSelectedSize: "text-xs text-silver whitespace-nowrap",
  fileErrorMessage: "text-xs text-red mt-1",
  fileNoFile: "text-xs text-rain mt-2",
  fileInput: "hidden",

  actionRow: "flex items-center justify-between",
  actionCount: "text-sm text-silver",
  actionCountBold: "font-semibold text-steel",
  loaderIcon: "h-4 w-4 mr-2 animate-spin",
  uploadIcon: "h-4 w-4 mr-2",

  resultsSection: "space-y-6",
  sectionTitle: "text-xl font-semibold text-steel",
  subsectionWrapper: "space-y-4",
  errorsWrapper: "space-y-3",

  summaryGrid: "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
  summaryCard: "bg-white border-cloud",
  summaryCardHeaderPadding: "px-4 pt-4 pb-0",
  summaryCardContentPadding: "px-4 pb-4",
  summaryLabel: "text-xs font-medium text-silver uppercase tracking-wide",
  summaryDate: "text-xs text-rain mt-0.5",
  summaryValue: "text-3xl font-bold text-primary mt-2",
  summaryValueLabel: "text-xs text-silver mt-0.5",

  unmappedBanner: "flex items-start gap-3 p-4 rounded-lg bg-yellow/5 border border-yellow/30",
  unmappedIcon: "h-5 w-5 text-yellow flex-shrink-0 mt-0.5",
  unmappedInner: "min-w-0 flex-1",
  unmappedTitle: "text-sm font-semibold text-steel",
  unmappedBody: "text-sm text-dark-grey mt-0.5",
  unmappedList: "mt-2 space-y-0.5 max-h-40 overflow-y-auto",
  unmappedListItem: "text-xs text-silver font-mono",
  unmappedLink: "mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline",
  unmappedLinkIcon: "h-3 w-3",

  issuesList: "space-y-2",
  issueError: "flex items-start gap-3 p-3 rounded-lg bg-red/5 border border-red/20",
  issueErrorIcon: "h-4 w-4 text-red flex-shrink-0 mt-0.5",
  issueText: "text-sm text-steel",

  reportsGrid: "grid gap-3 sm:grid-cols-2",
  reportCard: "bg-white border-cloud",
  reportCardHeaderPadding: "px-4 pt-4 pb-2",
  reportCardHeaderRow: "flex items-start justify-between gap-2",
  reportCardTitle: "text-sm font-semibold text-steel",
  reportCardDesc: "text-xs text-silver mt-0.5",
  reportCardBlocked: "text-xs text-yellow mt-1 flex items-center gap-1",
  reportCardBlockedIcon: "h-3 w-3",
  reportCardIcon: "h-4 w-4 text-silver flex-shrink-0 mt-0.5",
  reportCardContentPadding: "px-4 pb-4",
  reportLoaderIcon: "h-3.5 w-3.5 mr-1.5 animate-spin",
  reportDownloadIcon: "h-3.5 w-3.5 mr-1.5",
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function validateFileFormat(file: File, type: FileType): Promise<string | null> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return `Must be an .xlsx file`;
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return "Could not read file — it may be corrupted";
  }

  try {
    const wb = read(buffer, { type: "array" });
    if (!wb.SheetNames.length) {
      return "The workbook contains no sheets";
    }

    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
    const cell = String(rows[1]?.[0] ?? "").trim().toLowerCase();

    if (type === "pnl" && !cell.includes("period ending")) {
      return `Expected a P&L file (cell A2 should say "Period Ending …"). Got: "${rows[1]?.[0] ?? "empty"}"`;
    }
    if (type === "bs" && !cell.includes("as of")) {
      return `Expected a Balance Sheet file (cell A2 should say "As of …"). Got: "${rows[1]?.[0] ?? "empty"}"`;
    }
  } catch {
    return "Not a valid Excel file — export as .xlsx from R365";
  }

  return null;
}

async function downloadReport(reportType: ReportType, parsedFiles: ParsedFiles): Promise<void> {
  const res = await fetch("/api/reports/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportType, parsedFiles }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to generate report" }));
    throw new Error(err.error ?? "Failed to generate report");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  a.download = match?.[1] ?? `${reportType}.xlsx`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function UploadPage() {
  const [files, setFiles] = useState<Record<FileKey, File | null>>({
    currentYearBS: null,
    priorYearBS: null,
    commissaryPnL: null,
    consolidatedPnL: null,
  });
  const [fileErrors, setFileErrors] = useState<Record<FileKey, string | null>>({
    currentYearBS: null,
    priorYearBS: null,
    commissaryPnL: null,
    consolidatedPnL: null,
  });
  const [validating, setValidating] = useState<Record<FileKey, boolean>>({
    currentYearBS: false,
    priorYearBS: false,
    commissaryPnL: false,
    consolidatedPnL: false,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ReportParseResponse | null>(null);
  const [generatingReport, setGeneratingReport] = useState<ReportType | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const inputRefs = useRef<Record<FileKey, HTMLInputElement | null>>({
    currentYearBS: null,
    priorYearBS: null,
    commissaryPnL: null,
    consolidatedPnL: null,
  });

  const hasAnyFileError = Object.values(fileErrors).some(Boolean);
  const validCount = FILE_SLOTS.filter((s) => files[s.key] && !fileErrors[s.key]).length;
  const allValid = validCount === 4;
  const unmappedAccounts = result?.unmappedAccounts ?? [];
  const hasUnmapped = unmappedAccounts.length > 0;

  const handleFileChange = async (slot: FileSlot, file: File | null) => {
    setFiles((prev) => ({ ...prev, [slot.key]: file }));
    setFileErrors((prev) => ({ ...prev, [slot.key]: null }));
    setResult(null);
    setGenerateError(null);

    if (!file) return;

    setValidating((prev) => ({ ...prev, [slot.key]: true }));
    const error = await validateFileFormat(file, slot.type);
    setFileErrors((prev) => ({ ...prev, [slot.key]: error }));
    setValidating((prev) => ({ ...prev, [slot.key]: false }));
  };

  const handleProcess = async () => {
    if (!allValid || isProcessing) return;

    setIsProcessing(true);
    setResult(null);
    setGenerateError(null);

    try {
      const formData = new FormData();
      formData.append("currentYearBS", files.currentYearBS!);
      formData.append("priorYearBS", files.priorYearBS!);
      formData.append("commissaryPnL", files.commissaryPnL!);
      formData.append("consolidatedPnL", files.consolidatedPnL!);

      const res = await fetch("/api/reports/parse", {
        method: "POST",
        body: formData,
      });

      const data: ReportParseResponse = await res.json();
      setResult(data);
    } catch {
      setResult({
        success: false,
        issues: [],
        error: "Connection error while processing files",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerate = async (report: ReportDefinition) => {
    if (!result?.data || generatingReport) return;

    setGeneratingReport(report.type);
    setGenerateError(null);

    try {
      await downloadReport(report.type, result.data);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setGeneratingReport(null);
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Financial Reports</h1>
        <p className={styles.subtitle}>
          Upload the 4 R365 files to generate reports for the period
        </p>
      </div>

      {/* File selection grid */}
      <div className={styles.filesGrid}>
        {FILE_SLOTS.map((slot) => {
          const file = files[slot.key];
          const error = fileErrors[slot.key];
          const isValidating = validating[slot.key];
          const isActive = !!file && !error;

          return (
            <Card
              key={slot.key}
              className={`${styles.fileCard} ${error ? styles.fileCardError : isActive ? styles.fileCardActive : ""}`}
              onClick={() => inputRefs.current[slot.key]?.click()}
            >
              <CardHeader className={styles.fileCardHeaderPadding}>
                <div className={styles.fileCardHeaderRow}>
                  <div className={styles.fileCardInnerWrapper}>
                    <CardTitle className={styles.fileCardLabel}>{slot.label}</CardTitle>
                    <p className={styles.fileCardDesc}>{slot.description}</p>
                    <p className={styles.fileCardExample}>{slot.example}</p>
                  </div>
                  <FileSpreadsheet
                    className={`${styles.fileCardIcon} ${error ? styles.fileCardIconError : isActive ? styles.fileCardIconActive : ""}`}
                  />
                </div>
              </CardHeader>
              <CardContent className={styles.fileCardContentPadding}>
                {isValidating ? (
                  <div className={styles.fileSelectedRow}>
                    <Loader2 className={styles.loaderIcon} />
                    <p className={styles.fileNoFile}>Validating file…</p>
                  </div>
                ) : file && error ? (
                  <>
                    <div className={styles.fileSelectedRow}>
                      <XCircle className={styles.fileErrorIcon} />
                      <div className={styles.fileSelectedIconWrapper}>
                        <p className={styles.fileSelectedName}>{file.name}</p>
                        <p className={styles.fileSelectedSize}>{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <p className={styles.fileErrorMessage}>{error}</p>
                  </>
                ) : file ? (
                  <div className={styles.fileSelectedRow}>
                    <CheckCircle2 className={styles.fileSelectedIcon} />
                    <div className={styles.fileSelectedIconWrapper}>
                      <p className={styles.fileSelectedName}>{file.name}</p>
                      <p className={styles.fileSelectedSize}>{formatBytes(file.size)}</p>
                    </div>
                  </div>
                ) : (
                  <p className={styles.fileNoFile}>Click to select a .xlsx file</p>
                )}
              </CardContent>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className={styles.fileInput}
                ref={(el) => {
                  inputRefs.current[slot.key] = el;
                }}
                onChange={(e) => handleFileChange(slot, e.target.files?.[0] ?? null)}
                onClick={(e) => e.stopPropagation()}
              />
            </Card>
          );
        })}
      </div>

      {/* Process button */}
      <div className={styles.actionRow}>
        <p className={styles.actionCount}>
          <span className={styles.actionCountBold}>{validCount} of 4</span> files ready
          {hasAnyFileError && (
            <span> — fix errors above before processing</span>
          )}
        </p>
        <Button onClick={handleProcess} disabled={!allValid || isProcessing} size="lg">
          {isProcessing ? (
            <>
              <Loader2 className={styles.loaderIcon} />
              Processing...
            </>
          ) : (
            <>
              <Upload className={styles.uploadIcon} />
              Process Files
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className={styles.resultsSection}>
          {result.success && result.data ? (
            <>
              {/* Parse summary */}
              <div className={styles.subsectionWrapper}>
                <h2 className={styles.sectionTitle}>Files Processed</h2>
                <div className={styles.summaryGrid}>
                  <Card className={styles.summaryCard}>
                    <CardHeader className={styles.summaryCardHeaderPadding}>
                      <p className={styles.summaryLabel}>Current Year Balance Sheet</p>
                      <p className={styles.summaryDate}>As of {result.data.currentYearBS.asOf}</p>
                    </CardHeader>
                    <CardContent className={styles.summaryCardContentPadding}>
                      <p className={styles.summaryValue}>
                        {result.data.currentYearBS.rows.filter((r) => !r.isSectionHeader && !r.isTotal).length}
                      </p>
                      <p className={styles.summaryValueLabel}>accounts</p>
                    </CardContent>
                  </Card>

                  <Card className={styles.summaryCard}>
                    <CardHeader className={styles.summaryCardHeaderPadding}>
                      <p className={styles.summaryLabel}>Prior Year Balance Sheet</p>
                      <p className={styles.summaryDate}>As of {result.data.priorYearBS.asOf}</p>
                    </CardHeader>
                    <CardContent className={styles.summaryCardContentPadding}>
                      <p className={styles.summaryValue}>
                        {result.data.priorYearBS.rows.filter((r) => !r.isSectionHeader && !r.isTotal).length}
                      </p>
                      <p className={styles.summaryValueLabel}>accounts</p>
                    </CardContent>
                  </Card>

                  <Card className={styles.summaryCard}>
                    <CardHeader className={styles.summaryCardHeaderPadding}>
                      <p className={styles.summaryLabel}>Commissary P&L</p>
                      <p className={styles.summaryDate}>{result.data.commissaryPnL.periodEnding}</p>
                    </CardHeader>
                    <CardContent className={styles.summaryCardContentPadding}>
                      <p className={styles.summaryValue}>
                        {result.data.commissaryPnL.rows.filter((r) => !r.isSectionHeader && !r.isTotal).length}
                      </p>
                      <p className={styles.summaryValueLabel}>accounts</p>
                    </CardContent>
                  </Card>

                  <Card className={styles.summaryCard}>
                    <CardHeader className={styles.summaryCardHeaderPadding}>
                      <p className={styles.summaryLabel}>Consolidated P&L</p>
                      <p className={styles.summaryDate}>{result.data.consolidatedPnL.periodEnding}</p>
                    </CardHeader>
                    <CardContent className={styles.summaryCardContentPadding}>
                      <p className={styles.summaryValue}>
                        {result.data.consolidatedPnL.rows.filter((r) => !r.isSectionHeader && !r.isTotal).length}
                      </p>
                      <p className={styles.summaryValueLabel}>accounts</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Unmapped accounts warning */}
              {hasUnmapped && (
                <div className={styles.unmappedBanner}>
                  <AlertTriangle className={styles.unmappedIcon} />
                  <div className={styles.unmappedInner}>
                    <p className={styles.unmappedTitle}>
                      {unmappedAccounts.length} unmapped{" "}
                      {unmappedAccounts.length === 1 ? "account" : "accounts"} detected
                    </p>
                    <p className={styles.unmappedBody}>
                      Summary reports require all accounts to be mapped to a group.
                      Detail reports are still available below.
                    </p>
                    <ul className={styles.unmappedList}>
                      {unmappedAccounts.map((name) => (
                        <li key={name} className={styles.unmappedListItem}>
                          • {name}
                        </li>
                      ))}
                    </ul>
                    <Link href="/reports/mapping" className={styles.unmappedLink}>
                      <ExternalLink className={styles.unmappedLinkIcon} />
                      Go to Account Mapping to assign these accounts
                    </Link>
                  </div>
                </div>
              )}

              {/* Generate error */}
              {generateError && (
                <div className={styles.issueError}>
                  <XCircle className={styles.issueErrorIcon} />
                  <p className={styles.issueText}>{generateError}</p>
                </div>
              )}

              {/* Report generation */}
              <div className={styles.subsectionWrapper}>
                <h2 className={styles.sectionTitle}>Generate Reports</h2>
                <div className={styles.reportsGrid}>
                  {REPORTS.map((report) => {
                    const isBlocked = report.requiresMapping && hasUnmapped;
                    const isGenerating = generatingReport === report.type;
                    const isDisabled = isBlocked || !!generatingReport;

                    return (
                      <Card key={report.type} className={styles.reportCard}>
                        <CardHeader className={styles.reportCardHeaderPadding}>
                          <div className={styles.reportCardHeaderRow}>
                            <div>
                              <CardTitle className={styles.reportCardTitle}>{report.name}</CardTitle>
                              <p className={styles.reportCardDesc}>{report.desc}</p>
                              {isBlocked && (
                                <p className={styles.reportCardBlocked}>
                                  <Lock className={styles.reportCardBlockedIcon} />
                                  Requires all accounts to be mapped
                                </p>
                              )}
                            </div>
                            <BarChart2 className={styles.reportCardIcon} />
                          </div>
                        </CardHeader>
                        <CardContent className={styles.reportCardContentPadding}>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isDisabled}
                            onClick={() => handleGenerate(report)}
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className={styles.reportLoaderIcon} />
                                Generating...
                              </>
                            ) : (
                              <>
                                <FileDown className={styles.reportDownloadIcon} />
                                Download
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.errorsWrapper}>
              <h2 className={styles.sectionTitle}>Processing Errors</h2>
              <div className={styles.issuesList}>
                {result.error && (
                  <div className={styles.issueError}>
                    <XCircle className={styles.issueErrorIcon} />
                    <p className={styles.issueText}>{result.error}</p>
                  </div>
                )}
                {result.issues.map((issue, i) => (
                  <div key={i} className={styles.issueError}>
                    <XCircle className={styles.issueErrorIcon} />
                    <p className={styles.issueText}>{issue.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
