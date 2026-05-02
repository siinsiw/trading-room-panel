import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { toFa, formatTomans, formatTether } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { repos } from '@/data/repositories/index';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import { EmptyState } from '@/ui/compounds/EmptyState';
import type { Settlement } from '@/domain/types';
import { X } from 'lucide-react';

interface SnapshotRow {
  userId?: string;
  depositBefore?: number;
  depositAfter?: number;
  pnL?: number;
  commission?: number;
  [key: string]: unknown;
}

function SettlementDrawer({ settlement, onClose }: { settlement: Settlement; onClose: () => void }) {
  let snapshot: SnapshotRow[] = [];
  try {
    const parsed = JSON.parse(settlement.snapshotBefore) as unknown;
    if (Array.isArray(parsed)) {
      snapshot = parsed as SnapshotRow[];
    }
  } catch {
    snapshot = [];
  }

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="ms-auto flex h-full w-full max-w-lg flex-col overflow-y-auto border-r shadow-2xl"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>جزئیات تصفیه</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{toFa(settlement.settlementDate)}</p>
          </div>
          <button type="button" onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'نرخ تومانی', value: formatTomans(settlement.rateToman) },
              { label: 'نرخ تتر', value: formatTomans(settlement.rateTether) },
              { label: 'تعداد معاملات', value: toFa(settlement.totalTradesCount) },
              { label: 'حجم کل', value: toFa(settlement.totalVolumeUnits) + ' واحد' },
              { label: 'کمیسیون کل', value: formatTomans(settlement.totalCommissionToman) },
              { label: 'وضعیت', value: settlement.reversedAt ? 'برگشت خورده' : 'فعال' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-overlay)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Snapshot table */}
          {snapshot.length > 0 && (
            <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
              <p className="border-b px-4 py-2.5 text-xs font-semibold" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                اسنپشات تریدرها
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                      {['شناسه', 'ودیعه قبل', 'ودیعه بعد', 'P&L', 'کمیسیون'].map((h) => (
                        <th key={h} className="px-3 py-2 text-right font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.map((row, i) => (
                      <tr key={i} className="border-t hover:bg-white/5" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="px-3 py-2 font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {String(row.userId ?? '').slice(-6)}
                        </td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {row.depositBefore != null ? formatTether(Number(row.depositBefore)) : '—'}
                        </td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {row.depositAfter != null ? formatTether(Number(row.depositAfter)) : '—'}
                        </td>
                        <td
                          className="px-3 py-2 tabular-nums font-medium"
                          style={{
                            color: Number(row.pnL ?? 0) >= 0 ? 'var(--semantic-success)' : 'var(--semantic-danger)',
                            fontFamily: "'Geist Mono', monospace",
                          }}
                        >
                          {row.pnL != null ? (Number(row.pnL) >= 0 ? '+' : '') + formatTomans(Number(row.pnL)) : '—'}
                        </td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {row.commission != null ? formatTomans(Number(row.commission)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {settlement.reversedAt && (
            <div
              className="rounded-xl border p-4"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--semantic-warn) 8%, transparent)',
                borderColor: 'color-mix(in srgb, var(--semantic-warn) 25%, transparent)',
              }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--semantic-warn)' }}>برگشت تصفیه</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                دلیل: {settlement.reversalReason ?? '—'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccountantSettlements() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Settlement | null>(null);

  const fetchSettlements = useCallback(async () => {
    try {
      const data = await repos.settlements.getAll();
      setSettlements(data.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()));
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettlements(); }, [fetchSettlements]);

  return (
    <div className="space-y-5" dir="rtl">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>تصفیه‌ها</h1>

      {loading ? (
        <SkeletonCard lines={5} />
      ) : settlements.length === 0 ? (
        <EmptyState title="تصفیه‌ای انجام نشده" />
      ) : (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: 800 }}>
              <colgroup>
                <col style={{ width: '13%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                  {['تاریخ', 'نرخ تومان', 'نرخ تتر', 'معاملات', 'حجم', 'کمیسیون', 'وضعیت', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-t hover:bg-white/5 transition-colors"
                    style={{ borderColor: 'var(--border-subtle)' }}
                    onClick={() => setSelected(s)}
                  >
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}>
                      {toFa(s.settlementDate)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}>
                      {formatTomans(s.rateToman)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {formatTomans(s.rateTether)}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{toFa(s.totalTradesCount)}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{toFa(s.totalVolumeUnits)}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {formatTomans(s.totalCommissionToman)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={
                          s.reversedAt
                            ? { backgroundColor: 'color-mix(in srgb, var(--semantic-warn) 12%, transparent)', color: 'var(--semantic-warn)' }
                            : { backgroundColor: 'color-mix(in srgb, var(--semantic-success) 12%, transparent)', color: 'var(--semantic-success)' }
                        }
                      >
                        {s.reversedAt ? 'برگشت' : 'فعال'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-left" style={{ color: 'var(--text-tertiary)' }}>›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <SettlementDrawer settlement={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
