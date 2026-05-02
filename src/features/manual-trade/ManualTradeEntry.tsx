import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { toFa, formatTomans } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { repos } from '@/data/repositories/index';
import type { Market } from '@/domain/types';
import type { Profile } from '@/lib/database.types';
import { cn } from '@/lib/cn';

type TradeTypeUI = 'normal' | 'rent' | 'blocked';
type KindUI      = 'today' | 'tomorrow';

function todayJalali(): string {
  const fmt = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric', month: '2-digit', day: '2-digit',
    calendar: 'persian', numberingSystem: 'latn',
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function tomorrowJalali(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const fmt = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric', month: '2-digit', day: '2-digit',
    calendar: 'persian', numberingSystem: 'latn',
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export default function ManualTradeEntry() {
  const [markets, setMarkets]     = useState<Market[]>([]);
  const [traders, setTraders]     = useState<Profile[]>([]);
  const [marketId, setMarketId]   = useState<string>('');
  const [buyerId, setBuyerId]     = useState<string>('');
  const [sellerId, setSellerId]   = useState<string>('');
  const [quantity, setQuantity]   = useState<string>('');
  const [priceMode, setPriceMode] = useState<'absolute' | 'lafz'>('absolute');
  const [absolute, setAbsolute]   = useState<string>(''); // قیمت نهایی به تومان
  const [lafz, setLafz]           = useState<string>(''); // اگر price از مزنه + لفظ باشد
  const [kind, setKind]           = useState<KindUI>('today');
  const [tradeType, setTradeType] = useState<TradeTypeUI>('normal');
  const [rentValue, setRentValue] = useState<string>('');
  const [note, setNote]           = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [mks, profilesRes] = await Promise.all([
        repos.markets.getAll(),
        supabase.from('profiles').select('*').eq('role', 'trader').eq('active', true).order('full_name'),
      ]);
      setMarkets(mks.filter((m) => m.active));
      setTraders((profilesRes.data as Profile[]) ?? []);
      const active = mks.find((m) => m.active);
      if (active && !marketId) setMarketId(active.id);
    } catch (err) {
      toast.error(parseError(err));
    }
  }, [marketId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const market = markets.find((m) => m.id === marketId);
  const computedPrice = (() => {
    if (priceMode === 'absolute') return parseInt(absolute, 10) || 0;
    if (!market) return 0;
    const l = parseInt(lafz, 10) || 0;
    return market.mazneCurrent + l * market.lafzScale;
  })();

  async function handleSubmit() {
    if (!marketId)             { toast.error('بازار را انتخاب کنید'); return; }
    if (!buyerId || !sellerId) { toast.error('خریدار و فروشنده الزامی است'); return; }
    if (buyerId === sellerId)  { toast.error('خریدار و فروشنده نمی‌توانند یکی باشند'); return; }
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0)      { toast.error('تعداد نامعتبر'); return; }
    if (!computedPrice || computedPrice <= 0) { toast.error('قیمت نامعتبر'); return; }
    if ((tradeType === 'rent' || tradeType === 'blocked') && !rentValue) {
      toast.error('عدد توافقی اجاره/بلوکه الزامی است'); return;
    }

    setSubmitting(true);
    try {
      // settlement_date باید فرمت ISO YYYY-MM-DD باشد (نه جلالی) — Postgres date.
      // پیشنهاد ساده: امروزی → امروز میلادی، فردایی → فردا میلادی.
      // در سطح MVP کافی است؛ بعداً اگر تقویم جلالی لازم شد تابع تبدیل اضافه می‌کنیم.
      const todayG    = new Date().toISOString().slice(0, 10);
      const tomorrowG = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();
      const settlementDate = kind === 'today' ? todayG : tomorrowG;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('create_manual_trade', {
        p_market_id:        marketId,
        p_buyer_id:         buyerId,
        p_seller_id:        sellerId,
        p_quantity:         qty,
        p_price_toman:      computedPrice,
        p_settlement_date:  settlementDate,
        p_kind:             kind,
        p_trade_type:       tradeType,
        p_rent_block_value: rentValue ? parseInt(rentValue, 10) : null,
        p_note:             note || null,
      });
      if (error) throw error;

      toast.success(`معامله ثبت شد — کد: ${String(data).slice(0, 8)}`);
      // پاکسازی فرم
      setQuantity(''); setAbsolute(''); setLafz(''); setRentValue(''); setNote('');
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const isRentOrBlocked = tradeType === 'rent' || tradeType === 'blocked';

  return (
    <div className="space-y-6 max-w-3xl" dir="rtl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          ثبت دستی معامله
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          برای معاملاتی که از طریق بات ثبت نشده‌اند، یا برای معاملات اجاره/بلوکه (گروه «امروز فردا»).
        </p>
      </div>

      <div
        className="rounded-xl border p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        {/* نوع معامله */}
        <div>
          <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            نوع معامله
          </label>
          <div className="flex gap-2">
            {([
              { id: 'normal',  label: 'عادی' },
              { id: 'rent',    label: 'اجاره' },
              { id: 'blocked', label: 'بلوکه' },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTradeType(opt.id)}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                )}
                style={
                  tradeType === opt.id
                    ? { backgroundColor: 'var(--accent-gold)', color: '#000', borderColor: 'var(--accent-gold)' }
                    : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* امروزی / فردایی */}
        <div>
          <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            تصفیه برای
          </label>
          <div className="flex gap-2">
            {([
              { id: 'today',    label: `امروز (${toFa(todayJalali().replace(/-/g, '/'))})` },
              { id: 'tomorrow', label: `فردا (${toFa(tomorrowJalali().replace(/-/g, '/'))})` },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setKind(opt.id)}
                className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                style={
                  kind === opt.id
                    ? { backgroundColor: 'var(--bg-overlay)', color: 'var(--accent-gold)', borderColor: 'var(--accent-gold)' }
                    : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* بازار */}
        <div>
          <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>بازار</label>
          <select
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
          >
            {markets.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {market && (
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              مزنه‌ی فعلی: {formatTomans(market.mazneCurrent)} • هر واحد: {toFa(market.unitWeight)} {market.unitLabel}
            </p>
          )}
        </div>

        {/* خریدار / فروشنده */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>خریدار</label>
            <select
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
            >
              <option value="">— انتخاب کنید —</option>
              {traders.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>فروشنده</label>
            <select
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
            >
              <option value="">— انتخاب کنید —</option>
              {traders.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* تعداد */}
        <div>
          <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>تعداد (واحد)</label>
          <input
            type="number" inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="مثلاً ۵"
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none tabular-nums"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* قیمت — مطلق یا از روی لفظ */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>قیمت</label>
            <div className="flex gap-1 text-xs">
              <button
                type="button"
                onClick={() => setPriceMode('absolute')}
                className="rounded px-2 py-0.5"
                style={
                  priceMode === 'absolute'
                    ? { backgroundColor: 'var(--bg-overlay)', color: 'var(--accent-gold)' }
                    : { color: 'var(--text-tertiary)' }
                }
              >
                قیمت کامل
              </button>
              <button
                type="button"
                onClick={() => setPriceMode('lafz')}
                className="rounded px-2 py-0.5"
                style={
                  priceMode === 'lafz'
                    ? { backgroundColor: 'var(--bg-overlay)', color: 'var(--accent-gold)' }
                    : { color: 'var(--text-tertiary)' }
                }
              >
                مزنه + لفظ
              </button>
            </div>
          </div>
          {priceMode === 'absolute' ? (
            <input
              type="number" inputMode="numeric"
              value={absolute}
              onChange={(e) => setAbsolute(e.target.value)}
              placeholder="۸۸۳۰۰۰۰۰"
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none tabular-nums"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
            />
          ) : (
            <input
              type="number" inputMode="numeric"
              value={lafz}
              onChange={(e) => setLafz(e.target.value)}
              placeholder="۳۰۰ (به‌معنای مزنه + ۳۰۰×scale)"
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none tabular-nums"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
            />
          )}
          {computedPrice > 0 && (
            <p className="mt-1 text-xs" style={{ color: 'var(--accent-gold)' }}>
              قیمت محاسبه‌شده: {formatTomans(computedPrice)}
            </p>
          )}
        </div>

        {/* فقط برای rent/blocked */}
        {isRentOrBlocked && (
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>
              عدد توافقی {tradeType === 'rent' ? 'اجاره' : 'بلوکه'}
            </label>
            <input
              type="number" inputMode="numeric"
              value={rentValue}
              onChange={(e) => setRentValue(e.target.value)}
              placeholder="عدد توافق‌شده در گروه امروز فردا"
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none tabular-nums"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
            />
          </div>
        )}

        {/* یادداشت */}
        <div>
          <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>
            یادداشت (اختیاری) — مثلاً «بدون پری»
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder=""
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
        >
          {submitting ? 'در حال ثبت…' : 'ثبت معامله'}
        </button>
      </div>
    </div>
  );
}
