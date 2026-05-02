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
import { Search, UserPlus, Pencil } from 'lucide-react';
import { EditUserModal } from './EditUserModal';

type TabId = 'all' | 'admin' | 'accountant' | 'trader' | 'pending';

function roleFa(role: string): string {
  const map: Record<string, string> = { admin: 'ادمین', accountant: 'حسابدار', trader: 'تریدر' };
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
  const isTrader = trader.role === 'trader';
  const [deposit, setDeposit] = useState('');
  const [perUnit, setPerUnit] = useState('500');
  const [commission, setCommission] = useState('50000');
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    if (isTrader) {
      const dep = parseFloat(deposit);
      if (!dep || dep <= 0) { toast.error('ودیعه را وارد کنید'); return; }
    }
    setLoading(true);
    try {
      // approve_user برای همه‌ی نقش‌ها کار می‌کند — برای admin/accountant فیلدهای مالی null می‌فرستیم
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('approve_user', {
        p_user_id:           trader.id,
        p_deposit:           isTrader ? parseFloat(deposit)        : null,
        p_per_unit_deposit:  isTrader ? parseFloat(perUnit)        : null,
        p_commission:        isTrader ? parseInt(commission, 10)   : null,
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
          تأیید {trader.role === 'admin' ? 'ادمین' : trader.role === 'accountant' ? 'حسابدار' : 'تریدر'} — {trader.full_name}
        </h3>
        {trader.role === 'admin' && (
          <p className="mb-3 text-xs rounded-lg px-3 py-2"
             style={{ color: 'var(--semantic-warn)', backgroundColor: 'color-mix(in srgb, var(--semantic-warn) 12%, transparent)' }}>
            ⚠ تأیید ادمین فقط توسط سوپرادمین مجاز است.
          </p>
        )}
        {isTrader ? (
          <div className="space-y-3">
            {([
              { label: 'ودیعه (USDT)', value: deposit, set: setDeposit, ph: '1000' },
              { label: 'بیعانه هر واحد (USDT)', value: perUnit, set: setPerUnit, ph: '500' },
              { label: 'کمیسیون هر واحد (تومان)', value: commission, set: setCommission, ph: '50000' },
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
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            با تأیید، این کاربر فعال می‌شود و می‌تواند وارد پنل شود.
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg py-2 text-sm hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
            انصراف
          </button>
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={loading}
            className="flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: 'var(--semantic-success)', color: '#000' }}
          >
            {loading ? 'در حال ثبت...' : 'تأیید'}
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
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'accountant' | 'trader'>('trader');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleCreate() {
    if (!email || !fullName) { toast.error('ایمیل و نام را وارد کنید'); return; }
    if (password.length < 6) { toast.error('رمز عبور حداقل ۶ کاراکتر باشد'); return; }

    setLoading(true);

    // ۱) قبل از signUp، session ادمین را نگه می‌داریم تا بعد از signUp restore کنیم
    const { data: { session: adminSession } } = await supabase.auth.getSession();

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // metadata به trigger handle_new_user می‌رود؛ آنجا role/full_name/phone/telegram خوانده می‌شوند
          data: { full_name: fullName, phone, role },
          emailRedirectTo: undefined,
        },
      });
      if (error) {
        if (error.message?.toLowerCase().includes('rate limit')) {
          throw new Error('محدودیت ارسال ایمیل. در Supabase Dashboard → Authentication → Email، Confirm email را خاموش کنید.');
        }
        throw error;
      }

      const userId = data.user?.id;

      // ۲) برگرداندن session ادمین — signUp ما را به‌عنوان کاربر جدید لاگین کرده،
      //    اما برای ادامه‌ی کار (و تأیید کاربر) باید دوباره ادمین باشیم.
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      // ۳) اگر نقش admin/accountant است، ادمین می‌تواند مستقیم تأییدش کند با approve_user
      //    (trader را در همان لیست pending نشان می‌دهیم تا ادمین با عدد ودیعه تأیید کند)
      if (userId && role !== 'trader') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).rpc('approve_user', { p_user_id: userId });
      }

      setDone(true);
      toast.success('کاربر ساخته شد' + (role !== 'trader' ? ' و تأیید شد' : ' — منتظر تأیید'));
      onCreated();
    } catch (err) {
      // اگر در میانه‌ی کار session ادمین برگشت اما خطا داد، دوباره restore
      if (adminSession) {
        try {
          await supabase.auth.setSession({
            access_token: adminSession.access_token,
            refresh_token: adminSession.refresh_token,
          });
        } catch { /* ignore */ }
      }
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => { if (!done) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {done ? (
          <div className="space-y-4 text-center">
            <p className="font-semibold" style={{ color: 'var(--semantic-success)' }}>
              کاربر ساخته شد
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              ایمیل: <span style={{ color: 'var(--text-primary)' }}>{email}</span>
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {role === 'trader'
                ? 'تریدر در لیست «در انتظار تأیید» قرار گرفت — برای فعال‌سازی روی تأیید کلیک کنید.'
                : 'این کاربر فعال شد و می‌تواند با ایمیل و رمز وارد شود.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg py-2 text-sm font-bold"
              style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
            >
              بستن
            </button>
          </div>
        ) : (
          <>
            <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>کاربر جدید</h3>
            <div className="space-y-3">
              {([
                { label: 'ایمیل', value: email, set: setEmail, ph: 'user@example.com', type: 'email' as const },
                { label: 'نام کامل', value: fullName, set: setFullName, ph: 'علی احمدی', type: 'text' as const },
                { label: 'شماره موبایل', value: phone, set: setPhone, ph: '09121234567', type: 'text' as const },
                { label: 'رمز عبور (حداقل ۶ کاراکتر)', value: password, set: setPassword, ph: '••••••••', type: 'text' as const },
              ]).map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    placeholder={f.ph}
                    dir={f.label.startsWith('ایمیل') || f.label.startsWith('رمز') ? 'ltr' : 'rtl'}
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>نقش</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
                >
                  <option value="trader">تریدر</option>
                  <option value="accountant">حسابدار</option>
                  <option value="admin">ادمین</option>
                </select>
                {role === 'admin' && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--semantic-warn)' }}>
                    ⚠ ادمین جدید فقط توسط سوپرادمین قابل تأیید است
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg py-2 text-sm hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
                انصراف
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={loading}
                className="flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
              >
                {loading ? 'در حال ساخت...' : 'ایجاد'}
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
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
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
      toast.success('کاربر رد شد');
      fetchProfiles();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setRejectTarget(null);
    }
  }

  const tabCounts: Record<TabId, number> = {
    all: profiles.length,
    admin: profiles.filter((p) => p.role === 'admin' && p.active).length,
    accountant: profiles.filter((p) => p.role === 'accountant' && p.active).length,
    trader: profiles.filter((p) => p.role === 'trader' && p.active).length,
    pending: profiles.filter((p) => !p.active).length,
  };

  const filtered = profiles
    .filter((p) => {
      if (activeTab === 'pending') return !p.active;
      if (activeTab === 'admin') return p.role === 'admin' && p.active;
      if (activeTab === 'accountant') return p.role === 'accountant' && p.active;
      if (activeTab === 'trader') return p.role === 'trader' && p.active;
      return true;
    })
    .filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return p.full_name.toLowerCase().includes(q) || p.phone.includes(q);
    });

  const tabLabels: Record<TabId, string> = {
    all: 'همه',
    admin: 'ادمین',
    accountant: 'حسابدار',
    trader: 'تریدر',
    pending: 'در انتظار تأیید',
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>مدیریت کاربران</h1>
        <button
          type="button"
          onClick={() => setShowNewUser(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold hover:opacity-80 transition-opacity"
          style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
        >
          <UserPlus size={16} />
          کاربر جدید
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو بر اساس نام یا موبایل..."
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
            <EmptyState title="هیچ کاربری در انتظار تأیید نیست" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border p-4"
                  style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="mb-2"><RoleBadge role={p.role} /></div>
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
                      رد
                    </button>
                    <button
                      type="button"
                      onClick={() => setApproveTarget(p)}
                      className="flex-1 rounded-lg py-1.5 text-xs font-bold hover:opacity-80"
                      style={{ backgroundColor: 'var(--semantic-success)', color: '#000' }}
                    >
                      تأیید
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
              <EmptyState title="کاربری یافت نشد" />
            ) : (
              <div
                className="overflow-hidden rounded-xl border"
                style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="overflow-x-auto">
                  <table
                    className="w-full text-sm"
                    style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 720, tableLayout: 'fixed' }}
                  >
                    <colgroup>
                      <col style={{ width: '24%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '12%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                        {(['نام', 'موبایل', 'نقش', 'وضعیت', 'ودیعه', 'عملیات'] as const).map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-right text-xs font-medium whitespace-nowrap"
                            style={{ color: 'var(--text-tertiary)', textAlign: 'right' }}
                          >
                            {h}
                          </th>
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
                          <td className="px-4 py-3" style={{ textAlign: 'right' }}>
                            <div className="flex items-center gap-2">
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                                style={{ backgroundColor: 'color-mix(in srgb, var(--accent-gold) 12%, transparent)', color: 'var(--accent-gold)' }}
                              >
                                {initials(p.full_name)}
                              </div>
                              <span className="truncate" style={{ color: 'var(--text-primary)' }}>{p.full_name}</span>
                            </div>
                          </td>
                          <td
                            className="px-4 py-3 tabular-nums truncate"
                            style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace", textAlign: 'right' }}
                          >
                            {toFa(p.phone)}
                          </td>
                          <td className="px-4 py-3" style={{ textAlign: 'right' }}>
                            <RoleBadge role={p.role} />
                          </td>
                          <td className="px-4 py-3" style={{ textAlign: 'right' }}>
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={
                                p.active
                                  ? { backgroundColor: 'color-mix(in srgb, var(--semantic-success) 12%, transparent)', color: 'var(--semantic-success)' }
                                  : { backgroundColor: 'color-mix(in srgb, var(--semantic-danger) 12%, transparent)', color: 'var(--semantic-danger)' }
                              }
                            >
                              {p.active ? 'فعال' : 'غیرفعال'}
                            </span>
                          </td>
                          <td
                            className="px-4 py-3 tabular-nums text-xs"
                            style={{ color: 'var(--text-secondary)', textAlign: 'right' }}
                          >
                            {p.deposit_tether != null ? formatTether(p.deposit_tether) : '—'}
                          </td>
                          <td className="px-4 py-3" style={{ textAlign: 'right' }}>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditTarget(p)}
                                title="ویرایش"
                                className="rounded p-1.5 hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                <Pencil size={14} />
                              </button>
                              {p.role === 'trader' && !p.active && (
                                <button
                                  type="button"
                                  onClick={() => setApproveTarget(p)}
                                  className="rounded px-2 py-1 text-xs font-medium hover:opacity-80"
                                  style={{ backgroundColor: 'var(--semantic-success)', color: '#000' }}
                                >
                                  تأیید
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
        title="رد درخواست"
        description={`آیا می‌خواهید درخواست ${rejectTarget?.full_name ?? ''} را رد کنید؟`}
        confirmLabel="رد"
        variant="danger"
      />

      {showNewUser && (
        <NewUserModal onClose={() => setShowNewUser(false)} onCreated={fetchProfiles} />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          allTraders={profiles.filter((p) => p.role === 'trader')}
          onClose={() => setEditTarget(null)}
          onSaved={fetchProfiles}
        />
      )}
    </div>
  );
}

