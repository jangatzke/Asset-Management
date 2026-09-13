export type CsvCell = string | number | boolean | null | undefined;

/** Exports the rows currently rendered by a list view. */
export function exportCsv(filename: string, headers: string[], rows: CsvCell[][]): void {
  const quote = (value: CsvCell) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const contents = [headers, ...rows].map((row) => row.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${contents}`], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
