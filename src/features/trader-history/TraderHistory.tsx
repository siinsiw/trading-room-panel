import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toFa, formatTomans, formatTether } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useRealtime } from '@/hooks/useRealtime';
import { repos } from '@/data/repositories/index';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import { EmptyState } from '@/ui/compounds/EmptyState';
import type { Trade } from '@/domain/types';
import { Download } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}

function KpiCard({ label, value, sub, highlight }: KpiCardProps) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p
        className="text-lg font-bold tabular-nums"
        style={{
          color: highlight ? 'var(--accent-gold)' : 'var(--text-primary)',
          fontFamily: "'Geist Mono', monospace",
        }}
      >
        {value}
      </p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
    </div>
  );
}

interface ChartDataPoint {
  date: string;
  pnl: number;
  cumulative: number;
}

function buildChartData(trades: Trade[]): ChartDataPoint[] {
  const sorted = [...trades].sort((a, b) => new Date(a.matchedAt).getTime() - new Date(b.matchedAt).getTime());
  let cumulative = 0;
  const map = new Map<string, { pnl: number; cumulative: number }>();

  for (const t of sorted) {
    const date = t.settlementDate;
    const pnl = t.buyerPnLToman ?? t.sellerPnLToman ?? 0;
    cumulative += pnl;
    map.set(date, { pnl: (map.get(date)?.pnl ?? 0) + pnl, cumulative });
  }

  return Array.from(map.entries()).map(([date, v]) => ({ date, pnl: v.pnl, cumulative: v.cumulative }));
}

function exportToCsv(trades: Trade[], profileId: string) {
  const rows = [
    ['ØªØ§Ø±ÛŒØ®', 'Ø´Ù†Ø§Ø³Ù‡', 'Ø·Ø±Ù', 'Ø­Ø¬Ù…', 'Ù‚ÛŒÙ…Øª ØªÙˆÙ…Ø§Ù†', 'P&L ØªÙˆÙ…Ø§Ù†', 'Ú©Ù…ÛŒØ³ÛŒÙˆÙ†', 'ØªØ³ÙˆÛŒÙ‡'].join(','),
    ...trades.map((t) => {
      const isBuyer = t.buyerId === profileId;
      const pnl = isBuyer ? (t.buyerPnLToman ?? '') : (t.sellerPnLToman ?? '');
      const commission = isBuyer ? (t.buyerCommission ?? '') : (t.sellerCommission ?? '');
      return [
        t.settlementDate,
        t.id,
        isBuyer ? 'Ø®Ø±ÛŒØ¯Ø§Ø±' : 'ÙØ±ÙˆØ´Ù†Ø¯Ù‡',
        t.quantity,
        t.priceToman,
        pnl,
        commission,
        t.settled ? 'Ø¨Ù„Ù‡' : 'Ø®ÛŒØ±',
      ].join(',');
    }),
  ];
  const blob = new Blob(['ï»¿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trade-history.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function TraderHistory() {
  const { profile } = useAuthStore();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = useCallback(async () => {
    if (!profile) return;
    try {
      const data = await repos.trades.getByTrader(profile.id);
      setTrades(data);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  useRealtime(
    { table: 'trades' },
    () => { fetchTrades(); },
    [profile?.id],
  );

  const settledTrades = trades.filter((t) => t.settled);
  const totalQty = settledTrades.reduce((s, t) => s + t.quantity, 0);
  const totalPnL = settledTrades.reduce((s, t) => {
    if (!profile) return s;
    const pnl = t.buyerId === profile.id ? (t.buyerPnLToman ?? 0) : (t.sellerPnLToman ?? 0);
    return s + pnl;
  }, 0);
  const totalPnLTether = totalPnL / 97000;
  const chartData = buildChartData(settledTrades);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          ØªØ§Ø±ÛŒØ®Ú†Ù‡ Ù…Ø¹Ø§Ù…Ù„Ø§Øª
        </h1>
        <button
          type="button"
          onClick={() => profile && exportToCsv(settledTrades, profile.id)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <Download size={14} />
          Ø®Ø±ÙˆØ¬ÛŒ CSV
        </button>
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="ØªØ¹Ø¯Ø§Ø¯ Ù…Ø¹Ø§Ù…Ù„Ø§Øª" value={toFa(settledTrades.length)} />
          <KpiCard label="Ø­Ø¬Ù… Ú©Ù„" value={toFa(totalQty) + ' ÙˆØ§Ø­Ø¯'} />
          <KpiCard
            label="P&L ØªØ¬Ù…ÛŒØ¹ÛŒ"
            value={formatTomans(Math.abs(totalPnL))}
            sub={totalPnL >= 0 ? 'Ø³ÙˆØ¯' : 'Ø²ÛŒØ§Ù†'}
            highlight={totalPnL >= 0}
          />
          <KpiCard
            label="P&L ØªØªØ±"
            value={formatTether(Math.abs(totalPnLTether))}
            sub={totalPnLTether >= 0 ? 'Ø³ÙˆØ¯' : 'Ø²ÛŒØ§Ù†'}
            highlight={totalPnLTether >= 0}
          />
        </div>
      )}

      {/* Chart */}
      {!loading && chartData.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <p className="mb-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            P&L ØªØ¬Ù…ÛŒØ¹ÛŒ
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => (v / 1000000).toFixed(1) + 'M'}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 12,
                }}
                formatter={(value: unknown) => [formatTomans(Number(value)), 'P&L ØªØ¬Ù…ÛŒØ¹ÛŒ']}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="var(--accent-gold)"
                strokeWidth={2}
                fill="url(#pnlGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        {loading ? (
          <div className="space-y-1 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                {Array.from({ length: 7 }).map((__, j) => (
                  <div key={j} className="skeleton-shimmer flex-1 rounded" style={{ height: 12 }} />
                ))}
              </div>
            ))}
          </div>
        ) : settledTrades.length === 0 ? (
          <EmptyState title="Ù…Ø¹Ø§Ù…Ù„Ù‡â€ŒØ§ÛŒ Ø§Ù†Ø¬Ø§Ù… Ù†Ø´Ø¯Ù‡" description="Ù¾Ø³ Ø§Ø² ØªØ³ÙˆÛŒÙ‡ØŒ Ù…Ø¹Ø§Ù…Ù„Ø§Øª Ø§ÛŒÙ†Ø¬Ø§ Ù†Ù…Ø§ÛŒØ´ Ø¯Ø§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                  {['ØªØ§Ø±ÛŒØ®', 'Ø¨Ø§Ø²Ø§Ø±', 'Ù†ÙˆØ¹', 'Ø­Ø¬Ù…', 'Ù‚ÛŒÙ…Øª', 'P&L', 'Ú©Ù…ÛŒØ³ÛŒÙˆÙ†', 'Ø·Ø±Ù Ù…Ù‚Ø§Ø¨Ù„'].map((h) => (
                    <th key={h} className="px-3 py-2 text-right text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settledTrades.map((t) => {
                  const isBuyer = t.buyerId === profile?.id;
                  const pnl = isBuyer ? (t.buyerPnLToman ?? 0) : (t.sellerPnLToman ?? 0);
                  const commission = isBuyer ? (t.buyerCommission ?? 0) : (t.sellerCommission ?? 0);
                  const counterpartId = isBuyer ? t.sellerId : t.buyerId;
                  const anonId = counterpartId.slice(-4).toUpperCase();

                  return (
                    <tr
                      key={t.id}
                      className="border-t transition-colors hover:bg-white/5"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}>
                        {toFa(t.settlementDate)}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                        {t.marketId}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={isBuyer
                            ? { backgroundColor: 'color-mix(in srgb, var(--semantic-buy) 12%, transparent)', color: 'var(--semantic-buy)' }
                            : { backgroundColor: 'color-mix(in srgb, var(--semantic-sell) 12%, transparent)', color: 'var(--semantic-sell)' }
                          }
                        >
                          {isBuyer ? 'Ø®Ø±ÛŒØ¯' : 'ÙØ±ÙˆØ´'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {toFa(t.quantity)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}>
                        {formatTomans(t.priceToman)}
                      </td>
                      <td
                        className="px-3 py-2.5 tabular-nums font-semibold"
                        style={{
                          color: pnl >= 0 ? 'var(--semantic-success)' : 'var(--semantic-danger)',
                          fontFamily: "'Geist Mono', monospace",
                        }}
                      >
                        {pnl >= 0 ? '+' : ''}{formatTomans(pnl)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {formatTomans(commission)}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: 'var(--text-tertiary)' }}>
                        ***{toFa(anonId)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

