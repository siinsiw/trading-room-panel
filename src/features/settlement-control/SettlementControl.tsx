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
        Ù‡ÛŒÚ† ØªØ±ÛŒØ¯Ø±ÛŒ Ø¯Ø± Ø§ÛŒÙ† Ø¨Ø§Ø²Ù‡ ØªØ³ÙˆÛŒÙ‡ Ù†Ø¯Ø§Ø±Ø¯
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
            {['Ù†Ø§Ù… ØªØ±ÛŒØ¯Ø±', 'ÙˆØ¯ÛŒØ¹Ù‡', 'P&L Ø´Ù†Ø§ÙˆØ±', 'Ú©Ù…ÛŒØ³ÛŒÙˆÙ†', 'Ù…Ø§Ø±Ø¬ÛŒÙ† Ù„Ø§Ø²Ù…', 'Ù…ÙˆØ¬ÙˆØ¯', 'Ø¯Ø±ØµØ¯', 'ÙˆØ¶Ø¹ÛŒØª'].map((h) => (
              <th key={h} className="px-3 py-2 text-right font-medium" style={{ color: 'var(--text-tertiary)' }}>
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
                {toFa(r.percentage.toFixed(1))}Ùª
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
    if (!selectedMarketId || !rateToman || !rateTether) { toast.error('Ù†Ø±Ø®â€ŒÙ‡Ø§ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯'); return; }
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
      toast.success('ØªØµÙÛŒÙ‡ Ù‚Ø·Ø¹ÛŒ Ø§Ø¹Ù…Ø§Ù„ Ø´Ø¯');
      setConfirmApply(false);
      setReversalWindow(30 * 60);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setApplying(false);
    }
  }

  async function handleReverse() {
    if (!lastSettlement || !reversalReason) { toast.error('Ø¯Ù„ÛŒÙ„ Ø¨Ø±Ú¯Ø´Øª Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯'); return; }
    setReversing(true);
    try {
      const { error } = await db.rpc('reverse_settlement', {
        p_settlement_id: appliedSettlement?.id ?? lastSettlement.id,
        p_reason: reversalReason,
      });
      if (error) throw error;
      toast.success('ØªØµÙÛŒÙ‡ Ø¨Ø±Ú¯Ø´Øª Ø®ÙˆØ±Ø¯');
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
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Ú©Ù†ØªØ±Ù„ ØªØµÙÛŒÙ‡</h1>

      {/* Section 1: Market + date selector */}
      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>Ø¨Ø§Ø²Ø§Ø±</label>
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
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>ØªØ§Ø±ÛŒØ® ØªØ³ÙˆÛŒÙ‡</label>
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
              Ù…Ø²Ù†Ù‡:{' '}
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
            ØªØµÙÛŒÙ‡ Ù…ÙˆÙ‚Øª (Ø±ÛŒØ³Ú© Ù„Ø­Ø¸Ù‡â€ŒØ§ÛŒ)
          </p>
        </div>
        <div className="p-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>Ù‚ÛŒÙ…Øª Ø¢Ø²Ù…Ø§ÛŒØ´ÛŒ</label>
              <input
                type="number"
                value={testPrice}
                onChange={(e) => setTestPrice(e.target.value)}
                className="w-36 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>Ù†Ø±Ø® ØªØªØ±</label>
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
              {loadingTemp ? 'Ù…Ø­Ø§Ø³Ø¨Ù‡...' : 'Ù…Ø­Ø§Ø³Ø¨Ù‡'}
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
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>ØªØµÙÛŒÙ‡ Ù‚Ø·Ø¹ÛŒ</p>
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
                ØªØµÙÛŒÙ‡ Ù…ÙˆÙÙ‚ Ø§Ø¹Ù…Ø§Ù„ Ø´Ø¯
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {toFa(appliedSettlement.traders)} ØªØ±ÛŒØ¯Ø± ØªØ£Ø«ÛŒØ± Ù¾Ø°ÛŒØ±ÙØªÙ†Ø¯
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>Ù†Ø±Ø® ØªÙˆÙ…Ø§Ù†ÛŒ</label>
                  <input
                    type="number"
                    value={rateToman}
                    onChange={(e) => { setRateToman(e.target.value); setPreviewDone(false); }}
                    className="w-36 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>Ù†Ø±Ø® ØªØªØ±</label>
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
                  Ù¾ÛŒØ´â€ŒÙ†Ù…Ø§ÛŒØ´
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
                      Ø¨Ø¹Ø¯ Ø§Ø² Ø§Ø¹Ù…Ø§Ù„ ØªØµÙÛŒÙ‡ Ù‚Ø·Ø¹ÛŒØŒ Ù…Ø¹Ø§Ù…Ù„Ø§Øª Ù‚ÙÙ„ Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯. Ø§ÛŒÙ† Ø¹Ù…Ù„ ØªÙ†Ù‡Ø§ Ø¯Ø± Û³Û° Ø¯Ù‚ÛŒÙ‚Ù‡ Ù‚Ø§Ø¨Ù„ Ø¨Ø±Ú¯Ø´Øª Ø§Ø³Øª.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmApply(true)}
                    disabled={!previewDone}
                    className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-40 hover:opacity-80"
                    style={{ backgroundColor: 'var(--semantic-danger)', color: '#fff' }}
                  >
                    Ø§Ø¹Ù…Ø§Ù„ ØªØµÙÛŒÙ‡ Ù‚Ø·Ø¹ÛŒ
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
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ø¨Ø±Ú¯Ø´Øª ØªØµÙÛŒÙ‡</p>
            <span
              className="tabular-nums text-sm font-bold"
              style={{ color: 'var(--semantic-warn)', fontFamily: "'Geist Mono', monospace" }}
            >
              {toFa(`${String(reversalMins).padStart(2, '0')}:${String(reversalSecs).padStart(2, '0')}`)} Ù…Ø§Ù†Ø¯Ù‡
            </span>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>Ø¯Ù„ÛŒÙ„ Ø¨Ø±Ú¯Ø´Øª</label>
            <input
              type="text"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="Ø¯Ù„ÛŒÙ„ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯..."
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
            Ø¨Ø±Ú¯Ø´Øª ØªØµÙÛŒÙ‡
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
            Ø¢Ø±Ø´ÛŒÙˆ ØªØµÙÛŒÙ‡â€ŒÙ‡Ø§
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                  {['ØªØ§Ø±ÛŒØ®', 'Ù†Ø±Ø® ØªÙˆÙ…Ø§Ù†', 'Ù†Ø±Ø® ØªØªØ±', 'Ù…Ø¹Ø§Ù…Ù„Ø§Øª', 'Ø­Ø¬Ù…', 'Ú©Ù…ÛŒØ³ÛŒÙˆÙ† Ú©Ù„', 'ÙˆØ¶Ø¹ÛŒØª'].map((h) => (
                    <th key={h} className="px-3 py-2 text-right font-medium" style={{ color: 'var(--text-tertiary)' }}>
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
                        {s.reversedAt ? 'Ø¨Ø±Ú¯Ø´Øª Ø®ÙˆØ±Ø¯Ù‡' : 'ÙØ¹Ø§Ù„'}
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
        title="Ø§Ø¹Ù…Ø§Ù„ ØªØµÙÛŒÙ‡ Ù‚Ø·Ø¹ÛŒ"
        description="Ø§ÛŒÙ† Ø¹Ù…Ù„ ØºÛŒØ±Ù‚Ø§Ø¨Ù„ Ø¨Ø§Ø²Ú¯Ø´Øª Ø§Ø³Øª (Ø¬Ø² Ø¯Ø± Û³Û° Ø¯Ù‚ÛŒÙ‚Ù‡ Ø¢ÛŒÙ†Ø¯Ù‡). Ø¢ÛŒØ§ Ù…Ø·Ù…Ø¦Ù†ÛŒØ¯ØŸ"
        confirmLabel="Ø§Ø¹Ù…Ø§Ù„ ØªØµÙÛŒÙ‡"
        variant="danger"
        requireType="ØªØ£ÛŒÛŒØ¯"
        loading={applying}
      />

      {/* Confirm reverse */}
      <ConfirmDialog
        open={confirmReverse}
        onClose={() => setConfirmReverse(false)}
        onConfirm={handleReverse}
        title="Ø¨Ø±Ú¯Ø´Øª ØªØµÙÛŒÙ‡"
        description="Ø¢ÛŒØ§ Ù…Ø·Ù…Ø¦Ù†ÛŒØ¯ Ú©Ù‡ Ù…ÛŒâ€ŒØ®ÙˆØ§Ù‡ÛŒØ¯ ØªØµÙÛŒÙ‡ Ø±Ø§ Ø¨Ø±Ú¯Ø´Øª Ø¨Ø²Ù†ÛŒØ¯ØŸ"
        confirmLabel="Ø¨Ø±Ú¯Ø´Øª ØªØµÙÛŒÙ‡"
        variant="danger"
        loading={reversing}
      />
    </div>
  );
}

