// ─── Export utilities — CSV, Excel, PDF ────────────────────────────
// CSV: BOM utf-8 for Excel auto-detection of Persian text.
// Excel: SheetJS (xlsx) — RTL sheet view + Persian-friendly via system fonts.
// PDF: window.print با style مخصوص — از رندر مرورگر فارسی استفاده می‌کند که بهترین کیفیت را دارد.

import * as XLSX from 'xlsx';

export type ExportColumn<T> = {
  key: keyof T | string;
  header: string;
  /** Optional formatter — اگر null برگرداند، خانه خالی می‌ماند. */
  format?: (row: T) => string | number | null;
};

// ─── CSV ──────────────────────────────────────────────────────────────
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportToCSV<T>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
): void {
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCsv(c.header)).join(','));
  for (const row of rows) {
    const cells = columns.map((c) => {
      const raw = c.format ? c.format(row) : (row as Record<string, unknown>)[c.key as string];
      return escapeCsv(raw as string | number | null | undefined);
    });
    lines.push(cells.join(','));
  }
  // BOM utf-8 → Excel فارسی را درست تشخیص می‌دهد
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  download(blob, ensureExt(filename, '.csv'));
}

// ─── Excel ────────────────────────────────────────────────────────────
export function exportToExcel<T>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
  sheetName = 'گزارش',
): void {
  const data = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) {
      const raw = c.format ? c.format(row) : (row as Record<string, unknown>)[c.key as string];
      out[c.header] = raw ?? '';
    }
    return out;
  });

  const ws = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.header) });

  // RTL — sheet view
  // SheetJS supports `!Views` for sheet-level view options.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ws as any)['!views'] = [{ RTL: true }];

  // عرض ستون‌ها — تخمین خودکار بر اساس طول هدر و داده‌ها
  const colWidths = columns.map((c) => {
    let max = c.header.length;
    for (const row of data) {
      const v = String(row[c.header] ?? '');
      if (v.length > max) max = v.length;
    }
    return { wch: Math.min(60, Math.max(8, max + 2)) };
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ws as any)['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, ensureExt(filename, '.xlsx'), { bookType: 'xlsx', compression: true });
}

// ─── PDF (via browser print) ──────────────────────────────────────────
// چرا window.print؟ مرورگر فارسی را با فونت سیستم به‌خوبی رندر می‌کند و
// خروجی PDF با کیفیت بسیار بهتر از کتابخانه‌های جاوااسکریپتی است.
// کاربر در dialog چاپ، «Save as PDF» (یا «Microsoft Print to PDF») را انتخاب می‌کند.
export function printPdfReport(args: {
  title: string;
  subtitle?: string;
  columns: { header: string; align?: 'right' | 'left' | 'center' }[];
  rows: (string | number | null | undefined)[][];
  /** ردیف‌های مجموع/خلاصه که در پایان جدول می‌آیند (با استایل bold) */
  summaryRows?: (string | number | null | undefined)[][];
  meta?: { label: string; value: string }[];
}): void {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('پنجرهٔ چاپ مسدود شد. لطفاً popup را برای این سایت فعال کنید.');
    return;
  }

  const escape = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const headerCells = args.columns
    .map((c) => `<th style="text-align:${c.align ?? 'right'}">${escape(c.header)}</th>`)
    .join('');

  const bodyRows = args.rows
    .map(
      (r) =>
        '<tr>' +
        r
          .map(
            (cell, i) =>
              `<td style="text-align:${args.columns[i]?.align ?? 'right'}">${escape(cell)}</td>`,
          )
          .join('') +
        '</tr>',
    )
    .join('');

  const summary = (args.summaryRows ?? [])
    .map(
      (r) =>
        '<tr class="sum">' +
        r
          .map(
            (cell, i) =>
              `<td style="text-align:${args.columns[i]?.align ?? 'right'}">${escape(cell)}</td>`,
          )
          .join('') +
        '</tr>',
    )
    .join('');

  const metaHtml = (args.meta ?? [])
    .map((m) => `<div><span class="lbl">${escape(m.label)}:</span> <span>${escape(m.value)}</span></div>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>${escape(args.title)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Vazirmatn, "YekanBakh FaNum", Tahoma, sans-serif; font-size: 11pt; color: #111; }
  h1 { font-size: 16pt; margin: 0 0 6pt; text-align: center; }
  .subtitle { text-align: center; color: #555; margin: 0 0 10pt; font-size: 10pt; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4pt 14pt; margin-bottom: 10pt; font-size: 10pt; }
  .meta .lbl { color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 6pt; }
  th, td { border: 1px solid #999; padding: 4pt 6pt; }
  thead th { background: #f0f0f0; font-weight: bold; }
  tr.sum td { background: #fafafa; font-weight: bold; border-top: 2px solid #555; }
  .footer { margin-top: 16pt; text-align: center; color: #888; font-size: 9pt; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <h1>${escape(args.title)}</h1>
  ${args.subtitle ? `<p class="subtitle">${escape(args.subtitle)}</p>` : ''}
  ${metaHtml ? `<div class="meta">${metaHtml}</div>` : ''}
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}${summary}</tbody>
  </table>
  <p class="footer">تولید‌شده توسط پنل اتاق معاملات تی‌تی · ${new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}</p>
  <script>
    window.addEventListener('load', () => { setTimeout(() => window.print(), 200); });
  </script>
</body>
</html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ─── Helpers ──────────────────────────────────────────────────────────
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ensureExt(name: string, ext: string): string {
  return name.toLowerCase().endsWith(ext) ? name : name + ext;
}

/** کمک‌کننده: تاریخ امروز فرمت‌شده برای نام فایل */
export function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}${m}${da}-${hh}${mm}`;
}
