import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { toFa, formatTomans } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { repos } from '@/data/repositories/index';
import { supabase } from '@/lib/supabase';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import { EmptyState } from '@/ui/compounds/EmptyState';
import { ConfirmDialog } from '@/ui/compounds/ConfirmDialog';
import type { Market } from '@/domain/types';
import { Plus, Check, X } from 'lucide-react';

interface MarketFormData {
  name: string;
  symbol: string;
  unit_weight: string;
  unit_label: string;
  lafz_min: string;
  lafz_max: string;
  lafz_scale: string;
  mazne_current: string;
  active: boolean;
}

const defaultForm: MarketFormData = {
  name: '',
  symbol: '',
  unit_weight: '100',
  unit_label: 'Ú¯Ø±Ù…',
  lafz_min: '1',
  lafz_max: '999',
  lafz_scale: '1000',
  mazne_current: '',
  active: true,
};

interface MarketModalProps {
  market?: Market;
  onClose: () => void;
  onSaved: () => void;
}

function MarketModal({ market, onClose, onSaved }: MarketModalProps) {
  const [form, setForm] = useState<MarketFormData>(
    market
      ? {
          name: market.name,
          symbol: market.symbol,
          unit_weight: String(market.unitWeight),
          unit_label: market.unitLabel,
          lafz_min: String(market.lafzMin),
          lafz_max: String(market.lafzMax),
          lafz_scale: String(market.lafzScale),
          mazne_current: String(market.mazneCurrent),
          active: market.active,
        }
      : defaultForm,
  );
  const [loading, setLoading] = useState(false);

  function setField(k: keyof MarketFormData, v: string | boolean) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.symbol || !form.mazne_current) {
      toast.error('ÙÛŒÙ„Ø¯Ù‡Ø§ÛŒ Ø§Ø¬Ø¨Ø§Ø±ÛŒ Ø±Ø§ Ù¾Ø± Ú©Ù†ÛŒØ¯');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        symbol: form.symbol.toUpperCase(),
        unitWeight: parseFloat(form.unit_weight),
        unitLabel: form.unit_label,
        lafzMin: parseInt(form.lafz_min, 10),
        lafzMax: parseInt(form.lafz_max, 10),
        lafzScale: parseInt(form.lafz_scale, 10),
        mazneCurrent: parseInt(form.mazne_current, 10),
        active: form.active,
      };

      if (market) {
        await repos.markets.update(market.id, payload);
        toast.success('Ø¨Ø§Ø²Ø§Ø± Ø¨Ø±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯');
      } else {
        await repos.markets.create({ ...payload, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
        toast.success('Ø¨Ø§Ø²Ø§Ø± Ø¬Ø¯ÛŒØ¯ Ø§Ø¶Ø§ÙÙ‡ Ø´Ø¯');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }

  const fields: { label: string; key: keyof MarketFormData; type?: string; placeholder?: string }[] = [
    { label: 'Ù†Ø§Ù… Ø¨Ø§Ø²Ø§Ø±', key: 'name', placeholder: 'Ø·Ù„Ø§ÛŒ Ø¢Ø¨â€ŒØ´Ø¯Ù‡' },
    { label: 'Ù†Ù…Ø§Ø¯', key: 'symbol', placeholder: 'GOLD' },
    { label: 'ÙˆØ²Ù† ÙˆØ§Ø­Ø¯', key: 'unit_weight', type: 'number', placeholder: '100' },
    { label: 'Ø¨Ø±Ú†Ø³Ø¨ ÙˆØ§Ø­Ø¯', key: 'unit_label', placeholder: 'Ú¯Ø±Ù…' },
    { label: 'Ø­Ø¯Ø§Ù‚Ù„ Ù„ÙØ¸', key: 'lafz_min', type: 'number', placeholder: '1' },
    { label: 'Ø­Ø¯Ø§Ú©Ø«Ø± Ù„ÙØ¸', key: 'lafz_max', type: 'number', placeholder: '999' },
    { label: 'Ø¶Ø±ÛŒØ¨ Ù„ÙØ¸ (ØªÙˆÙ…Ø§Ù†)', key: 'lafz_scale', type: 'number', placeholder: '1000' },
    { label: 'Ù…Ø²Ù†Ù‡ ÙØ¹Ù„ÛŒ', key: 'mazne_current', type: 'number', placeholder: '4500000' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <h3 className="mb-5 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {market ? 'ÙˆÛŒØ±Ø§ÛŒØ´ Ø¨Ø§Ø²Ø§Ø±' : 'Ø¨Ø§Ø²Ø§Ø± Ø¬Ø¯ÛŒØ¯'}
        </h3>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                <input
                  type={f.type ?? 'text'}
                  value={form[f.key] as string}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', fontFamily: f.type === 'number' ? "'Geist Mono', monospace" : undefined }}
                />
              </div>
            ))}
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={cn('relative h-5 w-9 rounded-full transition-colors')}
              style={{ backgroundColor: form.active ? 'var(--semantic-success)' : 'var(--border-strong)' }}
              onClick={() => setField('active', !form.active)}
            >
              <div
                className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform')}
                style={{ transform: form.active ? 'translateX(-1px)' : 'translateX(-17px)' }}
              />
            </div>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {form.active ? 'ÙØ¹Ø§Ù„' : 'ØºÛŒØ±ÙØ¹Ø§Ù„'}
            </span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg py-2 text-sm font-medium hover:bg-white/5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Ø§Ù†ØµØ±Ø§Ù
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
            >
              {loading ? 'Ø¯Ø± Ø­Ø§Ù„ Ø°Ø®ÛŒØ±Ù‡...' : 'Ø°Ø®ÛŒØ±Ù‡'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MarketsManagement() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMarket, setEditMarket] = useState<Market | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  // Inline mazne edit
  const [editingMazne, setEditingMazne] = useState<string | null>(null);
  const [mazneValue, setMazneValue] = useState('');
  const [savingMazne, setSavingMazne] = useState(false);

  const fetchMarkets = useCallback(async () => {
    try {
      const data = await repos.markets.getAll();
      setMarkets(data);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  async function handleSaveMazne(id: string) {
    const val = parseInt(mazneValue, 10);
    if (!val || val <= 0) { toast.error('Ù…Ø²Ù†Ù‡ Ù†Ø§Ù…Ø¹ØªØ¨Ø±'); return; }
    setSavingMazne(true);
    try {
      await (supabase as any).rpc('update_mazne', { p_market_id: id, p_new_mazne: val });
      toast.success('Ù…Ø²Ù†Ù‡ Ø¨Ø±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯');
      setMarkets((prev) => prev.map((m) => m.id === id ? { ...m, mazneCurrent: val } : m));
      setEditingMazne(null);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setSavingMazne(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateId) return;
    try {
      await repos.markets.update(deactivateId, { active: false });
      toast.success('Ø¨Ø§Ø²Ø§Ø± ØºÛŒØ±ÙØ¹Ø§Ù„ Ø´Ø¯');
      fetchMarkets();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setDeactivateId(null);
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Ù…Ø¯ÛŒØ±ÛŒØª Ø¨Ø§Ø²Ø§Ø±Ù‡Ø§</h1>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
        >
          <Plus size={16} />
          Ø¨Ø§Ø²Ø§Ø± Ø¬Ø¯ÛŒØ¯
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      ) : markets.length === 0 ? (
        <EmptyState title="Ø¨Ø§Ø²Ø§Ø±ÛŒ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯" action={{ label: 'Ø§ÙØ²ÙˆØ¯Ù† Ø¨Ø§Ø²Ø§Ø±', onClick: () => setShowModal(true) }} />
      ) : (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                  {['Ù†Ø§Ù…', 'Ù†Ù…Ø§Ø¯', 'Ù…Ø²Ù†Ù‡', 'Ø¨Ø§Ø²Ù‡ Ù„ÙØ¸', 'ÙˆØ²Ù†', 'ÙˆØ¶Ø¹ÛŒØª', 'Ø¹Ù…Ù„ÛŒØ§Øª'].map((h) => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {markets.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t transition-colors hover:bg-white/5"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{m.name}</td>
                    <td className="px-4 py-3 tabular-nums font-mono" style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}>
                      {m.symbol}
                    </td>
                    <td className="px-4 py-3">
                      {editingMazne === m.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={mazneValue}
                            onChange={(e) => setMazneValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void handleSaveMazne(m.id);
                              if (e.key === 'Escape') setEditingMazne(null);
                            }}
                            autoFocus
                            className="w-28 rounded border bg-transparent px-2 py-1 text-xs outline-none"
                            style={{ borderColor: 'var(--accent-gold)', color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}
                          />
                          <button type="button" onClick={() => void handleSaveMazne(m.id)} disabled={savingMazne} style={{ color: 'var(--semantic-success)' }}>
                            <Check size={13} />
                          </button>
                          <button type="button" onClick={() => setEditingMazne(null)} style={{ color: 'var(--semantic-danger)' }}>
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <span
                          className="tabular-nums cursor-pointer hover:text-opacity-80"
                          style={{ color: 'var(--accent-gold)', fontFamily: "'Geist Mono', monospace" }}
                          onDoubleClick={() => { setEditingMazne(m.id); setMazneValue(String(m.mazneCurrent)); }}
                          title="Ø¯Ùˆ Ø¨Ø§Ø± Ú©Ù„ÛŒÚ© Ø¨Ø±Ø§ÛŒ ÙˆÛŒØ±Ø§ÛŒØ´"
                        >
                          {formatTomans(m.mazneCurrent)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {toFa(m.lafzMin)}â€“{toFa(m.lafzMax)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {toFa(m.unitWeight)} {m.unitLabel}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={
                          m.active
                            ? { backgroundColor: 'color-mix(in srgb, var(--semantic-success) 12%, transparent)', color: 'var(--semantic-success)' }
                            : { backgroundColor: 'color-mix(in srgb, var(--semantic-danger) 12%, transparent)', color: 'var(--semantic-danger)' }
                        }
                      >
                        {m.active ? 'ÙØ¹Ø§Ù„' : 'ØºÛŒØ±ÙØ¹Ø§Ù„'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditMarket(m)}
                          className="rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-white/10"
                          style={{ color: 'var(--accent-gold)' }}
                        >
                          ÙˆÛŒØ±Ø§ÛŒØ´
                        </button>
                        {m.active && (
                          <button
                            type="button"
                            onClick={() => setDeactivateId(m.id)}
                            className="rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-white/10"
                            style={{ color: 'var(--semantic-danger)' }}
                          >
                            ØºÛŒØ±ÙØ¹Ø§Ù„
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showModal || editMarket) && (
        <MarketModal
          market={editMarket ?? undefined}
          onClose={() => { setShowModal(false); setEditMarket(null); }}
          onSaved={fetchMarkets}
        />
      )}

      <ConfirmDialog
        open={!!deactivateId}
        onClose={() => setDeactivateId(null)}
        onConfirm={handleDeactivate}
        title="ØºÛŒØ±ÙØ¹Ø§Ù„ Ú©Ø±Ø¯Ù† Ø¨Ø§Ø²Ø§Ø±"
        description="Ø¢ÛŒØ§ Ù…Ø·Ù…Ø¦Ù†ÛŒØ¯ Ú©Ù‡ Ù…ÛŒâ€ŒØ®ÙˆØ§Ù‡ÛŒØ¯ Ø§ÛŒÙ† Ø¨Ø§Ø²Ø§Ø± Ø±Ø§ ØºÛŒØ±ÙØ¹Ø§Ù„ Ú©Ù†ÛŒØ¯ØŸ Ø³ÙØ§Ø±Ø´â€ŒÙ‡Ø§ÛŒ Ø¨Ø§Ø² Ù‡Ù†ÙˆØ² Ø¯Ø± Ø³ÛŒØ³ØªÙ… Ù…ÛŒâ€ŒÙ…Ø§Ù†Ù†Ø¯."
        confirmLabel="ØºÛŒØ±ÙØ¹Ø§Ù„"
        variant="danger"
      />
    </div>
  );
}

