// Row types for parsed R365 reports

export interface PnLRow {
  name: string;
  periodActual: number | null;
  periodPctOfSales: number | null;
  periodPriorYear: number | null;
  periodPriorYearPct: number | null;
  periodVariance: number | null;
  periodVariancePct: number | null;
  ytdActual: number | null;
  ytdPctOfSales: number | null;
  ytdPriorYear: number | null;
  ytdPriorYearPct: number | null;
  ytdVariance: number | null;
  ytdVariancePct: number | null;
  isTotal: boolean;
  isSectionHeader: boolean;
}

export interface BalanceSheetRow {
  name: string;
  ytd: number | null;
  isTotal: boolean;
  isSectionHeader: boolean;
}

export interface ParsedPnL {
  periodEnding: string;
  location: string;
  rows: PnLRow[];
}

export interface ParsedBalanceSheet {
  asOf: string;
  rows: BalanceSheetRow[];
}

export interface ParsedFiles {
  currentYearBS: ParsedBalanceSheet;
  priorYearBS: ParsedBalanceSheet;
  commissaryPnL: ParsedPnL;
  consolidatedPnL: ParsedPnL;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  type: "parse_error" | "missing_sheet" | "empty_file";
  source: string;
  message: string;
}

export interface ReportParseResponse {
  success: boolean;
  data?: ParsedFiles;
  issues: ValidationIssue[];
  unmappedAccounts?: string[];
  error?: string;
}
