import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { toFa, formatTomans } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { useTimeStore } from '@/stores/time.store';
import { useRealtime } from '@/hooks/useRealtime';
import { repos } from '@/data/repositories/index';
import { supabase } from '@/lib/supabase';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

import type { Market, Order, Trade } from '@/domain/types';
import type { Profile } from '@/lib/database.types';
import { Lock, Unlock, Pencil, Check, X, ChevronLeft, UserPlus, TrendingDown } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// داشبورد روی سه سؤال ساخته شده، نه روی «هرچه داریم را نشان بده»:
//   ۱. بازار در چه حالی است؟      → نوار بالا (مزنه بزرگ‌ترین عدد صفحه)
//   ۲. چه چیزی کار من را می‌خواهد؟ → فهرست «نیاز به رسیدگی»
//   ۳. امروز چطور گذشت؟           → نبض امروز (نمودار + چهار عدد)
// بقیه چیزها صفحهٔ اختصاصی خودشان را دارند و اینجا تکرار نمی‌شوند.
// ─────────────────────────────────────────────────────────────────────────────

interface MarginInfo { lossPct: number; zone: 'safe' | 'warn' | 'call' }

/** یک کار روی میز مدیر — همه در یک فهرست، مرتب‌شده بر اساس فوریت */
interface ActionItem {
  id: string;
  kind: 'call' | 'warn' | 'approval';
  name: string;
  detail: string;
  profile: Profile;
}

const KIND_ORDER: Record<ActionItem['kind'], number> = { call: 0, warn: 1, approval: 2 };

const KIND_STYLE: Record<ActionItem['kind'], { color: string; label: string }> = {
  call:     { color: 'var(--semantic-danger)',  label: 'حراج' },
  warn:     { color: 'var(--semantic-warn)',    label: 'هشدار' },
  approval: { color: 'var(--text-tertiary)',    label: 'عضویت' },
};

// ─── تاریخ ───────────────────────────────────────────────────────────────────

function jalaliParts() {
  const fmt = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran', calendar: 'persian', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const p = fmt.formatToParts(new Date());
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { y: get('year'), m: get('month'), d: get('day') };
}

function getTodayJalali(): string {
  const { y, m, d } = jalaliParts();
  return `${y}/${m}/${d}`;
}

const MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

function longDate(): string {
  const { y, m, d } = jalaliParts();
  const weekday = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran', weekday: 'long',
  }).format(new Date());
  return `${weekday} ${toFa(Number(d))} ${MONTHS[Number(m) - 1] ?? ''} ${toFa(y)}`;
}

// ─── مودال تأیید تریدر ───────────────────────────────────────────────────────

function ApproveModal({ trader, onClose, onApproved }: {
  trader: Profile; onClose: () => void; onApproved: () => void;
}) {
  const [deposit, setDeposit] = useState('');
  const [perUnit, setPerUnit] = useState('500');
  const [commission, setCommission] = useState('1');
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    const dep = parseFloat(deposit);
    if (!dep || dep <= 0) { toast.error('ودیعه را وارد کنید'); return; }
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('approve_trader', {
        p_trader_id: trader.id,
        p_deposit: dep,
        p_per_unit_deposit: parseFloat(perUnit),
        p_commission: parseFloat(commission),
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
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-scrim)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          تأیید {trader.full_name}
        </h3>
        <p className="mb-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          بعد از تأیید، کاربر می‌تواند در گروه لفظ بزند.
        </p>
        <div className="space-y-3">
          {[
            { label: 'ودیعه (تتر)', value: deposit, setter: setDeposit, placeholder: '۵۰۰۰' },
            { label: 'بیعانهٔ هر واحد (تتر)', value: perUnit, setter: setPerUnit, placeholder: '۵۰۰' },
            { label: 'کمیسیون هر واحد (تتر)', value: commission, setter: setCommission, placeholder: '۱' },
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
            type="button" onClick={onClose}
            className="flex-1 rounded-lg py-2 text-sm font-medium hover:bg-[var(--surface-tint)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            انصراف
          </button>
          <button
            type="button" onClick={() => void handleApprove()} disabled={loading}
            className="flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: 'var(--semantic-success)', color: 'var(--text-on-accent)' }}
          >
            {loading ? 'در حال ثبت…' : 'تأیید'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── صفحه ────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { isLocked, lockCountdown } = useTimeStore();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketId, setMarketId] = useState<string | null>(null);
  const [activeTraders, setActiveTraders] = useState(0);
  const [todayVolume, setTodayVolume] = useState(0);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [todayTrades, setTodayTrades] = useState<Trade[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingMazne, setEditingMazne] = useState(false);
  const [mazneInput, setMazneInput] = useState('');
  const [savingMazne, setSavingMazne] = useState(false);
  const [approveTrader, setApproveTrader] = useState<Profile | null>(null);

  const today = getTodayJalali();
  const market = useMemo(
    () => markets.find((m) => m.id === marketId) ?? null,
    [markets, marketId],
  );

  const fetchData = useCallback(async () => {
    try {
      const allMarkets = (await repos.markets.getAll()).filter((m) => m.active);
      setMarkets(allMarkets);

      const current = allMarkets.find((m) => m.id === marketId) ?? allMarkets[0] ?? null;
      if (!current) { setLoading(false); return; }
      if (current.id !== marketId) setMarketId(current.id);

      // پروفایل‌ها یک‌بار خوانده می‌شوند — قبلاً به‌ازای هر تریدر یک کوئری
      // جداگانه می‌رفت و با ۲۰ تریدر تا ۴۰ رفت‌وبرگشت پشت‌سرهم می‌شد.
      const { data: profileRows } = await supabase
        .from('profiles').select('*').eq('role', 'trader');
      const traders = (profileRows as Profile[]) ?? [];
      const active = traders.filter((t) => t.active);
      const pending = traders.filter((t) => !t.active);
      setActiveTraders(active.length);

      const [trades, orders] = await Promise.all([
        repos.trades.getByMarketAndDate(current.id, today),
        repos.orders.getByMarketAndDate(current.id, today),
      ]);
      setTodayVolume(trades.reduce((s, t) => s + t.quantity, 0));
      setTodayTrades(trades);
      setOpenOrders(orders.filter((o) => o.status === 'open' || o.status === 'partial'));

      // نرخ تتر دینامیک است و از خود بازار می‌آید — قبلاً ۹۷۰۰۰ ثابت بود
      const tetherRate = current.tetherRateToday ?? current.tetherRateTomorrow ?? 97_000;

      // محاسبهٔ مارجین همهٔ تریدرها موازی، نه پشت‌سرهم
      const margins = await Promise.all(
        active.map(async (t): Promise<[Profile, MarginInfo | null]> => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any).rpc('compute_user_margin', {
            p_user_id: t.id,
            p_market_id: current.id,
            p_current_price: current.mazneCurrent,
            p_tether_rate: tetherRate,
          });
          if (!data) return [t, null];
          const raw = data as { percentage?: number; loss_percentage?: number; zone: MarginInfo['zone'] };
          const lossPct = raw.loss_percentage ?? (100 - (raw.percentage ?? 100));
          return [t, { lossPct, zone: raw.zone }];
        }),
      );

      const items: ActionItem[] = [];
      for (const [profile, m] of margins) {
        if (!m || m.zone === 'safe') continue;
        items.push({
          id: profile.id,
          kind: m.zone,
          name: profile.alias || profile.full_name,
          detail: `زیان ودیعه ${toFa(m.lossPct.toFixed(0))}٪`,
          profile,
        });
      }
      for (const p of pending) {
        items.push({
          id: p.id, kind: 'approval',
          name: p.full_name,
          detail: p.telegram_id ? `@${p.telegram_id}` : p.phone,
          profile: p,
        });
      }
      items.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
      setActions(items);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, [today, marketId]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useRealtime({ table: 'orders' }, () => { void fetchData(); }, []);
  useRealtime({ table: 'trades' }, () => { void fetchData(); }, []);

  async function handleSaveMazne() {
    if (!market) return;
    const val = parseInt(mazneInput, 10);
    if (!val || val <= 0) { toast.error('مزنه نامعتبر'); return; }
    setSavingMazne(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('update_mazne', { p_market_id: market.id, p_new_mazne: val });
      setMarkets((ms) => ms.map((m) => (m.id === market.id ? { ...m, mazneCurrent: val } : m)));
      toast.success('مزنه به‌روز شد');
      setEditingMazne(false);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setSavingMazne(false);
    }
  }

  const lockLabel = `${String(Math.floor(lockCountdown / 60)).padStart(2, '0')}:${String(lockCountdown % 60).padStart(2, '0')}`;

  const bids = useMemo(
    () => openOrders.filter((o) => o.side === 'buy').sort((a, b) => b.priceToman - a.priceToman).slice(0, 5),
    [openOrders],
  );
  const asks = useMemo(
    () => openOrders.filter((o) => o.side === 'sell').sort((a, b) => a.priceToman - b.priceToman).slice(0, 5),
    [openOrders],
  );
  const maxDepth = useMemo(
    () => Math.max(1, ...[...bids, ...asks].map((o) => o.remaining)),
    [bids, asks],
  );

  /** نمودار نبض: قیمت معاملات امروز به‌ترتیب زمان */
  const chartData = useMemo(
    () => [...todayTrades]
      .sort((a, b) => new Date(a.matchedAt ?? 0).getTime() - new Date(b.matchedAt ?? 0).getTime())
      .map((t, i) => ({ i, price: t.priceToman, qty: t.quantity })),
    [todayTrades],
  );

  const callCount = actions.filter((a) => a.kind === 'call').length;

  return (
    <div className="space-y-5" dir="rtl">

      {/* ── نوار بالا: حال بازار ───────────────────────────────────────── */}
      <section
        className="rounded-2xl border px-5 py-5 sm:px-6"
        style={{
          // accent-surface سطح پرِ برند است (دکمهٔ اصلی) و اینجا یک تختهٔ
          // طلایی می‌ساخت که متن رویش خوانا نبود. wash تینت ملایم آن است.
          backgroundColor: 'var(--accent-wash)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">

          {/* سمت راست (شروع RTL): بازار و مزنه */}
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {markets.map((m) => {
                const on = m.id === marketId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMarketId(m.id); setEditingMazne(false); }}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    style={on
                      ? { backgroundColor: 'var(--accent-gold)', color: 'var(--text-on-accent)' }
                      : { color: 'var(--text-secondary)', backgroundColor: 'var(--surface-tint)' }}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>

            <p className="mb-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              مزنهٔ جاری
            </p>

            {editingMazne ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={mazneInput}
                  onChange={(e) => setMazneInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveMazne();
                    if (e.key === 'Escape') setEditingMazne(false);
                  }}
                  autoFocus
                  className="w-44 rounded-lg border bg-transparent px-3 py-1.5 text-lg outline-none tabular-nums"
                  style={{ borderColor: 'var(--accent-gold)', color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
                />
                <button
                  type="button" onClick={() => void handleSaveMazne()} disabled={savingMazne}
                  className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-tint-strong)]"
                  style={{ color: 'var(--semantic-success)' }}
                  aria-label="ذخیرهٔ مزنه"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button" onClick={() => setEditingMazne(false)}
                  className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-tint-strong)]"
                  style={{ color: 'var(--semantic-danger)' }}
                  aria-label="انصراف"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setMazneInput(String(market?.mazneCurrent ?? '')); setEditingMazne(true); }}
                className="group flex items-baseline gap-2 text-right"
                title="ویرایش مزنه"
              >
                <span
                  className="text-3xl font-bold tabular-nums sm:text-4xl"
                  style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
                >
                  {market ? toFa(market.mazneCurrent.toLocaleString('en-US')) : '—'}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>تومان</span>
                <Pencil
                  size={13}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: 'var(--text-tertiary)' }}
                />
              </button>
            )}
          </div>

          {/* سمت چپ: تاریخ و وضعیت قفل.
              ساعت اینجا تکرار نمی‌شود — نوار بالای پوسته آن را در همهٔ
              صفحه‌ها نشان می‌دهد و دو ساعت کنار هم فقط شلوغی بود. */}
          <div className="text-left">
            <p className="mb-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{longDate()}</p>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={isLocked
                ? { backgroundColor: 'color-mix(in srgb, var(--semantic-danger) 15%, transparent)', color: 'var(--semantic-danger)' }
                : { backgroundColor: 'color-mix(in srgb, var(--semantic-success) 15%, transparent)', color: 'var(--semantic-success)' }}
            >
              {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
              {isLocked ? 'بازار قفل است' : `${toFa(lockLabel)} تا قفل`}
            </span>
          </div>
        </div>
      </section>

      {/* ── نیاز به رسیدگی + نبض امروز ─────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-5">

        {/* فهرست کارها — ستون پهن‌تر، چون مهم‌ترین بخش صفحه است */}
        <section
          className="overflow-hidden rounded-2xl border lg:col-span-3"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <header className="flex items-center justify-between px-5 py-3.5">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              نیاز به رسیدگی
            </h2>
            {actions.length > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
                style={callCount > 0
                  ? { backgroundColor: 'color-mix(in srgb, var(--semantic-danger) 15%, transparent)', color: 'var(--semantic-danger)' }
                  : { backgroundColor: 'var(--surface-tint-strong)', color: 'var(--text-secondary)' }}
              >
                {toFa(actions.length)}
              </span>
            )}
          </header>

          {loading ? (
            <div className="space-y-2 px-5 pb-5">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton-shimmer h-11 rounded-lg" />)}
            </div>
          ) : actions.length === 0 ? (
            <p className="px-5 pb-6 pt-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              چیزی روی میز نیست — همهٔ تریدرها سالم‌اند و درخواست عضویتی در صف نیست.
            </p>
          ) : (
            <ul>
              {actions.slice(0, 7).map((a) => {
                const s = KIND_STYLE[a.kind];
                return (
                  <li key={`${a.kind}-${a.id}`}>
                    <button
                      type="button"
                      onClick={() => { if (a.kind === 'approval') setApproveTrader(a.profile); }}
                      className="flex w-full items-center gap-3 border-t px-5 py-3 text-right transition-colors hover:bg-[var(--surface-tint)]"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }}
                      >
                        {a.kind === 'approval' ? <UserPlus size={14} /> : <TrendingDown size={14} />}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {a.name}
                        </span>
                        <span className="block truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {a.detail}
                        </span>
                      </span>

                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }}
                      >
                        {s.label}
                      </span>
                      <ChevronLeft size={15} style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* نبض امروز */}
        <section
          className="flex flex-col overflow-hidden rounded-2xl border lg:col-span-2"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <header className="px-5 pt-3.5">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>نبض امروز</h2>
          </header>

          <div className="h-28 px-2 pt-2">
            {chartData.length < 2 ? (
              <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
                هنوز معامله‌ای ثبت نشده
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip
                    cursor={{ stroke: 'var(--border-strong)' }}
                    contentStyle={{
                      backgroundColor: 'var(--bg-overlay)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 10,
                      fontSize: 12,
                      direction: 'rtl',
                    }}
                    labelFormatter={() => ''}
                    formatter={(v) => [formatTomans(Number(v ?? 0)), 'قیمت']}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="var(--accent-gold)"
                    strokeWidth={2}
                    fill="url(#pulseFill)"
                    isAnimationActive={false}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <dl className="mt-auto grid grid-cols-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            {[
              { label: 'حجم امروز', value: `${toFa(todayVolume)} واحد` },
              { label: 'تریدر فعال', value: toFa(activeTraders) },
              { label: 'لفظ باز', value: toFa(openOrders.length) },
              { label: 'در حراج', value: toFa(callCount), danger: callCount > 0 },
            ].map((s, i) => (
              <div
                key={s.label}
                className="px-5 py-3"
                style={{
                  borderColor: 'var(--border-subtle)',
                  borderTopWidth: i > 1 ? 1 : 0,
                  borderLeftWidth: i % 2 === 0 ? 1 : 0,
                }}
              >
                <dt className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{s.label}</dt>
                <dd
                  className="mt-0.5 text-base font-bold tabular-nums"
                  style={{
                    color: s.danger ? 'var(--semantic-danger)' : 'var(--text-primary)',
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* ── دفتر لفظ ───────────────────────────────────────────────────── */}
      <section
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <header className="flex items-baseline justify-between px-5 py-3.5">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>دفتر لفظ</h2>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>پنج ردیف نزدیک به مزنه</span>
        </header>

        <div className="grid sm:grid-cols-2">
          {([
            { rows: asks, side: 'فروش', color: 'var(--semantic-sell)' },
            { rows: bids, side: 'خرید', color: 'var(--semantic-buy)' },
          ] as const).map((col, ci) => (
            <div
              key={col.side}
              className="border-t"
              style={{
                borderColor: 'var(--border-subtle)',
                borderLeftWidth: ci === 0 ? 1 : 0,
              }}
            >
              <p className="px-5 py-2 text-xs font-semibold" style={{ color: col.color }}>{col.side}</p>
              {col.rows.length === 0 ? (
                <p className="px-5 pb-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>خالی</p>
              ) : (
                col.rows.map((o) => (
                  <div key={o.id} className="relative flex items-center justify-between px-5 py-1.5">
                    {/* نوار عمق: پهنا نسبت مستقیم با حجم باقی‌مانده دارد */}
                    <span
                      className="pointer-events-none absolute inset-y-0 right-0"
                      style={{
                        width: `${(o.remaining / maxDepth) * 100}%`,
                        backgroundColor: `color-mix(in srgb, ${col.color} 9%, transparent)`,
                      }}
                    />
                    <span
                      className="relative tabular-nums text-xs"
                      style={{ color: col.color, fontFamily: "'Geist Mono', monospace" }}
                    >
                      {toFa(o.priceToman.toLocaleString('en-US'))}
                    </span>
                    <span className="relative text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {toFa(o.remaining)}
                    </span>
                  </div>
                ))
              )}
              <div className="pb-3" />
            </div>
          ))}
        </div>
      </section>

      {approveTrader && (
        <ApproveModal
          trader={approveTrader}
          onClose={() => setApproveTrader(null)}
          onApproved={() => void fetchData()}
        />
      )}
    </div>
  );
}
