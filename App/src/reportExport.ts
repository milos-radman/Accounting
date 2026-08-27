import * as XLSX from 'xlsx';

export interface Sheet {
  name: string;
  header: string[];
  rows: (string | number | null)[][];
}

// Export one or more sheets to a real .xlsx workbook. Numbers stay numbers (not locale-formatted
// strings), so it opens in Excel and imports cleanly as a SharePoint / Power BI data source.
export function exportWorkbook(filename: string, sheets: Sheet[]) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const s of sheets) {
    const aoa: (string | number | null)[][] = [s.header, ...s.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = s.header.map((_, i) => ({ wch: Math.min(48, Math.max(10, ...aoa.map(r => String(r[i] ?? '').length + 2))) }));
    // Sheet names are max 31 chars and must be unique within a workbook.
    let name = (s.name || 'Sheet').slice(0, 31);
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${s.name.slice(0, 28)} ${n++}`;
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

// Convenience for a single-sheet export.
export function exportGrid(filename: string, header: string[], rows: (string | number | null)[][], sheetName = 'Data') {
  exportWorkbook(filename, [{ name: sheetName, header, rows }]);
}

// Safe, sortable timestamp fragment for export file names.
export const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '').replace(/-/g, '');
