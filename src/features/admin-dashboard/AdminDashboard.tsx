import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Pencil, X, ArrowUp, ArrowDown } from 'lucide-react';
import { money, toFa } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { tehranMinute, todayJalaliKey } from '@/lib/jalali';
import { gsap, useGSAP } from '@/lib/gsap';
import { useTimeStore } from '@/stores/time.store';
import { useRealtime } from '@/hooks/useRealtime';
import { repos } from '@/data/repositories/index';
import { supabase } from '@/lib/supabase';
import { GlassCard, CardHeader } from '@/ui/primitives/GlassCard';
import { SegmentedControl } from '@/ui/compounds/SegmentedControl';
import { Odometer } from '@/ui/compounds/Odometer';
import { CountUp } from '@/ui/compounds/CountUp';
import { SemiGauge } from '@/ui/compounds/SemiGauge';
import { PriceChart } from '@/ui/compounds/PriceChart';
import { AttentionList, ApproveModal, OrderLadder, RecentTrades, type ActionItem } from './parts';

import type { Market, Order, Trade } from '@/domain/types';
import type { Profile } from '@/lib/database.types';

// ─────────────────────────────────────────────────────────────────────────────
// داشبورد روی سه سؤال ساخته شده، نه روی «هرچه داریم را نشان بده»:
//   ۱. بازار در چه حالی است؟      → کارت بزرگ: مزنه + روند قیمت امروز
//   ۲. چه چیزی کار من را می‌خواهد؟ → سلامت ودیعه‌ها + «نیاز به رسیدگی»
//   ۳. امروز چطور گذشت؟           → آخرین معاملات، دفتر لفظ، برنامهٔ روز
// ─────────────────────────────────────────────────────────────────────────────

interface MarginInfo { lossPct: number; zone: 'safe' | 'warn' | 'call' }

const KIND_ORDER: Record<ActionItem['kind'], number> = { call: 0, warn: 1, approval: 2 };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { tick, isLocked } = useTimeStore();
  const root = useRef<HTMLDivElement>(null);

  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketId, setMarketId] = useState<string | null>(null);
  const [traders, setTraders] = useState<Profile[]>([]);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [todayTrades, setTodayTrades] = useState<Trade[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [margins, setMargins] = useState<MarginInfo[]>([]);
  const [settledToday, setSettledToday] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editingMazne, setEditingMazne] = useState(false);
  const [mazneInput, setMazneInput] = useState('');
  const [savingMazne, setSavingMazne] = useState(false);
  const [approveTrader, setApproveTrader] = useState<Profile | null>(null);

  const today = todayJalaliKey();
  const market = useMemo(() => markets.find((m) => m.id === marketId) ?? null, [markets, marketId]);
  const warnAt = market?.marginWarnPct ?? 75;
  const callAt = market?.marginLiquidatePct ?? 85;

  const fetchData = useCallback(async () => {
    try {
      const allMarkets = (await repos.markets.getAll()).filter((m) => m.active);
      setMarkets(allMarkets);

      const current = allMarkets.find((m) => m.id === marketId) ?? allMarkets[0] ?? null;
      if (!current) { setLoading(false); return; }
      if (current.id !== marketId) setMarketId(current.id);

      // پروفایل‌ها یک‌بار خوانده می‌شوند — نه یک کوئری به‌ازای هر تریدر
      const { data: profileRows } = await supabase.from('profiles').select('*').eq('role', 'trader');
      const all = (profileRows as Profile[]) ?? [];
      const active = all.filter((t) => t.active);
      const pending = all.filter((t) => !t.active);
      setTraders(all);

      const [trades, orders, settlements] = await Promise.all([
        repos.trades.getByMarketAndDate(current.id, today),
        repos.orders.getByMarketAndDate(current.id, today),
        repos.settlements.getAll({ marketId: current.id }),
      ]);
      setTodayTrades(trades);
      setOpenOrders(orders.filter((o) => o.status === 'open' || o.status === 'partial'));
      setSettledToday(settlements.some((s) => s.settlementDate === today && !s.reversedAt));

      // نرخ تتر دینامیک است و از خود بازار می‌آید
      const tetherRate = current.tetherRateToday ?? current.tetherRateTomorrow ?? 97_000;

      // مارجین همهٔ تریدرها موازی، نه پشت‌سرهم
      const computed = await Promise.all(
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
      setMargins(computed.flatMap(([, m]) => (m ? [m] : [])));

      const items: ActionItem[] = [];
      for (const [profile, m] of computed) {
        if (!m || m.zone === 'safe') continue;
        items.push({
          id: profile.id, kind: m.zone, profile,
          name: profile.alias || profile.full_name,
          detail: `زیان ودیعه ${toFa(m.lossPct.toFixed(0))}٪`,
          lossPct: m.lossPct,
        });
      }
      for (const p of pending) {
        items.push({ id: p.id, kind: 'approval', profile: p, name: p.full_name, detail: p.telegram_id ? `@${p.telegram_id}` : p.phone });
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

  // ─── داده‌های مشتق ─────────────────────────────────────────────────────────
  const names = useMemo(() => new Map(traders.map((t) => [t.id, t.alias || t.full_name])), [traders]);
  const sortedTrades = useMemo(
    () => [...todayTrades].sort((a, b) => new Date(a.matchedAt ?? 0).getTime() - new Date(b.matchedAt ?? 0).getTime()),
    [todayTrades],
  );
  const chartData = useMemo(
    () => sortedTrades.filter((t) => t.matchedAt).map((t) => ({ minute: tehranMinute(t.matchedAt), price: t.priceToman, qty: t.quantity })),
    [sortedTrades],
  );
  const lastTrade = sortedTrades.at(-1);
  const dayChange = sortedTrades.length > 1 ? lastTrade!.priceToman - sortedTrades[0]!.priceToman : 0;
  const volume = todayTrades.reduce((s, t) => s + t.quantity, 0);
  const bids = useMemo(() => openOrders.filter((o) => o.side === 'buy').sort((a, b) => b.priceToman - a.priceToman).slice(0, 4), [openOrders]);
  const asks = useMemo(() => openOrders.filter((o) => o.side === 'sell').sort((a, b) => a.priceToman - b.priceToman).slice(0, 4), [openOrders]);

  const avgLoss = margins.length ? margins.reduce((s, m) => s + m.lossPct, 0) / margins.length : 0;
  const zoneCount = { safe: 0, warn: 0, call: 0 };
  for (const m of margins) zoneCount[m.zone] += 1;
  const totalDeposit = traders.filter((t) => t.active).reduce((s, t) => s + (t.deposit_tether ?? 0), 0);

  const nowHour = tick ? Number(tick.tehranTime.slice(0, 2)) : 0;
  const steps = [
    { label: 'افتتاح بازار', time: '۹:۰۰', state: nowHour >= 9 ? 'done' : 'next' },
    { label: 'قفل امروزی', time: '۱۳:۳۰', state: isLocked ? 'done' : nowHour >= 9 ? 'now' : 'next' },
    { label: 'تصفیهٔ روزانه', time: '۱۳:۳۵', state: settledToday ? 'done' : isLocked ? 'now' : 'next' },
  ] as const;

  // ─── ورود کارت‌ها ───────────────────────────────────────────────────────────
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.dash-card', { y: 26, autoAlpha: 0, stagger: 0.08, duration: 0.8, ease: 'power3.out', clearProps: 'transform' });
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root} className="grid grid-cols-12 gap-[18px]" dir="rtl">

      {/* ── مزنه و روند امروز ─────────────────────────────────────────── */}
      <GlassCard
        data-tour="hero"
        className="dash-card col-span-12 flex min-h-[560px] flex-col p-6 xl:col-span-8 xl:row-span-2"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.78), rgba(255,246,226,.55))' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {markets.length > 0 && marketId && (
            <SegmentedControl
              aria-label="انتخاب بازار"
              items={markets.map((m) => ({ value: m.id, label: m.name }))}
              value={marketId}
              onChange={(id) => { setMarketId(id); setEditingMazne(false); }}
            />
          )}
          {isLocked && (
            <span className="ms-auto rounded-[9px] px-2.5 py-1 text-[13px] font-bold" style={{ background: 'var(--sell-wash)', color: 'var(--semantic-sell)' }}>
              بعد از قفل — لفظ‌ها فردایی‌اند
            </span>
          )}
        </div>

        <p className="mt-4 text-[14px]" style={{ color: 'var(--text-tertiary)' }}>مزنهٔ جاری {market ? `· ${market.name}` : ''}</p>

        <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-2">
          {editingMazne ? (
            <div className="flex items-center gap-2 py-2">
              <input
                type="number" value={mazneInput} autoFocus
                onChange={(e) => setMazneInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveMazne(); if (e.key === 'Escape') setEditingMazne(false); }}
                className="h-14 w-60 rounded-[14px] border bg-white/80 px-4 text-[30px] font-bold outline-none"
                style={{ borderColor: 'var(--gold)', color: 'var(--text-primary)', fontFamily: 'var(--font-num)' }}
              />
              <button type="button" onClick={() => void handleSaveMazne()} disabled={savingMazne} aria-label="ذخیرهٔ مزنه"
                className="grid h-11 w-11 place-items-center rounded-[12px] text-white" style={{ background: 'var(--semantic-success)' }}>
                <Check size={18} />
              </button>
              <button type="button" onClick={() => setEditingMazne(false)} aria-label="انصراف"
                className="grid h-11 w-11 place-items-center rounded-[12px]" style={{ background: 'var(--surface-tint-strong)', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
          ) : (
            <button
              type="button" title="برای ویرایش مزنه بزنید"
              onClick={() => { setMazneInput(String(market?.mazneCurrent ?? '')); setEditingMazne(true); }}
              className="group flex items-end gap-3 text-right"
            >
              {market ? (
                <Odometer value={market.mazneCurrent} className="text-[64px] font-bold tracking-tight sm:text-[76px]" style={{ color: 'var(--text-primary)' }} />
              ) : (
                <span className="text-[64px] font-bold" style={{ color: 'var(--text-tertiary)' }}>—</span>
              )}
              <span className="pb-3 text-[19px]" style={{ color: 'var(--text-secondary)' }}>تومان</span>
              <Pencil size={15} className="mb-4 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          )}
          {dayChange !== 0 && (
            <span
              className="mb-3.5 inline-flex h-[30px] items-center gap-1 rounded-[9px] px-2.5 text-[14px] font-bold"
              title="تغییر از اولین معاملهٔ امروز"
              style={dayChange > 0 ? { background: 'var(--buy-wash)', color: 'var(--semantic-buy)' } : { background: 'var(--sell-wash)', color: 'var(--semantic-sell)' }}
            >
              {dayChange > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              {money(Math.abs(dayChange))}
            </span>
          )}
        </div>

        <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
          {[
            ['تتر امروزی', market?.tetherRateToday ? money(market.tetherRateToday) : '—'],
            ['تتر فردایی', market?.tetherRateTomorrow ? money(market.tetherRateTomorrow) : '—'],
            ['آخرین معامله', lastTrade ? money(lastTrade.priceToman) : '—'],
            ['حجم امروز', `${toFa(volume)} واحد`],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-1.5"><dt>{k}</dt><dd className="font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-num)' }}>{v}</dd></div>
          ))}
        </dl>

        <div className="mt-3 min-h-[300px] flex-1">
          {loading ? <div className="skeleton-shimmer h-full rounded-[16px]" /> : <PriceChart data={chartData} />}
        </div>
      </GlassCard>

      {/* ── سلامت ودیعه‌ها ────────────────────────────────────────────── */}
      <GlassCard data-tour="gauge" className="dash-card col-span-12 p-6 md:col-span-6 xl:col-span-4">
        <CardHeader title="مصرف ودیعهٔ اتاق" aside="میانگین معامله‌گرها" />
        <SemiGauge value={avgLoss} warnAt={warnAt} callAt={callAt}>
          <CountUp value={avgLoss} decimals={1} suffix="٪" className="block text-[40px] font-bold leading-none" style={{ color: 'var(--text-primary)' }} />
          <span className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
            {avgLoss >= callAt ? 'در محدودهٔ حراج' : avgLoss >= warnAt ? 'بالای آستانهٔ هشدار' : 'زیر آستانهٔ هشدار'}
          </span>
        </SemiGauge>
        <div className="mt-4 grid grid-cols-3 border-t pt-3 text-[13px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {[
            ['امن', zoneCount.safe, 'var(--gold)'],
            [`هشدار ${toFa(warnAt)}٪`, zoneCount.warn, 'var(--amber)'],
            [`حراج ${toFa(callAt)}٪`, zoneCount.call, 'var(--semantic-sell)'],
          ].map(([label, n, c]) => (
            <div key={String(label)}>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[3px]" style={{ background: String(c) }} />{label}</span>
              <b className="block text-[18px]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-num)' }}>{toFa(Number(n))} نفر</b>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ── نیاز به رسیدگی ────────────────────────────────────────────── */}
      <GlassCard data-tour="attention" className="dash-card col-span-12 p-6 md:col-span-6 xl:col-span-4">
        <CardHeader title="نیاز به رسیدگی" aside={actions.length ? `${toFa(actions.length)} مورد` : undefined} />
        {loading
          ? <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton-shimmer h-12 rounded-[12px]" />)}</div>
          : <AttentionList items={actions} warnAt={warnAt} callAt={callAt} onApprove={setApproveTrader} />}
      </GlassCard>

      {/* ── آخرین معاملات ─────────────────────────────────────────────── */}
      <GlassCard className="dash-card col-span-12 p-6 lg:col-span-6 xl:col-span-5">
        <CardHeader title="آخرین معاملات" aside={<button type="button" onClick={() => navigate('/admin/trades')} className="hover:underline">همه</button>} />
        <RecentTrades trades={[...sortedTrades].reverse().slice(0, 5)} names={names} />
      </GlassCard>

      {/* ── دفتر لفظ ──────────────────────────────────────────────────── */}
      <GlassCard data-tour="book" className="dash-card col-span-12 p-6 md:col-span-6 lg:col-span-6 xl:col-span-4">
        <CardHeader title="دفتر لفظ" aside="نزدیک به مزنه" />
        <OrderLadder asks={asks} bids={bids} mazne={market?.mazneCurrent ?? 0} />
      </GlassCard>

      {/* ── ودیعه‌ها و برنامهٔ روز ────────────────────────────────────── */}
      <GlassCard data-tour="day" className="dash-card col-span-12 flex flex-col p-6 md:col-span-6 xl:col-span-3">
        <CardHeader title="کل ودیعه‌ها" />
        <div className="flex items-baseline gap-2">
          <CountUp value={totalDeposit} className="text-[38px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }} />
          <span className="text-[16px]" style={{ color: 'var(--text-tertiary)' }}>تتر</span>
        </div>
        <ol className="my-4 flex flex-col">
          {steps.map((s, i) => (
            <li key={s.label} className="relative flex items-center gap-2.5 py-[7px] text-[14px]"
              style={{ color: s.state === 'now' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: s.state === 'now' ? 700 : 400 }}>
              {i < steps.length - 1 && <span className="absolute right-[7px] top-[26px] h-[calc(100%-14px)] w-[2px]" style={{ background: 'var(--border-strong)' }} />}
              <span
                className="relative z-[1] h-4 w-4 shrink-0 rounded-full border-2"
                style={
                  s.state === 'done' ? { borderColor: 'var(--semantic-buy)', background: 'var(--semantic-buy)', boxShadow: 'inset 0 0 0 3px #fff' }
                  : s.state === 'now' ? { borderColor: 'var(--gold)', background: '#fff', boxShadow: '0 0 0 4px rgba(200,150,47,.18)' }
                  : { borderColor: 'var(--border-strong)', background: 'var(--paper)' }
                }
              />
              {s.label}
              <time className="ms-auto font-normal" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-num)' }}>{s.time}</time>
            </li>
          ))}
        </ol>
        <button
          type="button" onClick={() => navigate('/admin/settlement')}
          className="mt-auto h-11 w-full rounded-[13px] text-[15px] font-bold"
          style={{ color: '#FFF8E8', background: 'linear-gradient(180deg, #2C261C, #17140F)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.14), 0 10px 20px -10px rgba(27,24,19,.6)' }}
        >
          {settledToday ? 'دیدن تصفیهٔ امروز' : 'رفتن به تصفیه'}
        </button>
      </GlassCard>

      {approveTrader && (
        <ApproveModal trader={approveTrader} onClose={() => setApproveTrader(null)} onApproved={() => void fetchData()} />
      )}
    </div>
  );
}
