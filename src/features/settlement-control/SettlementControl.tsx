import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { toFa, formatTomans, formatTether } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { repos } from '@/data/repositories/index';
import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { ZoneBadge } from '@/ui/compounds/ZoneBadge';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import { ConfirmDialog } from '@/ui/compounds/ConfirmDialog';
import type { Market, Settlement } from '@/domain/types';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface PreviewRow {
  trader_id: string;
  full_name: string;
  deposit_tether: number;
  floating_pnl_toman: number;
  floating_pnl_tether: number;
  commission_accumulated: number;
  required_tether: number;
  available_tether: number;
  percentage: number;
  zone: string;
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

function PreviewTable({ rows }: { rows: PreviewRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        هیچ تریدری در این بازه تسویه ندارد
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: 800 }}>
        <colgroup>
          <col style={{ width: '15%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '8%'  }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
            {['نام تریدر', 'ودیعه', 'P&L شناور', 'کمیسیون', 'مارجین لازم', 'موجود', 'درصد', 'وضعیت'].map((h) => (
              <th key={h} className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.trader_id} className="border-t hover:bg-white/5" style={{ borderColor: 'var(--border-subtle)' }}>
              <td className="px-3 py-2.5" style={{ color: 'var(--text-primary)' }}>{r.full_name}</td>
              <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}>
                {formatTether(r.deposit_tether)}
              </td>
              <td
                className="px-3 py-2.5 tabular-nums font-medium"
                style={{
                  color: r.floating_pnl_toman >= 0 ? 'var(--semantic-success)' : 'var(--semantic-danger)',
                  fontFamily: "'Geist Mono', monospace",
                }}
              >
                {r.floating_pnl_toman >= 0 ? '+' : ''}{formatTomans(r.floating_pnl_toman)}
              </td>
              <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {formatTomans(r.commission_accumulated)}
              </td>
              <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {formatTether(r.required_tether)}
              </td>
              <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {formatTether(r.available_tether)}
              </td>
              <td
                className="px-3 py-2.5 tabular-nums font-semibold"
                style={{ fontFamily: "'Geist Mono', monospace", color: 'var(--text-primary)' }}
              >
                {toFa(r.percentage.toFixed(1))}٪
              </td>
              <td className="px-3 py-2.5">
                <ZoneBadge zone={r.zone as 'safe' | 'warn' | 'risk' | 'call'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SettlementControl() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState('');
  const [settlementDate, setSettlementDate] = useState(getTodayJalali());

  // Temp settlement
  const [testPrice, setTestPrice] = useState('');
  const [tetherRate, setTetherRate] = useState('97000');
  const [tempRows, setTempRows] = useState<PreviewRow[]>([]);
  const [loadingTemp, setLoadingTemp] = useState(false);

  // Final settlement
  const [rateToman, setRateToman] = useState('');
  const [rateTether, setRateTether] = useState('97000');
  const [finalRows, setFinalRows] = useState<PreviewRow[]>([]);
  const [loadingFinal, setLoadingFinal] = useState(false);
  const [previewDone, setPreviewDone] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [appliedSettlement, setAppliedSettlement] = useState<{ id: string; traders: number } | null>(null);

  // Reversal
  const [lastSettlement, setLastSettlement] = useState<Settlement | null>(null);
  const [reversalWindow, setReversalWindow] = useState(0);
  const [reversalReason, setReversalReason] = useState('');
  const [confirmReverse, setConfirmReverse] = useState(false);
  const [reversing, setReversing] = useState(false);

  // Archive
  const [archive, setArchive] = useState<Settlement[]>([]);

  // Auto-refresh interval ref
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    repos.markets.getAll().then((all) => {
      setMarkets(all);
      if (all.length > 0) {
        setSelectedMarketId(all[0].id);
        setTestPrice(String(all[0].mazneCurrent));
        setRateToman(String(all[0].mazneCurrent));
      }
    }).catch(() => {});

    repos.settlements.getLatest().then((s) => {
      setLastSettlement(s);
      if (s && !s.reversedAt) {
        const elapsed = (Date.now() - new Date(s.appliedAt).getTime()) / 1000;
        const remaining = Math.max(0, 30 * 60 - elapsed);
        setReversalWindow(Math.floor(remaining));
      }
    }).catch(() => {});

    repos.settlements.getAll().then((all) => {
      setArchive(all.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()));
    }).catch(() => {});
  }, []);

  // Countdown for reversal window
  useEffect(() => {
    if (reversalWindow <= 0) return;
    const timer = setInterval(() => {
      setReversalWindow((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [reversalWindow]);

  const fetchTempPreview = useCallback(async () => {
    if (!selectedMarketId || !testPrice || !tetherRate) return;
    setLoadingTemp(true);
    try {
      const { data: previewData, error } = await db.rpc('get_settlement_preview', {
        p_market_id: selectedMarketId,
        p_settlement_date: settlementDate,
        p_test_price: parseInt(testPrice, 10),
        p_tether_rate: parseInt(tetherRate, 10),
      });
      if (error) throw error;
      setTempRows((previewData as unknown as PreviewRow[]) ?? []);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoadingTemp(false);
    }
  }, [selectedMarketId, settlementDate, testPrice, tetherRate]);

  // Auto-refresh every 2 seconds when preview is active
  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    autoRefreshRef.current = setInterval(() => {
      if (tempRows.length > 0) void fetchTempPreview();
    }, 2000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [fetchTempPreview, tempRows.length]);

  async function handleFinalPreview() {
    if (!selectedMarketId || !rateToman || !rateTether) { toast.error('نرخ‌ها را وارد کنید'); return; }
    setLoadingFinal(true);
    try {
      const { data: previewData, error } = await db.rpc('get_settlement_preview', {
        p_market_id: selectedMarketId,
        p_settlement_date: settlementDate,
        p_test_price: parseInt(rateToman, 10),
        p_tether_rate: parseInt(rateTether, 10),
      });
      if (error) throw error;
      setFinalRows((previewData as unknown as PreviewRow[]) ?? []);
      setPreviewDone(true);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoadingFinal(false);
    }
  }

  async function handleApplyFinal() {
    if (!selectedMarketId) return;
    setApplying(true);
    try {
      const { data: applyData, error } = await db.rpc('apply_settlement', {
        p_market_id: selectedMarketId,
        p_settlement_date: settlementDate,
        p_rate_toman: parseInt(rateToman, 10),
        p_rate_tether: parseInt(rateTether, 10),
      });
      if (error) throw error;
      const result = applyData as unknown as { settlement_id: string; affected_traders: number };
      setAppliedSettlement({ id: result.settlement_id, traders: result.affected_traders });
      toast.success('تصفیه قطعی اعمال شد');
      setConfirmApply(false);
      setReversalWindow(30 * 60);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setApplying(false);
    }
  }

  async function handleReverse() {
    if (!lastSettlement || !reversalReason) { toast.error('دلیل برگشت را وارد کنید'); return; }
    setReversing(true);
    try {
      const { error } = await db.rpc('reverse_settlement', {
        p_settlement_id: appliedSettlement?.id ?? lastSettlement.id,
        p_reason: reversalReason,
      });
      if (error) throw error;
      toast.success('تصفیه برگشت خورد');
      setReversalWindow(0);
      setAppliedSettlement(null);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setReversing(false);
      setConfirmReverse(false);
    }
  }

  const selectedMarket = markets.find((m) => m.id === selectedMarketId);
  const reversalMins = Math.floor(reversalWindow / 60);
  const reversalSecs = reversalWindow % 60;
  const canReverse = reversalWindow > 0 && !!appliedSettlement;

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>کنترل تصفیه</h1>

      {/* Section 1: Market + date selector */}
      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>بازار</label>
            <select
              value={selectedMarketId}
              onChange={(e) => setSelectedMarketId(e.target.value)}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-overlay)',
              }}
            >
              {markets.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>تاریخ تسویه</label>
            <input
              type="text"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              placeholder="1405/02/11"
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
            />
          </div>
          {selectedMarket && (
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              مزنه:{' '}
              <span
                className="tabular-nums font-semibold"
                style={{ color: 'var(--accent-gold)', fontFamily: "'Geist Mono', monospace" }}
              >
                {formatTomans(selectedMarket.mazneCurrent)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Temporary settlement preview */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            تصفیه موقت (ریسک لحظه‌ای)
          </p>
        </div>
        <div className="p-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>قیمت آزمایشی</label>
              <input
                type="number"
                value={testPrice}
                onChange={(e) => setTestPrice(e.target.value)}
                className="w-36 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>نرخ تتر</label>
              <input
                type="number"
                value={tetherRate}
                onChange={(e) => setTetherRate(e.target.value)}
                className="w-28 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
              />
            </div>
            <button
              type="button"
              onClick={() => void fetchTempPreview()}
              disabled={loadingTemp}
              className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:opacity-80"
              style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
            >
              {loadingTemp ? 'محاسبه...' : 'محاسبه'}
            </button>
          </div>
          {loadingTemp ? <SkeletonCard lines={4} /> : <PreviewTable rows={tempRows} />}
        </div>
      </div>

      {/* Section 3: Final settlement */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>تصفیه قطعی</p>
        </div>
        <div className="p-4 space-y-4">
          {appliedSettlement ? (
            <div
              className="rounded-xl border p-6 text-center"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--semantic-success) 10%, transparent)',
                borderColor: 'var(--semantic-success)',
              }}
            >
              <p className="text-base font-bold mb-1" style={{ color: 'var(--semantic-success)' }}>
                تصفیه موفق اعمال شد
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {toFa(appliedSettlement.traders)} تریدر تأثیر پذیرفتند
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>نرخ تومانی</label>
                  <input
                    type="number"
                    value={rateToman}
                    onChange={(e) => { setRateToman(e.target.value); setPreviewDone(false); }}
                    className="w-36 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>نرخ تتر</label>
                  <input
                    type="number"
                    value={rateTether}
                    onChange={(e) => { setRateTether(e.target.value); setPreviewDone(false); }}
                    className="w-28 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleFinalPreview()}
                  disabled={loadingFinal}
                  className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:opacity-80"
                  style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
                >
                  پیش‌نمایش
                </button>
              </div>

              {loadingFinal ? (
                <SkeletonCard lines={4} />
              ) : finalRows.length > 0 ? (
                <>
                  <PreviewTable rows={finalRows} />
                  <div
                    className="flex items-center gap-2 rounded-lg border p-3"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--semantic-warn) 8%, transparent)',
                      borderColor: 'color-mix(in srgb, var(--semantic-warn) 30%, transparent)',
                    }}
                  >
                    <AlertTriangle size={16} style={{ color: 'var(--semantic-warn)', flexShrink: 0 }} />
                    <p className="text-xs" style={{ color: 'var(--semantic-warn)' }}>
                      بعد از اعمال تصفیه قطعی، معاملات قفل می‌شوند. این عمل تنها در ۳۰ دقیقه قابل برگشت است.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmApply(true)}
                    disabled={!previewDone}
                    className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-40 hover:opacity-80"
                    style={{ backgroundColor: 'var(--semantic-danger)', color: '#fff' }}
                  >
                    اعمال تصفیه قطعی
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Section 4: Reversal */}
      {canReverse && (
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>برگشت تصفیه</p>
            <span
              className="tabular-nums text-sm font-bold"
              style={{ color: 'var(--semantic-warn)', fontFamily: "'Geist Mono', monospace" }}
            >
              {toFa(`${String(reversalMins).padStart(2, '0')}:${String(reversalSecs).padStart(2, '0')}`)} مانده
            </span>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>دلیل برگشت</label>
            <input
              type="text"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="دلیل را وارد کنید..."
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
            />
          </div>
          <button
            type="button"
            onClick={() => setConfirmReverse(true)}
            disabled={!reversalReason}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 hover:opacity-80"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--semantic-warn) 15%, transparent)',
              color: 'var(--semantic-warn)',
            }}
          >
            <RotateCcw size={14} />
            برگشت تصفیه
          </button>
        </div>
      )}

      {/* Section 5: Archive */}
      {archive.length > 0 && (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <p
            className="border-b px-4 py-3 text-sm font-semibold"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            آرشیو تصفیه‌ها
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: 720 }}>
              <colgroup>
                <col style={{ width: '14%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                  {['تاریخ', 'نرخ تومان', 'نرخ تتر', 'معاملات', 'حجم', 'کمیسیون کل', 'وضعیت'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {archive.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t hover:bg-white/5"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {toFa(s.settlementDate)}
                    </td>
                    <td
                      className="px-3 py-2.5 tabular-nums"
                      style={{ color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
                    >
                      {formatTomans(s.rateToman)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {formatTomans(s.rateTether)}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                      {toFa(s.totalTradesCount)}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                      {toFa(s.totalVolumeUnits)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {formatTomans(s.totalCommissionToman)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={
                          s.reversedAt
                            ? {
                                backgroundColor: 'color-mix(in srgb, var(--semantic-warn) 12%, transparent)',
                                color: 'var(--semantic-warn)',
                              }
                            : {
                                backgroundColor: 'color-mix(in srgb, var(--semantic-success) 12%, transparent)',
                                color: 'var(--semantic-success)',
                              }
                        }
                      >
                        {s.reversedAt ? 'برگشت خورده' : 'فعال'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm apply */}
      <ConfirmDialog
        open={confirmApply}
        onClose={() => setConfirmApply(false)}
        onConfirm={handleApplyFinal}
        title="اعمال تصفیه قطعی"
        description="این عمل غیرقابل بازگشت است (جز در ۳۰ دقیقه آینده). آیا مطمئنید؟"
        confirmLabel="اعمال تصفیه"
        variant="danger"
        requireType="تأیید"
        loading={applying}
      />

      {/* Confirm reverse */}
      <ConfirmDialog
        open={confirmReverse}
        onClose={() => setConfirmReverse(false)}
        onConfirm={handleReverse}
        title="برگشت تصفیه"
        description="آیا مطمئنید که می‌خواهید تصفیه را برگشت بزنید؟"
        confirmLabel="برگشت تصفیه"
        variant="danger"
        loading={reversing}
      />
    </div>
  );
}

