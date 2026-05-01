import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { toFa, formatTomans, formatTether } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useRealtime } from '@/hooks/useRealtime';
import { repos } from '@/data/repositories/index';
import { supabase } from '@/lib/supabase';
import { MarginGauge } from '@/ui/compounds/MarginGauge';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import { EmptyState } from '@/ui/compounds/EmptyState';
import type { Market, Trade } from '@/domain/types';
import { LogOut } from 'lucide-react';

interface MarginResult {
  required_tether: number;
  available_tether: number;
  floating_pnl_tether: number;
  percentage: number;
  zone: 'safe' | 'warn' | 'risk' | 'call';
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: 'var(--bg-overlay)', borderColor: 'var(--border-subtle)' }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between border-b py-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

export default function TraderProfile() {
  const { profile, signOut } = useAuthStore();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [margin, setMargin] = useState<MarginResult | null>(null);
  const [positions, setPositions] = useState<Trade[]>([]);
  const [loadingMargin, setLoadingMargin] = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(true);

  const fetchPositions = useCallback(async () => {
    if (!profile) return;
    try {
      const trades = await repos.trades.getByTrader(profile.id);
      setPositions(trades.filter((t) => !t.settled));
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoadingPositions(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchPositions();
    repos.markets.getAll().then((all) => {
      setMarkets(all.filter((m) => m.active));
    }).catch(() => {});
  }, [fetchPositions]);

  // Compute margin when market loaded
  useEffect(() => {
    if (!profile || markets.length === 0) return;
    const market = markets[0];
    setLoadingMargin(true);
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc('compute_user_margin', {
          p_user_id: profile.id,
          p_market_id: market.id,
          p_current_price: market.mazneCurrent,
          p_tether_rate: 97000,
        });
        if (error) throw error;
        setMargin(data as MarginResult);
      } catch (err: unknown) {
        toast.error(parseError(err));
      } finally {
        setLoadingMargin(false);
      }
    })();
  }, [profile, markets]);

  useRealtime(
    { table: 'profiles', filter: profile ? { column: 'id', value: profile.id } : undefined },
    () => {
      // Re-fetch profile via store
    },
    [profile?.id],
  );

  useRealtime(
    { table: 'trades' },
    () => { fetchPositions(); },
    [profile?.id],
  );

  if (!profile) return null;

  const deposit = profile.deposit_tether ?? 0;
  const perUnit = profile.per_unit_deposit ?? 0;
  const commission = profile.commission_per_unit ?? 0;

  return (
    <div className="space-y-6 max-w-2xl" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Ù¾Ø±ÙˆÙØ§ÛŒÙ„
        </h1>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--semantic-danger)' }}
        >
          <LogOut size={14} />
          Ø®Ø±ÙˆØ¬
        </button>
      </div>

      {/* Section 1: Margin gauge + stat cards */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <p className="text-xs font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          ÙˆØ¶Ø¹ÛŒØª Ù…Ø§Ø±Ø¬ÛŒÙ†
        </p>
        {loadingMargin ? (
          <SkeletonCard lines={3} />
        ) : (
          <div className="flex flex-col items-center gap-6 md:flex-row">
            <MarginGauge
              percentage={margin?.percentage ?? 0}
              zone={margin?.zone ?? 'safe'}
              size={160}
            />
            <div className="grid flex-1 grid-cols-2 gap-3">
              <StatCard
                label="ÙˆØ¯ÛŒØ¹Ù‡ Ú©Ù„"
                value={formatTether(deposit)}
                sub="ØªØªØ±"
              />
              <StatCard
                label="Ù…Ø§Ø±Ø¬ÛŒÙ† Ù…ÙˆØ¬ÙˆØ¯"
                value={formatTether(margin?.available_tether ?? deposit)}
                sub="ØªØªØ±"
              />
              <StatCard
                label="Ù…Ø§Ø±Ø¬ÛŒÙ† Ù…ÙˆØ±Ø¯ Ù†ÛŒØ§Ø²"
                value={formatTether(margin?.required_tether ?? 0)}
                sub="ØªØªØ±"
              />
              <StatCard
                label="P&L Ø´Ù†Ø§ÙˆØ±"
                value={formatTether(Math.abs(margin?.floating_pnl_tether ?? 0))}
                sub={(margin?.floating_pnl_tether ?? 0) >= 0 ? 'Ø³ÙˆØ¯' : 'Ø²ÛŒØ§Ù†'}
              />
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Open positions */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <div
          className="border-b px-4 py-3"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Ù¾ÙˆØ²ÛŒØ´Ù†â€ŒÙ‡Ø§ÛŒ Ø¨Ø§Ø²
          </p>
        </div>
        {loadingPositions ? (
          <div className="p-4">
            <SkeletonCard lines={3} />
          </div>
        ) : positions.length === 0 ? (
          <EmptyState title="Ù¾ÙˆØ²ÛŒØ´Ù† Ø¨Ø§Ø²ÛŒ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯" description="Ù…Ø¹Ø§Ù…Ù„Ø§Øª ØªØ³ÙˆÛŒÙ‡â€ŒÙ†Ø´Ø¯Ù‡ Ø§ÛŒÙ†Ø¬Ø§ Ù†Ù…Ø§ÛŒØ´ Ø¯Ø§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                  {['Ø¨Ø§Ø²Ø§Ø±', 'Ù†ÙˆØ¹', 'Ø­Ø¬Ù…', 'Ù‚ÛŒÙ…Øª', 'ØªØ§Ø±ÛŒØ® ØªØ³ÙˆÛŒÙ‡'].map((h) => (
                    <th key={h} className="px-3 py-2 text-right font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((t) => {
                  const isBuyer = t.buyerId === profile.id;
                  return (
                    <tr
                      key={t.id}
                      className="border-t hover:bg-white/5"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>{t.marketId}</td>
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
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>{toFa(t.quantity)}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}>
                        {formatTomans(t.priceToman)}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>{toFa(t.settlementDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Profile info */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ù¾Ø±ÙˆÙØ§ÛŒÙ„</p>
        <InfoRow label="Ù†Ø§Ù… Ú©Ø§Ù…Ù„" value={profile.full_name} />
        <InfoRow label="Ø´Ù…Ø§Ø±Ù‡ Ù…ÙˆØ¨Ø§ÛŒÙ„" value={toFa(profile.phone)} />
        <InfoRow label="Ù†Ù‚Ø´" value={profile.role === 'trader' ? 'ØªØ±ÛŒØ¯Ø±' : profile.role === 'admin' ? 'Ø§Ø¯Ù…ÛŒÙ†' : 'Ø­Ø³Ø§Ø¨Ø¯Ø§Ø±'} />
        {profile.telegram_id && (
          <InfoRow label="ØªÙ„Ú¯Ø±Ø§Ù…" value={'@' + profile.telegram_id} />
        )}
      </div>

      {/* Section 4: Account settings */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>ØªÙ†Ø¸ÛŒÙ…Ø§Øª Ø­Ø³Ø§Ø¨</p>
        <InfoRow label="ÙˆØ¯ÛŒØ¹Ù‡" value={formatTether(deposit)} />
        <InfoRow label="Ø¨ÛŒØ¹Ø§Ù†Ù‡ Ù‡Ø± ÙˆØ§Ø­Ø¯" value={formatTether(perUnit)} />
        <InfoRow label="Ú©Ù…ÛŒØ³ÛŒÙˆÙ† Ù‡Ø± ÙˆØ§Ø­Ø¯" value={formatTomans(commission)} />
      </div>
    </div>
  );
}

