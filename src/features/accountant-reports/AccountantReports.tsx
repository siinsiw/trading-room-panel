import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toFa, formatTomans } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { repos } from '@/data/repositories/index';
import type { Trade, Settlement, Market } from '@/domain/types';
import type { Profile } from '@/lib/database.types';
import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { exportToCSV, exportToExcel, printPdfReport, todayStamp, type ExportColumn } from '@/lib/exports';

interface KpiCardProps { label: string; value: string; loading?: boolean }

function KpiCard({ label, value, loading }: KpiCardProps) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      {loading ? (
        <div className="skeleton-shimmer h-6 rounded" />
      ) : (
        <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}>{value}</p>
      )}
    </div>
  );
}

interface DailyVolume {
  date: string;
  volume: number;
}

function buildDailyVolume(trades: Trade[]): DailyVolume[] {
  const map = new Map<string, number>();
  for (const t of trades) {
    map.set(t.settlementDate, (map.get(t.settlementDate) ?? 0) + t.quantity);
  }
  return Array.from(map.entries())
    .map(([date, volume]) => ({ date, volume }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

type GroupBy = 'day' | 'user' | 'asset';

export default function AccountantReports() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [traders, setTraders] = useState<Profile[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('day');

  const fetchData = useCallback(async () => {
    try {
      const [allTrades, allSettlements, allTraders, allMarkets] = await Promise.all([
        repos.trades.getAll(),
        repos.settlements.getAll(),
        repos.users.getByRole('trader'),
        repos.markets.getAll(),
      ]);
      setTrades(allTrades);
      setSettlements(allSettlements);
      setTraders(allTraders);
      setMarkets(allMarkets);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);
  const activeTraders = traders.filter((u) => u.active).length;

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredTrades = trades.filter((t) => {
    if (dateFrom && t.settlementDate < dateFrom) return false;
    if (dateTo && t.settlementDate > dateTo) return false;
    return true;
  });

  const totalVolume = filteredTrades.reduce((s, t) => s + t.quantity, 0);
  const totalCommission = filteredTrades.reduce((s, t) => s + (t.buyerCommission ?? 0) + (t.sellerCommission ?? 0), 0);
  const chartData = buildDailyVolume(filteredTrades);

  // ─── Grouping ───────────────────────────────────────────────────
  // برحسب کاربر یا دارایی، حجم/کمیسیون/سود-زیان را تجمیع می‌کند.
  const traderName = new Map(traders.map((t) => [t.id, t.full_name]));
  const marketName = new Map(markets.map((m) => [m.id, m.name]));

  interface Bucket { key: string; label: string; trades: number; volume: number; commission: number; pnl: number }
  function bucketFor(t: Trade, gb: GroupBy): { key: string; label: string }[] {
    if (gb === 'day') return [{ key: t.settlementDate, label: toFa(t.settlementDate) }];
    if (gb === 'asset') return [{ key: t.marketId, label: marketName.get(t.marketId) ?? t.marketId }];
    // user — یک معامله دو طرف دارد، در هر دو ردیف حساب می‌شود.
    return [
      { key: t.buyerId,  label: traderName.get(t.buyerId)  ?? t.buyerId },
      { key: t.sellerId, label: traderName.get(t.sellerId) ?? t.sellerId },
    ];
  }
  const grouped: Bucket[] = (() => {
    const m = new Map<string, Bucket>();
    for (const t of filteredTrades) {
      for (const b of bucketFor(t, groupBy)) {
        const cur = m.get(b.key) ?? { key: b.key, label: b.label, trades: 0, volume: 0, commission: 0, pnl: 0 };
        cur.trades += 1;
        cur.volume += t.quantity;
        if (groupBy === 'user') {
          if (b.key === t.buyerId)  { cur.commission += t.buyerCommission  ?? 0; cur.pnl += t.buyerPnLToman  ?? 0; }
          if (b.key === t.sellerId) { cur.commission += t.sellerCommission ?? 0; cur.pnl += t.sellerPnLToman ?? 0; }
        } else {
          cur.commission += (t.buyerCommission ?? 0) + (t.sellerCommission ?? 0);
          cur.pnl        += (t.buyerPnLToman   ?? 0) + (t.sellerPnLToman   ?? 0);
        }
        m.set(b.key, cur);
      }
    }
    return [...m.values()].sort((a, b) => b.volume - a.volume);
  })();

  // ─── Export helpers ─────────────────────────────────────────────
  const groupLabel = groupBy === 'day' ? 'تاریخ' : groupBy === 'user' ? 'کاربر' : 'دارایی';
  const groupCols: ExportColumn<Bucket>[] = [
    { key: 'label', header: groupLabel, format: (b) => b.label },
    { key: 'trades', header: 'تعداد معامله', format: (b) => b.trades },
    { key: 'volume', header: 'حجم (واحد)', format: (b) => b.volume },
    { key: 'commission', header: 'کمیسیون (تومان)', format: (b) => b.commission },
    { key: 'pnl', header: 'سود/زیان (تومان)', format: (b) => b.pnl },
  ];
  const fname = `report-${groupBy}-${todayStamp()}`;
  const onCSV   = () => exportToCSV(fname, groupCols, grouped);
  const onExcel = () => exportToExcel(fname, groupCols, grouped, `گزارش بر اساس ${groupLabel}`);
  const onPdf   = () => printPdfReport({
    title:    `گزارش بر اساس ${groupLabel}`,
    subtitle: dateFrom || dateTo ? `بازه: ${dateFrom || '—'} تا ${dateTo || '—'}` : undefined,
    columns:  groupCols.map((c) => ({ header: c.header })),
    rows:     grouped.map((b) => groupCols.map((c) => c.format!(b) as string | number | null)),
    summaryRows: [[
      'مجموع',
      grouped.reduce((s, b) => s + b.trades, 0),
      grouped.reduce((s, b) => s + b.volume, 0),
      grouped.reduce((s, b) => s + b.commission, 0),
      grouped.reduce((s, b) => s + b.pnl, 0),
    ]],
    meta: [
      { label: 'تعداد ردیف', value: toFa(grouped.length) },
      { label: 'حجم کل',     value: toFa(totalVolume) + ' واحد' },
      { label: 'کمیسیون کل', value: formatTomans(totalCommission) },
    ],
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>گزارش</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCSV}   disabled={grouped.length === 0} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-white/5 disabled:opacity-40" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}><FileText size={13}/>CSV</button>
          <button type="button" onClick={onExcel} disabled={grouped.length === 0} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-white/5 disabled:opacity-40" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}><FileSpreadsheet size={13}/>اکسل</button>
          <button type="button" onClick={onPdf}   disabled={grouped.length === 0} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-white/5 disabled:opacity-40" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}><Printer size={13}/>PDF</button>
        </div>
      </div>

      {/* Group-by selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>گروه‌بندی بر اساس:</span>
        <div className="flex rounded-lg border p-0.5" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-overlay)' }}>
          {(['day', 'user', 'asset'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupBy(g)}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                groupBy === g
                  ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }
                  : { color: 'var(--text-tertiary)' }
              }
            >
              {g === 'day' ? 'روز' : g === 'user' ? 'کاربر' : 'دارایی'}
            </button>
          ))}
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-3">
        {[
          { label: 'از تاریخ', value: dateFrom, set: setDateFrom },
          { label: 'تا تاریخ', value: dateTo, set: setDateTo },
        ].map((f) => (
          <div key={f.label}>
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
            <input
              type="text"
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              placeholder="1405/01/01"
              className="w-32 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
            />
          </div>
        ))}
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="rounded-lg px-3 py-2 text-xs hover:bg-white/5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            پاک کردن
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="کمیسیون کل" value={formatTomans(totalCommission)} loading={loading} />
        <KpiCard label="حجم کل" value={toFa(totalVolume) + ' واحد'} loading={loading} />
        <KpiCard label="تریدرهای فعال" value={toFa(activeTraders)} loading={loading} />
        <KpiCard label="تعداد تصفیه" value={toFa(settlements.length)} loading={loading} />
      </div>

      {/* Bar chart */}
      {!loading && chartData.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <p className="mb-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>حجم روزانه</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 12,
                }}
                formatter={(value: unknown) => [toFa(Number(value)) + ' واحد', 'حجم']}
              />
              <Bar dataKey="volume" fill="var(--accent-gold)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Breakdown table — برحسب groupBy */}
      {!loading && (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <p className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
            تفکیک بر اساس {groupBy === 'day' ? 'روز' : groupBy === 'user' ? 'کاربر' : 'دارایی'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                  {[groupBy === 'day' ? 'تاریخ' : groupBy === 'user' ? 'کاربر' : 'دارایی', 'معاملات', 'حجم', 'کمیسیون', 'سود/زیان'].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map((b) => (
                  <tr key={b.key} className="border-t hover:bg-white/5" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{b.label}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{toFa(b.trades)}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>{toFa(b.volume)}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}>{formatTomans(b.commission)}</td>
                    <td
                      className="px-4 py-2.5 tabular-nums font-medium"
                      style={{ color: b.pnl >= 0 ? 'var(--semantic-success)' : 'var(--semantic-danger)', fontFamily: "'Geist Mono', monospace" }}
                    >
                      {b.pnl >= 0 ? '+' : ''}{formatTomans(b.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

