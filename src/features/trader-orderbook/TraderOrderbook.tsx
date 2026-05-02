import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { toFa, formatTomans } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useTimeStore } from '@/stores/time.store';
import { useRealtime } from '@/hooks/useRealtime';
import { repos } from '@/data/repositories/index';
import { supabase } from '@/lib/supabase';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import type { Market, Order, Trade } from '@/domain/types';
import { Lock } from 'lucide-react';

type SettlementType = 'today' | 'tomorrow';
type Side = 'buy' | 'sell';

interface OrderLevel {
  price: number;
  lafz: number;
  totalQty: number;
  count: number;
}

// تاریخ‌های میلادی برای query (دیتابیس از date میلادی استفاده می‌کند)
function getTodayGregorian(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getTomorrowGregorian(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// تاریخ جلالی برای نمایش
function gregorianToJalaliDisplay(g: string): string {
  // g = "YYYY-MM-DD" میلادی
  const date = new Date(g);
  const fmt = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'persian',
    numberingSystem: 'latn',
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}/${get('month')}/${get('day')}`;
}

function aggregateLevels(orders: Order[], side: Side): OrderLevel[] {
  const map = new Map<number, OrderLevel>();
  for (const o of orders) {
    if (o.side !== side || o.status === 'cancelled' || o.status === 'filled') continue;
    const key = o.priceToman;
    const existing = map.get(key);
    if (existing) {
      existing.totalQty += o.remaining;
      existing.count += 1;
    } else {
      map.set(key, { price: o.priceToman, lafz: o.lafz, totalQty: o.remaining, count: 1 });
    }
  }
  return Array.from(map.values());
}

interface DepthRowProps {
  level: OrderLevel;
  side: Side;
  maxQty: number;
  isBest: boolean;
}

function DepthRow({ level, side, maxQty, isBest }: DepthRowProps) {
  const pct = maxQty > 0 ? (level.totalQty / maxQty) * 100 : 0;
  const color = side === 'buy' ? 'var(--semantic-buy)' : 'var(--semantic-sell)';

  return (
    <div
      className={cn(
        'relative flex items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-white/5',
        isBest && 'rounded'
      )}
      style={
        isBest
          ? { boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 40%, transparent)` }
          : undefined
      }
    >
      {/* Depth bar behind */}
      <div
        className="pointer-events-none absolute inset-y-0"
        style={{
          [side === 'buy' ? 'right' : 'left']: 0,
          width: `${pct}%`,
          backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        }}
      />
      {/* Content */}
      <span
        className="relative tabular-nums font-medium"
        style={{ color, fontFamily: "'Geist Mono', monospace" }}
      >
        {formatTomans(level.price)}
      </span>
      <span className="relative" style={{ color: 'var(--text-secondary)' }}>
        {toFa(level.totalQty)} واحد
      </span>
      <span className="relative" style={{ color: 'var(--text-tertiary)' }}>
        {toFa(level.count)} سفارش
      </span>
    </div>
  );
}

interface RecentTradeRowProps {
  trade: Trade;
  isNew: boolean;
}

function RecentTradeRow({ trade, isNew }: RecentTradeRowProps) {
  return (
    <div
      className={cn('flex items-center justify-between px-3 py-1.5 text-xs', isNew && 'trade-flash')}
    >
      <span
        className="tabular-nums"
        style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
      >
        {formatTomans(trade.priceToman)}
      </span>
      <span style={{ color: 'var(--text-secondary)' }}>{toFa(trade.quantity)} واحد</span>
    </div>
  );
}

export default function TraderOrderbook() {
  const { profile } = useAuthStore();
  const { isLocked } = useTimeStore();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [settlementType, setSettlementType] = useState<SettlementType>('today');
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [newTradeIds, setNewTradeIds] = useState<Set<string>>(new Set());
  const [side, setSide] = useState<Side>('buy');
  const [lafz, setLafz] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Load markets
  useEffect(() => {
    repos.markets.getAll().then((all) => {
      const active = all.filter((m) => m.active);
      setMarkets(active);
      if (active.length > 0) setSelectedMarket(active[0]);
    }).catch((err) => {
      toast.error('خطا در بارگذاری بازار: ' + (err?.message ?? 'دوباره تلاش کنید'));
    });
  }, []);

  // settlementDate برای query (میلادی، چون ستون date میلادی است)
  const settlementDate = settlementType === 'today' ? getTodayGregorian() : getTomorrowGregorian();
  // برای نمایش جلالی
  const settlementDateDisplay = gregorianToJalaliDisplay(settlementDate);

  const fetchOrders = useCallback(async () => {
    if (!selectedMarket) return;
    setLoadingOrders(true);
    try {
      const data = await repos.orders.getByMarketAndDate(selectedMarket.id, settlementDate);
      setOrders(data);
    } catch (err) {
      toast.error('خطا در بارگذاری سفارش‌ها: ' + ((err as Error)?.message ?? ''));
    } finally {
      setLoadingOrders(false);
    }
  }, [selectedMarket, settlementDate]);

  const fetchTrades = useCallback(async () => {
    if (!selectedMarket) return;
    try {
      const data = await repos.trades.getByMarketAndDate(selectedMarket.id, settlementDate);
      setRecentTrades(data.slice(-10).reverse());
    } catch {
      // non-critical
    }
  }, [selectedMarket, settlementDate]);

  useEffect(() => {
    fetchOrders();
    fetchTrades();
  }, [fetchOrders, fetchTrades]);

  // Realtime orders
  useRealtime(
    { table: 'orders', filter: selectedMarket ? { column: 'market_id', value: selectedMarket.id } : undefined },
    () => { fetchOrders(); },
    [selectedMarket?.id],
  );

  // Realtime trades
  useRealtime(
    { table: 'trades', filter: selectedMarket ? { column: 'market_id', value: selectedMarket.id } : undefined },
    (payload) => {
      fetchTrades();
      const newId = (payload.new as { id?: string })?.id;
      if (newId) {
        setNewTradeIds((prev) => new Set(prev).add(newId));
        setTimeout(() => {
          setNewTradeIds((prev) => {
            const next = new Set(prev);
            next.delete(newId);
            return next;
          });
        }, 1000);
      }
    },
    [selectedMarket?.id],
  );

  // Order book levels
  const buyLevels = aggregateLevels(orders, 'buy').sort((a, b) => b.price - a.price);
  const sellLevels = aggregateLevels(orders, 'sell').sort((a, b) => a.price - b.price);
  const maxBuyQty = buyLevels.reduce((m, l) => Math.max(m, l.totalQty), 0);
  const maxSellQty = sellLevels.reduce((m, l) => Math.max(m, l.totalQty), 0);

  // Final price calculation
  const lafzNum = parseInt(lafz, 10) || 0;
  const mazne = selectedMarket?.mazneCurrent ?? 0;
  const scale = selectedMarket?.lafzScale ?? 1000;
  const finalPrice = mazne + lafzNum * scale;

  const isLockedToday = isLocked && settlementType === 'today';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMarket || !profile) return;
    if (isLockedToday) return;
    if (profile.role !== 'trader') {
      toast.error('فقط تریدرهای فعال می‌توانند لفظ دهند');
      return;
    }

    const qtyNum = parseInt(quantity, 10);
    if (!lafzNum || !qtyNum || qtyNum <= 0) {
      toast.error('لفظ و حجم را وارد کنید');
      return;
    }

    setIsSubmitting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (supabase as any).rpc('place_order', {
        p_market_id: selectedMarket.id,
        p_side: side,
        p_lafz: lafzNum,
        p_quantity: qtyNum,
        p_settlement_date: settlementDate,
      });
      if (result.error) throw result.error;
      toast.success('سفارش با موفقیت ثبت شد');
      setLafz('');
      setQuantity('');
      fetchOrders();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full" dir="rtl">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Market selector */}
        <div className="flex items-center gap-2">
          {markets.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMarket(m)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              )}
              style={
                selectedMarket?.id === m.id
                  ? {
                      borderColor: 'var(--accent-gold)',
                      color: 'var(--accent-gold)',
                      backgroundColor: 'color-mix(in srgb, var(--accent-gold) 10%, transparent)',
                    }
                  : {
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }
              }
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* Settlement type toggle */}
        <div
          className="flex rounded-lg border p-0.5 text-sm"
          style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-overlay)' }}
        >
          {(['today', 'tomorrow'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSettlementType(t)}
              className={cn('rounded-md px-3 py-1.5 font-medium transition-colors')}
              style={
                settlementType === t
                  ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }
                  : { color: 'var(--text-tertiary)' }
              }
            >
              {t === 'today' ? 'امروزی' : 'فردایی'}
            </button>
          ))}
        </div>
      </div>

      {/* Market info bar */}
      {selectedMarket && (
        <div
          className="flex items-center gap-6 rounded-xl border px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>
            مزنه:{' '}
            <span
              className="tabular-nums font-semibold"
              style={{ color: 'var(--accent-gold)', fontFamily: "'Geist Mono', monospace" }}
            >
              {formatTomans(selectedMarket.mazneCurrent)}
            </span>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            بازه لفظ:{' '}
            <span style={{ color: 'var(--text-primary)' }}>
              {toFa(selectedMarket.lafzMin)} تا {toFa(selectedMarket.lafzMax)}
            </span>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            تاریخ تسویه:{' '}
            <span style={{ color: 'var(--text-primary)' }}>{toFa(settlementDateDisplay)}</span>
          </span>
        </div>
      )}

      {/* Order book + trades */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
        {/* Order book */}
        <div
          className="flex flex-1 flex-col overflow-hidden rounded-xl border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          {loadingOrders ? (
            <div className="flex-1 p-4">
              <SkeletonCard lines={6} />
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* Asks (sell) — left column */}
              <div className="flex flex-1 flex-col border-l overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div
                  className="border-b px-3 py-2 text-xs font-semibold"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--semantic-sell)' }}
                >
                  فروش (عرضه)
                </div>
                <div className="flex-1 overflow-y-auto">
                  {sellLevels.length === 0 ? (
                    <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      عرضه‌ای وجود ندارد
                    </p>
                  ) : (
                    sellLevels.map((lvl, i) => (
                      <DepthRow key={lvl.price} level={lvl} side="sell" maxQty={maxSellQty} isBest={i === 0} />
                    ))
                  )}
                </div>
              </div>

              {/* Bids (buy) — right column */}
              <div className="flex flex-1 flex-col overflow-hidden">
                <div
                  className="border-b px-3 py-2 text-xs font-semibold"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--semantic-buy)' }}
                >
                  خرید (تقاضا)
                </div>
                <div className="flex-1 overflow-y-auto">
                  {buyLevels.length === 0 ? (
                    <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      تقاضایی وجود ندارد
                    </p>
                  ) : (
                    buyLevels.map((lvl, i) => (
                      <DepthRow key={lvl.price} level={lvl} side="buy" maxQty={maxBuyQty} isBest={i === 0} />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent trades sidebar */}
        <div
          className="hidden w-52 flex-col overflow-hidden rounded-xl border lg:flex"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div
            className="border-b px-3 py-2 text-xs font-semibold"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            آخرین معاملات
          </div>
          <div className="flex-1 overflow-y-auto">
            {recentTrades.length === 0 ? (
              <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                معامله‌ای نشده
              </p>
            ) : (
              recentTrades.map((t) => (
                <RecentTradeRow key={t.id} trade={t} isNew={newTradeIds.has(t.id)} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Lafz form — sticky bottom */}
      <div
        className="shrink-0 rounded-xl border p-4"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        {isLockedToday ? (
          <div
            className="flex items-center justify-center gap-2 py-2 text-sm font-medium"
            style={{ color: 'var(--semantic-danger)' }}
          >
            <Lock size={16} />
            اتاق امروز قفل است — فقط معامله فردایی ممکن است
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
            {/* Buy/Sell toggle */}
            <div
              className="flex rounded-lg border p-0.5"
              style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-overlay)' }}
            >
              {(['buy', 'sell'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className="flex-1 rounded-md py-1.5 text-sm font-semibold transition-all"
                  style={
                    side === s
                      ? {
                          backgroundColor: s === 'buy' ? 'var(--semantic-buy)' : 'var(--semantic-sell)',
                          color: '#000',
                        }
                      : { color: 'var(--text-tertiary)' }
                  }
                >
                  {s === 'buy' ? 'خرید' : 'فروش'}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              {/* Lafz input */}
              <div className="flex-1">
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>
                  لفظ
                </label>
                <input
                  type="number"
                  value={lafz}
                  onChange={(e) => setLafz(e.target.value)}
                  placeholder={selectedMarket ? `${selectedMarket.lafzMin}–${selectedMarket.lafzMax}` : '0'}
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:ring-1"
                  style={{
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                    fontFamily: "'Geist Mono', monospace",
                  }}
                />
              </div>

              {/* Quantity input */}
              <div className="flex-1">
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>
                  حجم (واحد)
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="۱"
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:ring-1"
                  style={{
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                    fontFamily: "'Geist Mono', monospace",
                  }}
                />
              </div>
            </div>

            {/* Final price display */}
            {lafzNum !== 0 && (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                قیمت نهایی:{' '}
                <span
                  className="tabular-nums font-semibold"
                  style={{
                    color: 'var(--accent-gold)',
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {formatTomans(finalPrice)}
                </span>
                {' '}= مزنه {toFa(lafzNum > 0 ? `+${lafzNum}` : String(lafzNum))} لفظ
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !selectedMarket}
              className={cn(
                'w-full rounded-lg py-2.5 text-sm font-bold transition-opacity',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
              style={{
                backgroundColor: side === 'buy' ? 'var(--semantic-buy)' : 'var(--semantic-sell)',
                color: '#000',
              }}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  در حال ارسال...
                </span>
              ) : (
                `ارسال لفظ ${side === 'buy' ? 'خرید' : 'فروش'}`
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
