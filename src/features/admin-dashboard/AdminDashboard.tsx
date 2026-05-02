import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { toFa, formatTomans } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { useTimeStore } from '@/stores/time.store';
import { useRealtime } from '@/hooks/useRealtime';
import { repos } from '@/data/repositories/index';
import { supabase } from '@/lib/supabase';
import { ZoneBadge } from '@/ui/compounds/ZoneBadge';

import type { Market, Order, Trade } from '@/domain/types';
import type { Profile } from '@/lib/database.types';
import { Lock, Unlock, Pencil, Check, X } from 'lucide-react';

interface MarginInfo {
  percentage: number;
  zone: 'safe' | 'warn' | 'risk' | 'call';
}

interface UserWithMargin {
  profile: Profile;
  margin: MarginInfo;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  loading?: boolean;
}

function KpiCard({ label, value, highlight, loading }: KpiCardProps) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
    >
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      {loading ? (
        <div className="skeleton-shimmer h-6 rounded" />
      ) : (
        <p
          className="text-xl font-bold tabular-nums"
          style={{
            color: highlight ? 'var(--semantic-danger)' : 'var(--text-primary)',
            fontFamily: "'Geist Mono', monospace",
          }}
        >
          {typeof value === 'number' ? toFa(value) : value}
        </p>
      )}
    </div>
  );
}

interface ApproveModalProps {
  trader: Profile;
  onClose: () => void;
  onApproved: () => void;
}

function ApproveModal({ trader, onClose, onApproved }: ApproveModalProps) {
  const [deposit, setDeposit] = useState('');
  const [perUnit, setPerUnit] = useState('500');
  const [commission, setCommission] = useState('50000');
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    const dep = parseFloat(deposit);
    const pu = parseFloat(perUnit);
    const com = parseInt(commission, 10);
    if (!dep || dep <= 0) { toast.error('ودیعه را وارد کنید'); return; }
    setLoading(true);
    try {
      await (supabase as any).rpc('approve_trader', {
        p_trader_id: trader.id,
        p_deposit: dep,
        p_per_unit_deposit: pu,
        p_commission: com,
      });
      toast.success(`${trader.full_name} تأیید شد`);
      onApproved();
      onClose();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          تأیید تریدر — {trader.full_name}
        </h3>
        <div className="space-y-3">
          {[
            { label: 'ودیعه (USDT)', value: deposit, setter: setDeposit, placeholder: '1000' },
            { label: 'بیعانه هر واحد (USDT)', value: perUnit, setter: setPerUnit, placeholder: '500' },
            { label: 'کمیسیون هر واحد (تومان)', value: commission, setter: setCommission, placeholder: '50000' },
          ].map((f) => (
            <div key={f.label}>
              <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
              <input
                type="number"
                value={f.value}
                onChange={(e) => f.setter(e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg py-2 text-sm font-medium hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={loading}
            className="flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: 'var(--semantic-success)', color: '#000' }}
          >
            {loading ? 'در حال ثبت...' : 'تأیید'}
          </button>
        </div>
      </div>
    </div>
  );
}

function getTodayJalali(): string {
  const fmt = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'persian',
    numberingSystem: 'latn',
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}/${get('month')}/${get('day')}`;
}

export default function AdminDashboard() {
  const { tick, isLocked, lockCountdown } = useTimeStore();

  const [activeMarket, setActiveMarket] = useState<Market | null>(null);
  const [activeTraders, setActiveTraders] = useState<number>(0);
  const [todayVolume, setTodayVolume] = useState<number>(0);
  const [openOrdersCount, setOpenOrdersCount] = useState<number>(0);
  const [dangerZoneCount, setDangerZoneCount] = useState<number>(0);
  const [topBids, setTopBids] = useState<Order[]>([]);
  const [topAsks, setTopAsks] = useState<Order[]>([]);
  const [riskTraders, setRiskTraders] = useState<UserWithMargin[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [pendingTraders, setPendingTraders] = useState<Profile[]>([]);
  const [loadingKpis, setLoadingKpis] = useState(true);

  // Mazne edit state
  const [editingMazne, setEditingMazne] = useState(false);
  const [mazneInput, setMazneInput] = useState('');
  const [savingMazne, setSavingMazne] = useState(false);

  // Approve modal
  const [approveTrader, setApproveTrader] = useState<Profile | null>(null);

  const today = getTodayJalali();

  const fetchData = useCallback(async () => {
    try {
      // Markets
      const allMarkets = await repos.markets.getAll();
      const market = allMarkets.find((m) => m.active) ?? null;
      setActiveMarket(market);

      // Active traders
      const traders = await repos.users.getByRole('trader');
      const active = traders.filter((u) => u.active);
      setActiveTraders(active.length);

      // Pending traders
      const allProfiles = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'trader')
        .eq('active', false);
      setPendingTraders((allProfiles.data as Profile[]) ?? []);

      if (market) {
        // Today's trades
        const trades = await repos.trades.getByMarketAndDate(market.id, today);
        setTodayVolume(trades.reduce((s, t) => s + t.quantity, 0));
        setRecentTrades(trades.slice(-5).reverse());

        // Open orders
        const orders = await repos.orders.getByMarketAndDate(market.id, today);
        const openOrds = orders.filter((o) => o.status === 'open' || o.status === 'partial');
        setOpenOrdersCount(openOrds.length);
        setTopBids(openOrds.filter((o) => o.side === 'buy').sort((a, b) => b.priceToman - a.priceToman).slice(0, 5));
        setTopAsks(openOrds.filter((o) => o.side === 'sell').sort((a, b) => a.priceToman - b.priceToman).slice(0, 5));

        // Risk traders (margin)
        const riskUsers: UserWithMargin[] = [];
        let dangerCount = 0;
        for (const trader of active.slice(0, 20)) {
          const { data } = await (supabase as any).rpc('compute_user_margin', {
            p_user_id: trader.id,
            p_market_id: market.id,
            p_current_price: market.mazneCurrent,
            p_tether_rate: 97000,
          });
          if (data) {
            const m = data as unknown as { percentage: number; zone: 'safe' | 'warn' | 'risk' | 'call' };
            if (m.zone !== 'safe') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const profile = await (supabase as any).from('profiles').select('*').eq('id', trader.id).single();
              if (profile.data) {
                riskUsers.push({ profile: profile.data as Profile, margin: { percentage: m.percentage, zone: m.zone } });
              }
            }
            if (m.percentage < 50) dangerCount++;
          }
        }
        setRiskTraders(riskUsers.slice(0, 8));
        setDangerZoneCount(dangerCount);
      }
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoadingKpis(false);
    }
  }, [today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRealtime({ table: 'orders' }, () => { fetchData(); }, []);
  useRealtime({ table: 'trades' }, () => { fetchData(); }, []);

  async function handleSaveMazne() {
    if (!activeMarket) return;
    const val = parseInt(mazneInput, 10);
    if (!val || val <= 0) { toast.error('مزنه نامعتبر'); return; }
    setSavingMazne(true);
    try {
      await (supabase as any).rpc('update_mazne', { p_market_id: activeMarket.id, p_new_mazne: val });
      setActiveMarket({ ...activeMarket, mazneCurrent: val });
      toast.success('مزنه بروزرسانی شد');
      setEditingMazne(false);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setSavingMazne(false);
    }
  }

  const lockMins = Math.floor(lockCountdown / 60);
  const lockSecs = lockCountdown % 60;
  const lockLabel = `${String(lockMins).padStart(2, '0')}:${String(lockSecs).padStart(2, '0')}`;

  return (
    <div className="space-y-6" dir="rtl">

      {/* Row 1: Time + Market info */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-4">
          <span
            className="tabular-nums text-2xl font-bold"
            style={{ color: 'var(--accent-gold)', fontFamily: "'Geist Mono', monospace" }}
          >
            {tick ? toFa(tick.tehranTime) : '——:——:——'}
          </span>
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
            )}
            style={
              isLocked
                ? {
                    backgroundColor: 'color-mix(in srgb, var(--semantic-danger) 15%, transparent)',
                    color: 'var(--semantic-danger)',
                  }
                : {
                    backgroundColor: 'color-mix(in srgb, var(--semantic-success) 15%, transparent)',
                    color: 'var(--semantic-success)',
                  }
            }
          >
            {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
            {isLocked ? 'قفل شده' : 'باز'}
          </span>
          {!isLocked && lockCountdown > 0 && (
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              <span
                className="tabular-nums font-semibold"
                style={{ color: 'var(--accent-gold-bright)', fontFamily: "'Geist Mono', monospace" }}
              >
                {toFa(lockLabel)}
              </span>
              {' '}تا قفل
            </span>
          )}
        </div>

        {activeMarket && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {activeMarket.name}
            </span>
            <div className="flex items-center gap-1.5">
              {editingMazne ? (
                <>
                  <input
                    type="number"
                    value={mazneInput}
                    onChange={(e) => setMazneInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSaveMazne();
                      if (e.key === 'Escape') setEditingMazne(false);
                    }}
                    autoFocus
                    className="w-36 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none"
                    style={{ borderColor: 'var(--accent-gold)', color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveMazne()}
                    disabled={savingMazne}
                    className="rounded p-1 transition-colors hover:bg-white/10"
                    style={{ color: 'var(--semantic-success)' }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingMazne(false)}
                    className="rounded p-1 transition-colors hover:bg-white/10"
                    style={{ color: 'var(--semantic-danger)' }}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="tabular-nums font-semibold"
                    style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
                  >
                    {formatTomans(activeMarket.mazneCurrent)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setMazneInput(String(activeMarket.mazneCurrent)); setEditingMazne(true); }}
                    className="rounded p-1 transition-colors hover:bg-white/10"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <Pencil size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Row 2: KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="تریدرهای فعال" value={activeTraders} loading={loadingKpis} />
        <KpiCard label="حجم امروز" value={toFa(todayVolume) + ' واحد'} loading={loadingKpis} />
        <KpiCard label="سفارش‌های باز" value={openOrdersCount} loading={loadingKpis} />
        <KpiCard label="در محدوده خطر" value={dangerZoneCount} highlight={dangerZoneCount > 0} loading={loadingKpis} />
      </div>

      {/* Row 3: Order book mini + Risk panel */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Mini order book */}
        <div
          className="overflow-hidden rounded-xl border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <p className="border-b px-4 py-2.5 text-xs font-semibold" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
            دفتر سفارش (top 5)
          </p>
          <div className="flex">
            {/* Asks */}
            <div className="flex-1 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
              <p className="px-3 py-1.5 text-xs" style={{ color: 'var(--semantic-sell)' }}>فروش</p>
              {topAsks.length === 0 ? (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>خالی</p>
              ) : (
                topAsks.map((o) => (
                  <div key={o.id} className="flex justify-between px-3 py-1 text-xs">
                    <span className="tabular-nums" style={{ color: 'var(--semantic-sell)', fontFamily: "'Geist Mono', monospace" }}>
                      {formatTomans(o.priceToman)}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{toFa(o.remaining)}</span>
                  </div>
                ))
              )}
            </div>
            {/* Bids */}
            <div className="flex-1">
              <p className="px-3 py-1.5 text-xs" style={{ color: 'var(--semantic-buy)' }}>خرید</p>
              {topBids.length === 0 ? (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>خالی</p>
              ) : (
                topBids.map((o) => (
                  <div key={o.id} className="flex justify-between px-3 py-1 text-xs">
                    <span className="tabular-nums" style={{ color: 'var(--semantic-buy)', fontFamily: "'Geist Mono', monospace" }}>
                      {formatTomans(o.priceToman)}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{toFa(o.remaining)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Risk panel */}
        <div
          className="overflow-hidden rounded-xl border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <p className="border-b px-4 py-2.5 text-xs font-semibold" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
            تریدرهای در ریسک
          </p>
          {riskTraders.length === 0 ? (
            <p className="px-4 py-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              همه تریدرها در وضعیت سالم هستند
            </p>
          ) : (
            <div className="divide-y" style={{ '--divide-color': 'var(--border-subtle)' } as React.CSSProperties}>
              {riskTraders.map((u) => (
                <div key={u.profile.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{u.profile.full_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-xs" style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}>
                      {toFa(u.margin.percentage.toFixed(1))}٪
                    </span>
                    <ZoneBadge zone={u.margin.zone} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Recent trades */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <p className="border-b px-4 py-2.5 text-xs font-semibold" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          آخرین معاملات
        </p>
        {recentTrades.length === 0 ? (
          <p className="px-4 py-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>معامله‌ای ثبت نشده</p>
        ) : (
          <div className="divide-y" style={{ '--divide-color': 'var(--border-subtle)' } as React.CSSProperties}>
            {recentTrades.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}>
                  {formatTomans(t.priceToman)}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{toFa(t.quantity)} واحد</span>
                <span style={{ color: 'var(--text-tertiary)' }}>
                  {toFa(new Date(t.matchedAt).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 5: Pending approvals */}
      {pendingTraders.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            در انتظار تأیید ({toFa(pendingTraders.length)})
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingTraders.map((pt) => (
              <div
                key={pt.id}
                className="rounded-xl border p-4"
                style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--accent-gold) 15%, transparent)',
                      color: 'var(--accent-gold)',
                    }}
                  >
                    {pt.full_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pt.full_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{toFa(pt.phone)}</p>
                  </div>
                </div>
                {pt.telegram_id && (
                  <p className="mb-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    @{pt.telegram_id}
                  </p>
                )}
                <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  ثبت‌نام: {toFa(new Date(pt.created_at).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }))}
                </p>
                <button
                  type="button"
                  onClick={() => setApproveTrader(pt)}
                  className="w-full rounded-lg py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ backgroundColor: 'var(--semantic-success)', color: '#000' }}
                >
                  تأیید
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approve modal */}
      {approveTrader && (
        <ApproveModal
          trader={approveTrader}
          onClose={() => setApproveTrader(null)}
          onApproved={fetchData}
        />
      )}
    </div>
  );
}


