/**
 * Utilitaires de formatage, calculs temporels et exports (CSV, Excel, PDF).
 */

export function generateUniqueId(prefix = 'ow'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

export function formatDurationHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatDurationHM(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours === 0) {
    return `${minutes} min`;
  }
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

export function formatTimeShort(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeWithSeconds(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateFr(isoOrYmd: string): string {
  const date = new Date(isoOrYmd);
  if (Number.isNaN(date.getTime())) return isoOrYmd;
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTimeFr(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateLongFr(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function toLocalDateTimeInputValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function toYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isSameDayYmd(isoOrYmd: string, targetYmd: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
    return isoOrYmd === targetYmd;
  }
  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return false;
  return toYmd(d) === targetYmd;
}

export function isWithinDays(isoOrYmd: string, referenceDate: Date, days: number): boolean {
  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return false;
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

export function isSameMonth(isoOrYmd: string, year: number, monthIndex: number): boolean {
  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() === monthIndex;
}

export function isSameQuarter(isoOrYmd: string, year: number, monthIndex: number): boolean {
  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return false;
  const targetQ = Math.floor(monthIndex / 3);
  const dQ = Math.floor(d.getMonth() / 3);
  return d.getFullYear() === year && dQ === targetQ;
}

export function isSameYear(isoOrYmd: string, year: number): boolean {
  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === year;
}

export function isWithinDateRange(isoOrYmd: string, startYmd: string, endYmd: string): boolean {
  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return false;
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd) ? isoOrYmd : toYmd(d);
  if (startYmd && ymd < startYmd) return false;
  if (endYmd && ymd > endYmd) return false;
  return true;
}

export function computeLateMinutes(
  actualIso: string | null,
  plannedHHmm: string,
  toleranceMinutes = 0
): number {
  if (!actualIso || !/^\d{2}:\d{2}$/.test(plannedHHmm)) return 0;
  const actual = new Date(actualIso);
  if (Number.isNaN(actual.getTime())) return 0;
  const [ph, pm] = plannedHHmm.split(':').map(Number);
  const planned = new Date(actual);
  planned.setHours(ph, pm, 0, 0);
  const diffMin = Math.floor((actual.getTime() - planned.getTime()) / 60000);
  return diffMin > toleranceMinutes ? diffMin : 0;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    headers.map(escapeCell).join(';'),
    ...rows.map((row) => row.map(escapeCell).join(';')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

/**
 * Exporte un classeur compatible Microsoft Excel (.xls SpreadsheetML XML).
 */
export function downloadExcel(
  filename: string,
  sheetTitle: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const xmlEscape = (v: string | number) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const headerXml = headers
    .map((h) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
    .join('');

  const rowsXml = rows
    .map((r) => {
      const cells = r
        .map((cell) => {
          const isNum = typeof cell === 'number' && !Number.isNaN(cell);
          return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${xmlEscape(cell)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#7624A8" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${xmlEscape(sheetTitle.slice(0, 30))}">
  <Table>
   <Row>${headerXml}</Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  triggerDownload(blob, filename);
}

/**
 * Génère un fichier PDF 1.4 valide sans dépendance externe ni popup bloquée.
 */
export function downloadPdfReport(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const toPdfAscii = (input: string) =>
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

  const lines: string[] = [
    title,
    subtitle,
    '----------------------------------------------------------------------------------------------------',
    headers.join(' | '),
    '----------------------------------------------------------------------------------------------------',
    ...rows.slice(0, 42).map((r) => r.map((c) => String(c ?? '')).join(' | ')),
    '----------------------------------------------------------------------------------------------------',
    '(c) 2026 AppLoumProject - apploumproject@gmail.com',
  ];

  const streamCommands = ['BT', '/F1 10 Tf', '40 800 Td', '15 TL'];
  lines.forEach((line, idx) => {
    const truncated = line.slice(0, 105);
    if (idx === 0) {
      streamCommands.push(`/F1 13 Tf (${toPdfAscii(truncated)}) Tj T* /F1 9 Tf`);
    } else {
      streamCommands.push(`(${toPdfAscii(truncated)}) Tj T*`);
    }
  });
  streamCommands.push('ET');
  const streamData = streamCommands.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamData.length} >>\nstream\n${streamData}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  triggerDownload(blob, filename);
}
