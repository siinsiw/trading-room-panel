import { useState, useEffect, useCallback } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { toast } from 'sonner';
import { toFa, formatTether } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import { EmptyState } from '@/ui/compounds/EmptyState';
import { ConfirmDialog } from '@/ui/compounds/ConfirmDialog';
import type { Profile } from '@/lib/database.types';
import { Search, UserPlus } from 'lucide-react';

type TabId = 'all' | 'admin' | 'accountant' | 'trader' | 'pending';

function roleFa(role: string): string {
  const map: Record<string, string> = { admin: 'Ø§Ø¯Ù…ÛŒÙ†', accountant: 'Ø­Ø³Ø§Ø¨Ø¯Ø§Ø±', trader: 'ØªØ±ÛŒØ¯Ø±' };
  return map[role] ?? role;
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    admin: { bg: 'color-mix(in srgb, var(--accent-gold) 15%, transparent)', text: 'var(--accent-gold)' },
    accountant: { bg: 'color-mix(in srgb, var(--semantic-buy) 12%, transparent)', text: 'var(--semantic-buy)' },
    trader: { bg: 'color-mix(in srgb, var(--text-secondary) 12%, transparent)', text: 'var(--text-secondary)' },
  };
  const c = colors[role] ?? colors.trader;
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
      {roleFa(role)}
    </span>
  );
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('');
}

interface ApproveModalProps {
  trader: Profile;
  onClose: () => void;
  onApproved: () => void;
}

function ApproveModal({ trader, onClose, onApproved }: ApproveModalProps) {
  const [deposit, setDeposit] = useState('');
  const [perUnit, setPerUnit] = useState('500');
  const [commission, setCommission] = useState('50000');
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    const dep = parseFloat(deposit);
    if (!dep || dep <= 0) { toast.error('ÙˆØ¯ÛŒØ¹Ù‡ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯'); return; }
    setLoading(true);
    try {
      await (supabase as any).rpc('approve_trader', {
        p_trader_id: trader.id,
        p_deposit: dep,
        p_per_unit_deposit: parseFloat(perUnit),
        p_commission: parseInt(commission, 10),
      });
      toast.success(`${trader.full_name} ØªØ£ÛŒÛŒØ¯ Ø´Ø¯`);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          ØªØ£ÛŒÛŒØ¯ ØªØ±ÛŒØ¯Ø± â€” {trader.full_name}
        </h3>
        <div className="space-y-3">
          {([
            { label: 'ÙˆØ¯ÛŒØ¹Ù‡ (USDT)', value: deposit, set: setDeposit, ph: '1000' },
            { label: 'Ø¨ÛŒØ¹Ø§Ù†Ù‡ Ù‡Ø± ÙˆØ§Ø­Ø¯ (USDT)', value: perUnit, set: setPerUnit, ph: '500' },
            { label: 'Ú©Ù…ÛŒØ³ÛŒÙˆÙ† Ù‡Ø± ÙˆØ§Ø­Ø¯ (ØªÙˆÙ…Ø§Ù†)', value: commission, set: setCommission, ph: '50000' },
          ] as const).map((f) => (
            <div key={f.label}>
              <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
              <input
                type="number"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.ph}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg py-2 text-sm hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
            Ø§Ù†ØµØ±Ø§Ù
          </button>
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={loading}
            className="flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: 'var(--semantic-success)', color: '#000' }}
          >
            {loading ? 'Ø¯Ø± Ø­Ø§Ù„ Ø«Ø¨Øª...' : 'ØªØ£ÛŒÛŒØ¯'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface NewUserModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function NewUserModal({ onClose, onCreated }: NewUserModalProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'admin' | 'accountant' | 'trader'>('trader');
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  async function handleCreate() {
    if (!email || !fullName) { toast.error('Ø§ÛŒÙ…ÛŒÙ„ Ùˆ Ù†Ø§Ù… Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯'); return; }
    setLoading(true);
    const pass = Math.random().toString(36).slice(2, 10);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { full_name: fullName, phone, role } },
      });
      if (error) throw error;
      if (data.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('profiles').upsert({
          id: data.user.id,
          full_name: fullName,
          phone,
          role,
          active: role !== 'trader',
        });
      }
      setTempPassword(pass);
      toast.success('Ú©Ø§Ø±Ø¨Ø± Ø³Ø§Ø®ØªÙ‡ Ø´Ø¯');
      onCreated();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => { if (!tempPassword) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {tempPassword ? (
          <div className="space-y-4 text-center">
            <p className="font-semibold" style={{ color: 'var(--semantic-success)' }}>Ú©Ø§Ø±Ø¨Ø± Ø³Ø§Ø®ØªÙ‡ Ø´Ø¯</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ø±Ù…Ø² Ù…ÙˆÙ‚Øª:</p>
            <p
              className="rounded-lg border p-3 tabular-nums font-mono text-lg font-bold"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--accent-gold)', fontFamily: "'Geist Mono', monospace", backgroundColor: 'var(--bg-overlay)' }}
            >
              {tempPassword}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Ø§ÛŒÙ† Ø±Ù…Ø² Ø±Ø§ Ø¨Ù‡ Ú©Ø§Ø±Ø¨Ø± Ø§Ø·Ù„Ø§Ø¹ Ø¯Ù‡ÛŒØ¯. Ù¾Ø³ Ø§Ø² Ø¨Ø³ØªÙ‡ Ø´Ø¯Ù† Ø§ÛŒÙ† Ù¾Ù†Ø¬Ø±Ù‡ Ù‚Ø§Ø¨Ù„ Ù…Ø´Ø§Ù‡Ø¯Ù‡ Ù†ÛŒØ³Øª.</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg py-2 text-sm font-bold"
              style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
            >
              Ø¨Ø³ØªÙ†
            </button>
          </div>
        ) : (
          <>
            <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Ú©Ø§Ø±Ø¨Ø± Ø¬Ø¯ÛŒØ¯</h3>
            <div className="space-y-3">
              {([
                { label: 'ایمیل', value: email, set: setEmail, ph: 'user@example.com', type: 'email' as const },
                { label: 'نام کامل', value: fullName, set: setFullName, ph: 'علی احمدی', type: 'text' as const },
                { label: 'شماره موبایل', value: phone, set: setPhone, ph: '09121234567', type: 'text' as const },
              ]).map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    placeholder={f.ph}
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>Ù†Ù‚Ø´</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
                >
                  <option value="trader">ØªØ±ÛŒØ¯Ø±</option>
                  <option value="accountant">Ø­Ø³Ø§Ø¨Ø¯Ø§Ø±</option>
                  <option value="admin">Ø§Ø¯Ù…ÛŒÙ†</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg py-2 text-sm hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
                Ø§Ù†ØµØ±Ø§Ù
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={loading}
                className="flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
              >
                {loading ? 'Ø¯Ø± Ø­Ø§Ù„ Ø³Ø§Ø®Øª...' : 'Ø§ÛŒØ¬Ø§Ø¯'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function UsersManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [approveTarget, setApproveTarget] = useState<Profile | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Profile | null>(null);
  const [showNewUser, setShowNewUser] = useState(false);

  const fetchProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setProfiles((data as Profile[]) ?? []);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  async function handleReject() {
    if (!rejectTarget) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('profiles').update({ active: false }).eq('id', rejectTarget.id);
      toast.success('Ú©Ø§Ø±Ø¨Ø± Ø±Ø¯ Ø´Ø¯');
      fetchProfiles();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setRejectTarget(null);
    }
  }

  const tabCounts: Record<TabId, number> = {
    all: profiles.length,
    admin: profiles.filter((p) => p.role === 'admin').length,
    accountant: profiles.filter((p) => p.role === 'accountant').length,
    trader: profiles.filter((p) => p.role === 'trader' && p.active).length,
    pending: profiles.filter((p) => p.role === 'trader' && !p.active).length,
  };

  const filtered = profiles
    .filter((p) => {
      if (activeTab === 'pending') return p.role === 'trader' && !p.active;
      if (activeTab === 'admin') return p.role === 'admin';
      if (activeTab === 'accountant') return p.role === 'accountant';
      if (activeTab === 'trader') return p.role === 'trader' && p.active;
      return true;
    })
    .filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return p.full_name.toLowerCase().includes(q) || p.phone.includes(q);
    });

  const tabLabels: Record<TabId, string> = {
    all: 'Ù‡Ù…Ù‡',
    admin: 'Ø§Ø¯Ù…ÛŒÙ†',
    accountant: 'Ø­Ø³Ø§Ø¨Ø¯Ø§Ø±',
    trader: 'ØªØ±ÛŒØ¯Ø±',
    pending: 'Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø± ØªØ£ÛŒÛŒØ¯',
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Ù…Ø¯ÛŒØ±ÛŒØª Ú©Ø§Ø±Ø¨Ø±Ø§Ù†</h1>
        <button
          type="button"
          onClick={() => setShowNewUser(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold hover:opacity-80 transition-opacity"
          style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
        >
          <UserPlus size={16} />
          Ú©Ø§Ø±Ø¨Ø± Ø¬Ø¯ÛŒØ¯
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ø¬Ø³ØªØ¬Ùˆ Ø¨Ø± Ø§Ø³Ø§Ø³ Ù†Ø§Ù… ÛŒØ§ Ù…ÙˆØ¨Ø§ÛŒÙ„..."
          className="w-full rounded-lg border bg-transparent py-2 pr-9 pl-3 text-sm outline-none"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        />
      </div>

      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <Tabs.List
          className="flex gap-1 rounded-lg border p-1"
          style={{ backgroundColor: 'var(--bg-overlay)', borderColor: 'var(--border-subtle)' }}
        >
          {(Object.entries(tabLabels) as [TabId, string][]).map(([id, label]) => (
            <Tabs.Trigger
              key={id}
              value={id}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                activeTab === id
                  ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }
                  : { color: 'var(--text-tertiary)' }
              }
            >
              {label}
              {tabCounts[id] > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px]"
                  style={
                    id === 'pending'
                      ? { backgroundColor: 'color-mix(in srgb, var(--semantic-warn) 15%, transparent)', color: 'var(--semantic-warn)' }
                      : { backgroundColor: 'color-mix(in srgb, var(--accent-gold) 15%, transparent)', color: 'var(--accent-gold)' }
                  }
                >
                  {toFa(tabCounts[id])}
                </span>
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Pending tab: card layout */}
        <Tabs.Content value="pending" className="mt-4">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="Ù‡ÛŒÚ† ØªØ±ÛŒØ¯Ø±ÛŒ Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø± ØªØ£ÛŒÛŒØ¯ Ù†ÛŒØ³Øª" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border p-4"
                  style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--accent-gold) 15%, transparent)', color: 'var(--accent-gold)' }}
                    >
                      {initials(p.full_name)}
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.full_name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{toFa(p.phone)}</p>
                    </div>
                  </div>
                  {p.telegram_id && (
                    <p className="mb-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>@{p.telegram_id}</p>
                  )}
                  <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {toFa(new Date(p.created_at).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }))}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRejectTarget(p)}
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium hover:opacity-80"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--semantic-danger) 12%, transparent)', color: 'var(--semantic-danger)' }}
                    >
                      Ø±Ø¯
                    </button>
                    <button
                      type="button"
                      onClick={() => setApproveTarget(p)}
                      className="flex-1 rounded-lg py-1.5 text-xs font-bold hover:opacity-80"
                      style={{ backgroundColor: 'var(--semantic-success)', color: '#000' }}
                    >
                      ØªØ£ÛŒÛŒØ¯
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tabs.Content>

        {/* Other tabs: table layout */}
        {(['all', 'admin', 'accountant', 'trader'] as const).map((tab) => (
          <Tabs.Content key={tab} value={tab} className="mt-4">
            {loading ? (
              <SkeletonCard lines={5} />
            ) : filtered.length === 0 ? (
              <EmptyState title="Ú©Ø§Ø±Ø¨Ø±ÛŒ ÛŒØ§ÙØª Ù†Ø´Ø¯" />
            ) : (
              <div
                className="overflow-hidden rounded-xl border"
                style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                        {['Ù†Ø§Ù…', 'Ù…ÙˆØ¨Ø§ÛŒÙ„', 'Ù†Ù‚Ø´', 'ÙˆØ¶Ø¹ÛŒØª', 'ÙˆØ¯ÛŒØ¹Ù‡', 'Ø¹Ù…Ù„ÛŒØ§Øª'].map((h) => (
                          <th key={h} className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr
                          key={p.id}
                          className="border-t transition-colors hover:bg-white/5"
                          style={{ borderColor: 'var(--border-subtle)' }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                                style={{ backgroundColor: 'color-mix(in srgb, var(--accent-gold) 12%, transparent)', color: 'var(--accent-gold)' }}
                              >
                                {initials(p.full_name)}
                              </div>
                              <span style={{ color: 'var(--text-primary)' }}>{p.full_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}>
                            {toFa(p.phone)}
                          </td>
                          <td className="px-4 py-3"><RoleBadge role={p.role} /></td>
                          <td className="px-4 py-3">
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={
                                p.active
                                  ? { backgroundColor: 'color-mix(in srgb, var(--semantic-success) 12%, transparent)', color: 'var(--semantic-success)' }
                                  : { backgroundColor: 'color-mix(in srgb, var(--semantic-danger) 12%, transparent)', color: 'var(--semantic-danger)' }
                              }
                            >
                              {p.active ? 'ÙØ¹Ø§Ù„' : 'ØºÛŒØ±ÙØ¹Ø§Ù„'}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {p.deposit_tether != null ? formatTether(p.deposit_tether) : 'â€”'}
                          </td>
                          <td className="px-4 py-3">
                            {p.role === 'trader' && !p.active && (
                              <button
                                type="button"
                                onClick={() => setApproveTarget(p)}
                                className="rounded px-2 py-1 text-xs font-medium hover:opacity-80"
                                style={{ backgroundColor: 'var(--semantic-success)', color: '#000' }}
                              >
                                ØªØ£ÛŒÛŒØ¯
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Tabs.Content>
        ))}
      </Tabs.Root>

      {approveTarget && (
        <ApproveModal trader={approveTarget} onClose={() => setApproveTarget(null)} onApproved={fetchProfiles} />
      )}

      <ConfirmDialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        title="Ø±Ø¯ Ø¯Ø±Ø®ÙˆØ§Ø³Øª"
        description={`Ø¢ÛŒØ§ Ù…ÛŒâ€ŒØ®ÙˆØ§Ù‡ÛŒØ¯ Ø¯Ø±Ø®ÙˆØ§Ø³Øª ${rejectTarget?.full_name ?? ''} Ø±Ø§ Ø±Ø¯ Ú©Ù†ÛŒØ¯ØŸ`}
        confirmLabel="Ø±Ø¯"
        variant="danger"
      />

      {showNewUser && (
        <NewUserModal onClose={() => setShowNewUser(false)} onCreated={fetchProfiles} />
      )}
    </div>
  );
}

