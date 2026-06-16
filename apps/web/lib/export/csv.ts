export interface CSVColumn {
  key: string;
  label: string;
  type?: string;
}

/**
 * Convert tabular data to a CSV string.
 */
export function tableToCSV<T extends Record<string, unknown>>(
  columns: CSVColumn[],
  rows: T[]
): string {
  const headers = columns.map((c) => c.label);

  const dataRows = rows.map((row) =>
    columns.map((col) => {
      const value = row[col.key];
      if (value === null || value === undefined) return "";
      if (col.type === "CURRENCY" || col.type === "currency") {
        return Number(value).toFixed(2);
      }
      if (col.type === "PERCENT") {
        return Number(value).toFixed(1);
      }
      return String(value);
    })
  );

  return [headers, ...dataRows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

/**
 * Trigger a CSV file download in the browser.
 */
export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Generate an export filename with today's date appended.
 */
export function generateExportFilename(
  baseName: string,
  extension: "csv" | "pdf" = "csv"
): string {
  const date = new Date().toISOString().split("T")[0];
  return `${baseName}-${date}.${extension}`;
}
