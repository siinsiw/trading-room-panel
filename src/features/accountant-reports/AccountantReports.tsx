import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toFa, formatTomans } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { repos } from '@/data/repositories/index';
import type { Trade, Settlement } from '@/domain/types';
import { Download } from 'lucide-react';

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

export default function AccountantReports() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [activeTraders, setActiveTraders] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [allTrades, allSettlements, traders] = await Promise.all([
        repos.trades.getAll(),
        repos.settlements.getAll(),
        repos.users.getByRole('trader'),
      ]);
      setTrades(allTrades);
      setSettlements(allSettlements);
      setActiveTraders(traders.filter((u) => u.active).length);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredTrades = trades.filter((t) => {
    if (dateFrom && t.settlementDate < dateFrom) return false;
    if (dateTo && t.settlementDate > dateTo) return false;
    return true;
  });

  const totalVolume = filteredTrades.reduce((s, t) => s + t.quantity, 0);
  const totalCommission = filteredTrades.reduce((s, t) => s + (t.buyerCommission ?? 0) + (t.sellerCommission ?? 0), 0);
  const chartData = buildDailyVolume(filteredTrades);

  function exportCsv() {
    const rows = [
      ['ØªØ§Ø±ÛŒØ®', 'Ø´Ù†Ø§Ø³Ù‡', 'Ø¨Ø§Ø²Ø§Ø±', 'Ø®Ø±ÛŒØ¯Ø§Ø±', 'ÙØ±ÙˆØ´Ù†Ø¯Ù‡', 'Ø­Ø¬Ù…', 'Ù‚ÛŒÙ…Øª', 'Ú©Ù…ÛŒØ³ÛŒÙˆÙ† Ø®Ø±ÛŒØ¯Ø§Ø±', 'Ú©Ù…ÛŒØ³ÛŒÙˆÙ† ÙØ±ÙˆØ´Ù†Ø¯Ù‡', 'ØªØ³ÙˆÛŒÙ‡'].join(','),
      ...filteredTrades.map((t) => [
        t.settlementDate, t.id, t.marketId, t.buyerId, t.sellerId,
        t.quantity, t.priceToman, t.buyerCommission ?? '', t.sellerCommission ?? '', t.settled ? 'Ø¨Ù„Ù‡' : 'Ø®ÛŒØ±',
      ].join(',')),
    ];
    const blob = new Blob(['ï»¿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Ú¯Ø²Ø§Ø±Ø´</h1>
        <button
          type="button"
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-white/5"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <Download size={14} />
          Ø®Ø±ÙˆØ¬ÛŒ CSV
        </button>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-3">
        {[
          { label: 'Ø§Ø² ØªØ§Ø±ÛŒØ®', value: dateFrom, set: setDateFrom },
          { label: 'ØªØ§ ØªØ§Ø±ÛŒØ®', value: dateTo, set: setDateTo },
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
            Ù¾Ø§Ú© Ú©Ø±Ø¯Ù†
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Ú©Ù…ÛŒØ³ÛŒÙˆÙ† Ú©Ù„" value={formatTomans(totalCommission)} loading={loading} />
        <KpiCard label="Ø­Ø¬Ù… Ú©Ù„" value={toFa(totalVolume) + ' ÙˆØ§Ø­Ø¯'} loading={loading} />
        <KpiCard label="ØªØ±ÛŒØ¯Ø±Ù‡Ø§ÛŒ ÙØ¹Ø§Ù„" value={toFa(activeTraders)} loading={loading} />
        <KpiCard label="ØªØ¹Ø¯Ø§Ø¯ ØªØµÙÛŒÙ‡" value={toFa(settlements.length)} loading={loading} />
      </div>

      {/* Bar chart */}
      {!loading && chartData.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <p className="mb-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Ø­Ø¬Ù… Ø±ÙˆØ²Ø§Ù†Ù‡</p>
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
                formatter={(value: unknown) => [toFa(Number(value)) + ' ÙˆØ§Ø­Ø¯', 'Ø­Ø¬Ù…']}
              />
              <Bar dataKey="volume" fill="var(--accent-gold)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Breakdown table */}
      {!loading && (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <p className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
            ØªÙÚ©ÛŒÚ© Ø±ÙˆØ²Ø§Ù†Ù‡
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                  {['ØªØ§Ø±ÛŒØ®', 'ØªØ¹Ø¯Ø§Ø¯ Ù…Ø¹Ø§Ù…Ù„Ø§Øª', 'Ø­Ø¬Ù…', 'Ú©Ù…ÛŒØ³ÛŒÙˆÙ†'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map((d) => {
                  const dayTrades = filteredTrades.filter((t) => t.settlementDate === d.date);
                  const dayCommission = dayTrades.reduce((s, t) => s + (t.buyerCommission ?? 0) + (t.sellerCommission ?? 0), 0);
                  return (
                    <tr key={d.date} className="border-t hover:bg-white/5" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{toFa(d.date)}</td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>{toFa(dayTrades.length)}</td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>{toFa(d.volume)}</td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatTomans(dayCommission)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

