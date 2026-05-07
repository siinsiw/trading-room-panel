import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { toFa, formatTomans } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { repos } from '@/data/repositories/index';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import { EmptyState } from '@/ui/compounds/EmptyState';
import type { Trade } from '@/domain/types';
import { Search, X, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { exportToCSV, exportToExcel, printPdfReport, todayStamp, type ExportColumn } from '@/lib/exports';

interface TradeDrawerProps {
  trade: Trade;
  onClose: () => void;
}

function TradeDrawer({ trade, onClose }: TradeDrawerProps) {
  const rows: [string, string][] = [
    ['شناسه', trade.id],
    ['بازار', trade.marketId],
    ['خریدار', trade.buyerId],
    ['فروشنده', trade.sellerId],
    ['سفارش خرید', trade.buyOrderId ?? '— (ثبت دستی)'],
    ['سفارش فروش', trade.sellOrderId ?? '— (ثبت دستی)'],
    ['حجم', toFa(trade.quantity) + ' واحد'],
    ['قیمت', formatTomans(trade.priceToman)],
    ['تاریخ تسویه', toFa(trade.settlementDate)],
    ['زمان تطبیق', toFa(new Date(trade.matchedAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' }))],
    ['تسویه شده', trade.settled ? 'بله' : 'خیر'],
    ['P&L خریدار', trade.buyerPnLToman != null ? formatTomans(trade.buyerPnLToman) : '—'],
    ['P&L فروشنده', trade.sellerPnLToman != null ? formatTomans(trade.sellerPnLToman) : '—'],
    ['کمیسیون خریدار', trade.buyerCommission != null ? formatTomans(trade.buyerCommission) : '—'],
    ['کمیسیون فروشنده', trade.sellerCommission != null ? formatTomans(trade.sellerCommission) : '—'],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="ms-auto flex h-full w-full max-w-sm flex-col overflow-y-auto border-r shadow-2xl"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>جزئیات معامله</p>
          <button type="button" onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 p-5">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-start justify-between border-b py-2.5 gap-3"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span
                className="text-xs font-medium break-all text-left"
                style={{ color: 'var(--text-primary)', fontFamily: value.match(/^[0-9]/) ? "'Geist Mono', monospace" : undefined }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AccountantTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSettled, setFilterSettled] = useState<'all' | 'settled' | 'unsettled'>('all');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const fetchTrades = useCallback(async () => {
    try {
      const data = await repos.trades.getAll();
      setTrades(data);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  const filtered = trades.filter((t) => {
    if (filterSettled === 'settled' && !t.settled) return false;
    if (filterSettled === 'unsettled' && t.settled) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.id.toLowerCase().includes(q) || t.marketId.toLowerCase().includes(q) ||
        t.buyerId.toLowerCase().includes(q) || t.sellerId.toLowerCase().includes(q);
    }
    return true;
  });

  const exportCols: ExportColumn<Trade>[] = [
    { key: 'matchedAt', header: 'زمان', format: (t) => new Date(t.matchedAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' }) },
    { key: 'kind', header: 'نوع', format: (t) => t.kind === 'today' ? 'امروزی' : 'فردایی' },
    { key: 'buyerId', header: 'خریدار', format: (t) => t.buyerId },
    { key: 'sellerId', header: 'فروشنده', format: (t) => t.sellerId },
    { key: 'quantity', header: 'حجم', format: (t) => t.quantity },
    { key: 'priceToman', header: 'قیمت (تومان)', format: (t) => t.priceToman },
    { key: 'tradeType', header: 'دسته', format: (t) => t.tradeType === 'rent' ? 'اجاره' : t.tradeType === 'blocked' ? 'بلوکه' : 'عادی' },
    { key: 'settled', header: 'وضعیت', format: (t) => t.settled ? 'تسویه‌شده' : 'باز' },
    { key: 'buyerPnLToman', header: 'P&L خریدار', format: (t) => t.buyerPnLToman ?? '' },
    { key: 'sellerPnLToman', header: 'P&L فروشنده', format: (t) => t.sellerPnLToman ?? '' },
  ];
  const fname = `accountant-trades-${todayStamp()}`;
  const onCSV   = () => exportToCSV(fname, exportCols, filtered);
  const onExcel = () => exportToExcel(fname, exportCols, filtered, 'معاملات');
  const onPdf   = () => printPdfReport({
    title:   'گزارش معاملات حسابداری',
    columns: exportCols.map((c) => ({ header: c.header })),
    rows:    filtered.map((t) => exportCols.map((c) => c.format!(t) as string | number | null)),
    meta:    [
      { label: 'تعداد رکوردها', value: toFa(filtered.length) },
      { label: 'تاریخ گزارش',  value: new Date().toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }) },
    ],
  });

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>معاملات</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCSV}   disabled={filtered.length === 0} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5 disabled:opacity-40" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}><FileText size={13}/>CSV</button>
          <button type="button" onClick={onExcel} disabled={filtered.length === 0} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5 disabled:opacity-40" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}><FileSpreadsheet size={13}/>اکسل</button>
          <button type="button" onClick={onPdf}   disabled={filtered.length === 0} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5 disabled:opacity-40" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}><Printer size={13}/>PDF</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس شناسه، بازار، تریدر..."
            className="w-full rounded-lg border bg-transparent py-2 pr-9 pl-3 text-sm outline-none"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          />
        </div>
        <div
          className="flex rounded-lg border p-0.5"
          style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-overlay)' }}
        >
          {(['all', 'settled', 'unsettled'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilterSettled(v)}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                filterSettled === v
                  ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }
                  : { color: 'var(--text-tertiary)' }
              }
            >
              {v === 'all' ? 'همه' : v === 'settled' ? 'تسویه‌شده' : 'تسویه‌نشده'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonCard lines={6} />
      ) : filtered.length === 0 ? (
        <EmptyState title="معامله‌ای یافت نشد" />
      ) : (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: 800 }}>
              <colgroup>
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%'  }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                  {['تاریخ', 'بازار', 'حجم', 'قیمت', 'P&L خریدار', 'P&L فروشنده', 'تسویه', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-t hover:bg-white/5 transition-colors"
                    style={{ borderColor: 'var(--border-subtle)' }}
                    onClick={() => setSelectedTrade(t)}
                  >
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}>
                      {toFa(t.settlementDate)}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{t.marketId}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>{toFa(t.quantity)}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}>
                      {formatTomans(t.priceToman)}
                    </td>
                    <td
                      className="px-4 py-2.5 tabular-nums"
                      style={{
                        color: (t.buyerPnLToman ?? 0) >= 0 ? 'var(--semantic-success)' : 'var(--semantic-danger)',
                        fontFamily: "'Geist Mono', monospace",
                      }}
                    >
                      {t.buyerPnLToman != null ? ((t.buyerPnLToman >= 0 ? '+' : '') + formatTomans(t.buyerPnLToman)) : '—'}
                    </td>
                    <td
                      className="px-4 py-2.5 tabular-nums"
                      style={{
                        color: (t.sellerPnLToman ?? 0) >= 0 ? 'var(--semantic-success)' : 'var(--semantic-danger)',
                        fontFamily: "'Geist Mono', monospace",
                      }}
                    >
                      {t.sellerPnLToman != null ? ((t.sellerPnLToman >= 0 ? '+' : '') + formatTomans(t.sellerPnLToman)) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={
                          t.settled
                            ? { backgroundColor: 'color-mix(in srgb, var(--semantic-success) 12%, transparent)', color: 'var(--semantic-success)' }
                            : { backgroundColor: 'color-mix(in srgb, var(--text-tertiary) 12%, transparent)', color: 'var(--text-tertiary)' }
                        }
                      >
                        {t.settled ? 'تسویه' : 'باز'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-left" style={{ color: 'var(--text-tertiary)' }}>›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedTrade && <TradeDrawer trade={selectedTrade} onClose={() => setSelectedTrade(null)} />}
    </div>
  );
}
