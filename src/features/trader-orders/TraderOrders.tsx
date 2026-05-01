import { useState, useEffect, useCallback } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { toFa, formatTomans } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useRealtime } from '@/hooks/useRealtime';
import { repos } from '@/data/repositories/index';
import { supabase } from '@/lib/supabase';

import { EmptyState } from '@/ui/compounds/EmptyState';
import { ConfirmDialog } from '@/ui/compounds/ConfirmDialog';
import type { Order } from '@/domain/types';

// SkeletonTable alias
function SkeletonRows() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3">
          {Array.from({ length: 8 }).map((__, j) => (
            <div
              key={j}
              className="flex-1 rounded skeleton-shimmer"
              style={{ height: 12 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

type TabId = 'open' | 'partial' | 'filled' | 'cancelled';

const TAB_LABELS: Record<TabId, string> = {
  open: 'باز',
  partial: 'در حال match',
  filled: 'تکمیل‌شده',
  cancelled: 'لغوشده',
};

function statusFa(status: string): string {
  const map: Record<string, string> = {
    open: 'باز',
    partial: 'جزئی',
    filled: 'تکمیل',
    cancelled: 'لغو',
  };
  return map[status] ?? status;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    open: { bg: 'color-mix(in srgb, var(--semantic-buy) 12%, transparent)', text: 'var(--semantic-buy)' },
    partial: { bg: 'color-mix(in srgb, var(--semantic-warn) 12%, transparent)', text: 'var(--semantic-warn)' },
    filled: { bg: 'color-mix(in srgb, var(--semantic-success) 12%, transparent)', text: 'var(--semantic-success)' },
    cancelled: { bg: 'color-mix(in srgb, var(--semantic-danger) 12%, transparent)', text: 'var(--semantic-danger)' },
  };
  const c = colors[status] ?? colors.open;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {statusFa(status)}
    </span>
  );
}

function SideBadge({ side }: { side: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold"
      style={
        side === 'buy'
          ? { backgroundColor: 'color-mix(in srgb, var(--semantic-buy) 12%, transparent)', color: 'var(--semantic-buy)' }
          : { backgroundColor: 'color-mix(in srgb, var(--semantic-sell) 12%, transparent)', color: 'var(--semantic-sell)' }
      }
    >
      {side === 'buy' ? 'خرید' : 'فروش'}
    </span>
  );
}

interface OrderTableProps {
  orders: Order[];
  showCancel: boolean;
  onCancel: (id: string) => void;
}

function OrderTable({ orders, showCancel, onCancel }: OrderTableProps) {
  if (orders.length === 0) {
    return (
      <EmptyState
        title="سفارشی وجود ندارد"
        description="سفارشی در این وضعیت ثبت نشده است"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
            {['تاریخ', 'بازار', 'نوع', 'لفظ', 'قیمت', 'حجم', 'fill', 'باقی', 'تسویه', 'وضعیت', ''].map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-right text-xs font-medium"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.id}
              className="border-t transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}>
                {toFa(new Date(o.placedAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'short', timeStyle: 'short' }))}
              </td>
              <td className="px-3 py-2.5" style={{ color: 'var(--text-primary)' }}>
                {o.marketId}
              </td>
              <td className="px-3 py-2.5">
                <SideBadge side={o.side} />
              </td>
              <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}>
                {o.lafz >= 0 ? '+' : ''}{toFa(o.lafz)}
              </td>
              <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}>
                {formatTomans(o.priceToman)}
              </td>
              <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {toFa(o.quantity)}
              </td>
              <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--semantic-success)' }}>
                {toFa(o.filled)}
              </td>
              <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {toFa(o.remaining)}
              </td>
              <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                {toFa(o.settlementDate)}
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={o.status} />
              </td>
              <td className="px-3 py-2.5">
                {showCancel && (
                  <button
                    type="button"
                    onClick={() => onCancel(o.id)}
                    className="rounded px-2 py-1 text-xs font-medium transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--semantic-danger) 12%, transparent)',
                      color: 'var(--semantic-danger)',
                    }}
                  >
                    لغو
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TraderOrders() {
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('open');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!profile) return;
    try {
      const data = await repos.orders.getByTrader(profile.id);
      setOrders(data);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useRealtime(
    {
      table: 'orders',
      filter: profile ? { column: 'trader_id', value: profile.id } : undefined,
    },
    () => { fetchOrders(); },
    [profile?.id],
  );

  async function handleCancel() {
    if (!cancelId) return;
    setCancelling(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (supabase as any).rpc('cancel_order', {
        p_order_id: cancelId,
        p_reason: 'لغو توسط تریدر',
      });
      if (result.error) throw result.error;
      toast.success('سفارش با موفقیت لغو شد');
      fetchOrders();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setCancelling(false);
      setCancelId(null);
    }
  }

  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'open') return o.status === 'open';
    if (activeTab === 'partial') return o.status === 'partial';
    if (activeTab === 'filled') return o.status === 'filled';
    if (activeTab === 'cancelled') return o.status === 'cancelled';
    return true;
  });

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        سفارش‌های من
      </h1>

      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabId)}
      >
        <Tabs.List
          className="flex gap-1 rounded-lg border p-1"
          style={{ backgroundColor: 'var(--bg-overlay)', borderColor: 'var(--border-subtle)' }}
        >
          {(Object.entries(TAB_LABELS) as [TabId, string][]).map(([id, label]) => {
            const count = orders.filter((o) => {
              if (id === 'open') return o.status === 'open';
              if (id === 'partial') return o.status === 'partial';
              if (id === 'filled') return o.status === 'filled';
              if (id === 'cancelled') return o.status === 'cancelled';
              return false;
            }).length;
            return (
              <Tabs.Trigger
                key={id}
                value={id}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                )}
                style={
                  activeTab === id
                    ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }
                    : { color: 'var(--text-tertiary)' }
                }
              >
                {label}
                {count > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--accent-gold) 15%, transparent)',
                      color: 'var(--accent-gold)',
                    }}
                  >
                    {toFa(count)}
                  </span>
                )}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        <div
          className="mt-4 overflow-hidden rounded-xl border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          {loading ? (
            <SkeletonRows />
          ) : (
            (Object.keys(TAB_LABELS) as TabId[]).map((id) => (
              <Tabs.Content key={id} value={id}>
                <OrderTable
                  orders={filteredOrders}
                  showCancel={id === 'open' || id === 'partial'}
                  onCancel={(ordId) => setCancelId(ordId)}
                />
              </Tabs.Content>
            ))
          )}
        </div>
      </Tabs.Root>

      <ConfirmDialog
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={handleCancel}
        title="لغو سفارش"
        description="آیا مطمئنید که می‌خواهید این سفارش را لغو کنید؟ این عمل برگشت‌پذیر نیست."
        confirmLabel="لغو سفارش"
        variant="danger"
        loading={cancelling}
      />
    </div>
  );
}
