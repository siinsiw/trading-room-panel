import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { toast } from 'sonner';
import { toFa, formatTomans } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/hooks/useRealtime';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import { EmptyState } from '@/ui/compounds/EmptyState';
import { Search, X, Bot, User as UserIcon, Pencil } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────
interface TradeRow {
  id: string;
  market_id: string;
  buyer_id: string;
  seller_id: string;
  buy_order_id: string | null;
  sell_order_id: string | null;
  quantity: number;
  price_toman: number;
  settlement_date: string;
  matched_at: string;
  kind: 'today' | 'tomorrow';
  trade_type: 'normal' | 'rent' | 'blocked';
  rent_block_value: number | null;
  note: string | null;
  manual: boolean;
  source: 'bot' | 'panel' | 'manual';
  settled: boolean;
  buyer_pnl_toman: number | null;
  seller_pnl_toman: number | null;
  buyer_commission: number | null;
  seller_commission: number | null;
  // joined
  buyer?: { full_name: string } | null;
  seller?: { full_name: string } | null;
}

type TabId = 'today' | 'tomorrow';

// ─── Badges ───────────────────────────────────────────────────────
function SourceBadge({ source }: { source: TradeRow['source'] }) {
  const cfg = {
    bot:    { icon: <Bot size={11} />,      label: 'بات',       color: 'var(--semantic-buy)' },
    panel:  { icon: <UserIcon size={11} />, label: 'پنل',       color: 'var(--accent-gold)' },
    manual: { icon: <Pencil size={11} />,   label: 'دستی',     color: 'var(--semantic-warn)' },
  }[source];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `color-mix(in srgb, ${cfg.color} 15%, transparent)`, color: cfg.color }}
    >
      {cfg.icon}{cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: TradeRow['trade_type'] }) {
  if (type === 'normal') return null;
  const label = type === 'rent' ? 'اجاره' : 'بلوکه';
  const color = type === 'rent' ? 'var(--accent-gold-bright)' : 'var(--semantic-sell)';
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      {label}
    </span>
  );
}

function SettledBadge({ settled }: { settled: boolean }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={
        settled
          ? { backgroundColor: 'color-mix(in srgb, var(--semantic-success) 15%, transparent)', color: 'var(--semantic-success)' }
          : { backgroundColor: 'color-mix(in srgb, var(--text-tertiary) 15%, transparent)', color: 'var(--text-tertiary)' }
      }
    >
      {settled ? 'تسویه‌شده' : 'باز'}
    </span>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────
function TradeDrawer({ trade, onClose }: { trade: TradeRow; onClose: () => void }) {
  const rows: [string, string][] = [
    ['شناسه', trade.id.slice(0, 8) + '…'],
    ['نوع', trade.kind === 'today' ? 'امروزی' : 'فردایی'],
    ['دسته', trade.trade_type === 'rent' ? 'اجاره' : trade.trade_type === 'blocked' ? 'بلوکه' : 'عادی'],
    ['منبع', trade.source === 'bot' ? 'بات تلگرام' : trade.source === 'panel' ? 'پنل' : 'دستی'],
    ['خریدار', trade.buyer?.full_name ?? trade.buyer_id.slice(0, 8)],
    ['فروشنده', trade.seller?.full_name ?? trade.seller_id.slice(0, 8)],
    ['حجم', toFa(trade.quantity) + ' واحد'],
    ['قیمت', formatTomans(trade.price_toman)],
    ['تاریخ تسویه', toFa(trade.settlement_date)],
    ['زمان ثبت', toFa(new Date(trade.matched_at).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' }))],
    ['وضعیت تسویه', trade.settled ? 'تسویه‌شده' : 'باز'],
  ];
  if (trade.rent_block_value != null) {
    rows.push(['عدد اجاره/بلوکه', formatTomans(trade.rent_block_value)]);
  }
  if (trade.note) {
    rows.push(['یادداشت', trade.note]);
  }
  if (trade.settled) {
    rows.push(
      ['P&L خریدار', trade.buyer_pnl_toman != null ? formatTomans(trade.buyer_pnl_toman) : '—'],
      ['P&L فروشنده', trade.seller_pnl_toman != null ? formatTomans(trade.seller_pnl_toman) : '—'],
      ['کمیسیون خریدار', trade.buyer_commission != null ? formatTomans(trade.buyer_commission) : '—'],
      ['کمیسیون فروشنده', trade.seller_commission != null ? formatTomans(trade.seller_commission) : '—'],
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="ms-auto flex h-full w-full max-w-md flex-col overflow-y-auto border-r shadow-2xl"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>جزئیات معامله</p>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-white/5" style={{ color: 'var(--text-tertiary)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 p-5">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-start justify-between gap-3 border-b py-2.5"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <span className="shrink-0 text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span
                className="break-all text-left text-xs font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────
export default function TradesList() {
  const [trades, setTrades]   = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [tab, setTab]         = useState<TabId>('today');
  const [selected, setSelected] = useState<TradeRow | null>(null);

  const fetchTrades = useCallback(async () => {
    try {
      // join با profiles برای نام خریدار/فروشنده
      const { data, error } = await supabase
        .from('trades')
        .select(`
          *,
          buyer:buyer_id(full_name),
          seller:seller_id(full_name)
        `)
        .order('matched_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setTrades((data as unknown as TradeRow[]) ?? []);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  // Realtime: هر تغییری در trades → refetch
  useRealtime({ table: 'trades' }, () => { fetchTrades(); }, []);

  // فیلتر
  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (t.kind !== tab) return false;
      if (search) {
        const q = search.toLowerCase();
        const buyerName  = t.buyer?.full_name?.toLowerCase()  ?? '';
        const sellerName = t.seller?.full_name?.toLowerCase() ?? '';
        if (!buyerName.includes(q) && !sellerName.includes(q)) return false;
      }
      return true;
    });
  }, [trades, tab, search]);

  const todayCount    = trades.filter((t) => t.kind === 'today').length;
  const tomorrowCount = trades.filter((t) => t.kind === 'tomorrow').length;

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>لیست معاملات</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          همه‌ی معاملات از بات و پنل + سرچ بر اساس نام معامله‌گر
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="نام خریدار یا فروشنده..."
          className="w-full rounded-lg border bg-transparent py-2 pr-9 pl-3 text-sm outline-none"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Tabs */}
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <Tabs.List
          className="flex gap-1 rounded-lg border p-1"
          style={{ backgroundColor: 'var(--bg-overlay)', borderColor: 'var(--border-subtle)' }}
        >
          {[
            { id: 'today',    label: 'امروزی',  count: todayCount },
            { id: 'tomorrow', label: 'فردایی',  count: tomorrowCount },
          ].map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                tab === t.id
                  ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }
                  : { color: 'var(--text-tertiary)' }
              }
            >
              {t.label}
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--accent-gold) 15%, transparent)',
                  color: 'var(--accent-gold)',
                }}
              >
                {toFa(t.count)}
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="mt-4">
          {loading ? (
            <SkeletonCard lines={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={tab === 'today' ? 'معامله‌ی امروزی ثبت نشده' : 'معامله‌ی فردایی ثبت نشده'}
              description="پس از اولین لفظ موفق در گروه تلگرام، اینجا ظاهر می‌شود"
            />
          ) : (
            <div
              className="overflow-hidden rounded-xl border"
              style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: 900 }}>
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '7%'  }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '13%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                      {['ساعت', 'خریدار', 'فروشنده', 'حجم', 'قیمت', 'منبع', 'دسته', 'وضعیت'].map((h) => (
                        <th key={h} className="px-3 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr
                        key={t.id}
                        className="cursor-pointer border-t transition-colors hover:bg-white/5"
                        style={{ borderColor: 'var(--border-subtle)' }}
                        onClick={() => setSelected(t)}
                      >
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}>
                          {toFa(new Date(t.matched_at).toLocaleTimeString('fa-IR', {
                            timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit',
                          }))}
                        </td>
                        <td className="px-3 py-2.5 truncate" style={{ color: 'var(--semantic-buy)' }}>
                          {t.buyer?.full_name ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 truncate" style={{ color: 'var(--semantic-sell)' }}>
                          {t.seller?.full_name ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {toFa(t.quantity)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}>
                          {formatTomans(t.price_toman)}
                        </td>
                        <td className="px-3 py-2.5">
                          <SourceBadge source={t.source} />
                        </td>
                        <td className="px-3 py-2.5">
                          {t.trade_type === 'normal' ? (
                            <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                          ) : (
                            <TypeBadge type={t.trade_type} />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <SettledBadge settled={t.settled} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Tabs.Root>

      {selected && <TradeDrawer trade={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
