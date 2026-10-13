import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, UserPlus, TrendingDown } from 'lucide-react';
import { Flip, gsap, prefersReducedMotion } from '@/lib/gsap';
import { money, toFa } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/cn';
import { MarginBar } from '@/ui/compounds/MarginBar';
import type { Order, Trade } from '@/domain/types';
import type { Profile } from '@/lib/database.types';

// ─── نیاز به رسیدگی ──────────────────────────────────────────────────────────

export interface ActionItem {
  id: string;
  kind: 'call' | 'warn' | 'approval';
  name: string;
  detail: string;
  lossPct?: number;
  profile: Profile;
}

const KIND = {
  call:     { fg: 'var(--semantic-sell)', bg: 'var(--sell-wash)', label: 'حراج', group: 'risk' },
  warn:     { fg: 'var(--semantic-warn)', bg: 'var(--warn-wash)', label: 'هشدار', group: 'risk' },
  approval: { fg: 'var(--gold-deep)',     bg: 'var(--gold-soft)', label: 'تأیید', group: 'join' },
} as const;

type Filter = 'all' | 'risk' | 'join';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'risk', label: 'ریسک' },
  { key: 'join', label: 'عضویت' },
];

const initials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('');

/**
 * فهرست کارها با فیلتر. ردیف‌ها همیشه در DOM هستند و فقط display عوض
 * می‌کنند تا Flip بتواند هم جابه‌جایی و هم رفتن/آمدن را انیمیت کند
 * (الگوی Flexbox filtering در demos.gsap.com).
 */
export function AttentionList({ items, warnAt, callAt, onApprove }: {
  items: ActionItem[]; warnAt: number; callAt: number; onApprove: (p: Profile) => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const flip = useRef<Flip.FlipState | null>(null);

  const pick = (f: Filter) => {
    if (f === filter || !list.current) return;
    flip.current = Flip.getState(list.current.children);
    setFilter(f);
  };

  useLayoutEffect(() => {
    if (!flip.current) return;
    const t = Flip.from(flip.current, {
      duration: prefersReducedMotion() ? 0 : 0.45, ease: 'power2.inOut', absolute: true,
      onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35 }),
      onLeave: (els) => gsap.to(els, { autoAlpha: 0, y: -6, duration: 0.25 }),
    });
    flip.current = null;
    return () => { t.kill(); };
  }, [filter]);

  const shown = (a: ActionItem) => filter === 'all' || KIND[a.kind].group === filter;

  return (
    <>
      <div className="mb-2 flex gap-1" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key} type="button" role="tab" aria-selected={filter === f.key}
            onClick={() => pick(f.key)}
            className={cn('h-7 rounded-[8px] px-2.5 text-[13px] transition-colors', filter === f.key && 'font-bold')}
            style={filter === f.key ? { background: 'var(--surface-tint-strong)', color: 'var(--text-primary)' } : { color: 'var(--text-tertiary)' }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-[14px]" style={{ color: 'var(--text-tertiary)' }}>
          چیزی روی میز نیست — همهٔ تریدرها سالم‌اند و درخواست عضویتی در صف نیست.
        </p>
      ) : (
        <ul ref={list} className="flex max-h-[330px] flex-col gap-0.5 overflow-y-auto">
          {items.map((a) => {
            const k = KIND[a.kind];
            return (
              <li
                key={`${a.kind}-${a.id}`}
                className="flex items-center gap-3 rounded-[14px] px-2 py-2 transition-colors hover:bg-white/70"
                style={{ display: shown(a) ? undefined : 'none' }}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-[13px] font-bold" style={{ background: k.bg, color: k.fg }}>
                  {a.kind === 'approval' ? <UserPlus size={15} /> : a.lossPct != null ? initials(a.name) : <TrendingDown size={15} />}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14.5px]" style={{ color: 'var(--text-primary)' }}>{a.name}</b>
                  <small className="block truncate text-[12.5px]" style={{ color: 'var(--text-tertiary)' }}>
                    {/* آیدی تلگرام چپ‌به‌راست است؛ بدون این، @ در ردیف راست‌چین آخر می‌افتد */}
                    {a.detail.startsWith('@') ? <span dir="ltr">{a.detail}</span> : a.detail}
                  </small>
                  {a.lossPct != null && <MarginBar value={a.lossPct} warnAt={warnAt} callAt={callAt} className="mt-1.5 max-w-[240px]" />}
                </span>
                {a.kind === 'approval' ? (
                  <button
                    type="button" onClick={() => onApprove(a.profile)}
                    className="h-[30px] shrink-0 rounded-[9px] px-3 text-[13px] font-bold text-white"
                    style={{ background: 'var(--text-primary)' }}
                  >
                    {k.label}
                  </button>
                ) : (
                  <span className="shrink-0 rounded-[9px] px-2.5 py-1 text-[13px] font-bold" style={{ background: k.bg, color: k.fg }}>{k.label}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ─── دفتر لفظ ────────────────────────────────────────────────────────────────

/**
 * نردبان لفظ: فروش بالا (نزدیک‌ترین پایین)، مزنه وسط، خرید پایین.
 * ردیفی که حجمش عوض شود یک چشمک رنگی می‌زند — فقط opacity و scaleX.
 */
export function OrderLadder({ asks, bids, mazne }: { asks: Order[]; bids: Order[]; mazne: number }) {
  const root = useRef<HTMLDivElement>(null);
  const prev = useRef(new Map<string, number>());
  const max = Math.max(1, ...[...asks, ...bids].map((o) => o.remaining));

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = prefersReducedMotion();
    const next = new Map<string, number>();
    for (const o of [...asks, ...bids]) {
      next.set(o.id, o.remaining);
      const row = el.querySelector<HTMLElement>(`[data-oid="${CSS.escape(o.id)}"]`);
      if (!row) continue;
      gsap.to(row.querySelector('.bar'), { scaleX: o.remaining / max, duration: reduce ? 0 : 0.5, ease: 'power2.out', overwrite: true });
      const before = prev.current.get(o.id);
      if (before !== undefined && before !== o.remaining && !reduce) {
        gsap.fromTo(row.querySelector('.flash'), { opacity: 1 }, { opacity: 0, duration: 0.9, ease: 'power1.out', overwrite: true });
      }
    }
    prev.current = next;
  }, [asks, bids, max]);

  const row = (o: Order, side: 'sell' | 'buy') => {
    const fg = side === 'sell' ? 'var(--semantic-sell)' : 'var(--semantic-buy)';
    const wash = side === 'sell' ? 'var(--sell-wash)' : 'var(--buy-wash)';
    return (
      <div key={o.id} data-oid={o.id} className="relative grid grid-cols-2 overflow-hidden rounded-[9px] px-2.5 py-1.5 text-[14px]">
        <span className="bar absolute inset-y-0 left-0 w-full origin-left rounded-[9px]" style={{ background: wash, transform: 'scaleX(0)' }} />
        <span className="flash absolute inset-0 opacity-0" style={{ background: side === 'sell' ? 'rgba(200,50,95,.22)' : 'rgba(14,138,124,.22)' }} />
        <span className="relative font-bold" style={{ color: fg, fontFamily: 'var(--font-num)' }}>{money(o.priceToman)}</span>
        <span className="relative text-left" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-num)' }}>{toFa(o.remaining)}</span>
      </div>
    );
  };

  return (
    <div ref={root} className="flex flex-col gap-[3px]">
      {asks.length === 0 && <p className="px-2.5 py-1.5 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>فروشی باز نیست</p>}
      {[...asks].reverse().map((o) => row(o, 'sell'))}
      <div className="flex items-center gap-2.5 px-1 py-2 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
        <hr className="flex-1 border-0 border-t border-dashed" style={{ borderColor: 'var(--border-strong)' }} />
        <span>مزنه <b className="text-[17px]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-num)' }}>{money(mazne)}</b></span>
        <hr className="flex-1 border-0 border-t border-dashed" style={{ borderColor: 'var(--border-strong)' }} />
      </div>
      {bids.map((o) => row(o, 'buy'))}
      {bids.length === 0 && <p className="px-2.5 py-1.5 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>خریدی باز نیست</p>}
    </div>
  );
}

// ─── آخرین معاملات ───────────────────────────────────────────────────────────

const timeOf = (iso?: string) => iso
  ? toFa(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)))
  : '—';

export function RecentTrades({ trades, names }: { trades: Trade[]; names: Map<string, string> }) {
  if (trades.length === 0) {
    return <p className="py-6 text-[14px]" style={{ color: 'var(--text-tertiary)' }}>امروز هنوز معامله‌ای نشده.</p>;
  }
  return (
    // روی موبایل جدول از کارت بیرون می‌زد — اسکرول افقی داخل خود کارت
    <div className="-mx-1 overflow-x-auto px-1">
    <table className="w-full min-w-[440px] border-collapse text-[14px]">
      <thead>
        <tr style={{ color: 'var(--text-tertiary)' }}>
          {['ساعت', 'خریدار ← فروشنده', 'نوع', 'تعداد', 'قیمت'].map((h) => (
            <th key={h} className="px-1.5 pb-2 text-[12.5px] font-normal">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => (
          <tr key={t.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <td className="px-1.5 py-2" style={{ fontFamily: 'var(--font-num)' }}>{timeOf(t.matchedAt)}</td>
            <td className="max-w-[220px] truncate px-1.5 py-2">{names.get(t.buyerId) ?? '—'} ← {names.get(t.sellerId) ?? '—'}</td>
            <td className="px-1.5 py-2">
              <span
                className="rounded-[7px] px-2 py-0.5 text-[12px]"
                style={t.kind === 'tomorrow'
                  ? { background: 'var(--gold-soft)', color: 'var(--gold-deep)' }
                  : { background: 'var(--surface-tint)', color: 'var(--text-secondary)' }}
              >
                {t.kind === 'tomorrow' ? 'فردایی' : 'امروزی'}
              </span>
            </td>
            <td className="px-1.5 py-2" style={{ fontFamily: 'var(--font-num)' }}>{toFa(t.quantity)}</td>
            <td className="px-1.5 py-2 font-bold" style={{ fontFamily: 'var(--font-num)' }}>{money(t.priceToman)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

// ─── مودال تأیید تریدر ───────────────────────────────────────────────────────

export function ApproveModal({ trader, onClose, onApproved }: {
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
      <div className="glass glass-strong w-full max-w-md p-6" role="dialog" onClick={(e) => e.stopPropagation()} dir="rtl">
        <h3 className="mb-1 text-[19px] font-bold" style={{ color: 'var(--text-primary)' }}>تأیید {trader.full_name}</h3>
        <p className="mb-4 text-[14px]" style={{ color: 'var(--text-tertiary)' }}>بعد از تأیید، کاربر می‌تواند در گروه لفظ بزند.</p>
        <div className="space-y-3">
          {[
            { label: 'ودیعه (تتر)', value: deposit, setter: setDeposit, placeholder: '۵۰۰۰' },
            { label: 'بیعانهٔ هر واحد (تتر)', value: perUnit, setter: setPerUnit, placeholder: '۵۰۰' },
            { label: 'کمیسیون هر واحد (تتر)', value: commission, setter: setCommission, placeholder: '۱' },
          ].map((f) => (
            <label key={f.label} className="block">
              <span className="mb-1 block text-[13px]" style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
              <input
                type="number" value={f.value} onChange={(e) => f.setter(e.target.value)} placeholder={f.placeholder}
                className="h-11 w-full rounded-[12px] border bg-white/70 px-3 text-[15px] outline-none focus:border-[var(--gold)]"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', fontFamily: 'var(--font-num)' }}
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-[12px] text-[15px] hover:bg-[var(--surface-tint)]" style={{ color: 'var(--text-secondary)' }}>
            انصراف
          </button>
          <button
            type="button" onClick={() => void handleApprove()} disabled={loading}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] text-[15px] font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--text-primary)' }}
          >
            <Check size={16} /> {loading ? 'در حال ثبت…' : 'تأیید'}
          </button>
        </div>
      </div>
    </div>
  );
}
