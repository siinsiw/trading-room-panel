import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { parseError } from '@/lib/errors';
import { toFa, formatTether } from '@/lib/persian';
import { Lock, User as UserIcon, Save } from 'lucide-react';

/**
 * صفحه‌ی پروفایل کاربر (همه‌ی نقش‌ها).
 * - فیلدهای ایمن: نام، موبایل، آیدی تلگرام → خود کاربر می‌تواند عوض کند (RPC update_own_profile)
 * - رمز عبور: همه می‌توانند رمز خود را عوض کنند
 * - فیلدهای حساس (نقش، فعال، ودیعه، بیعانه، کمیسیون): فقط نمایشی — برای تغییر باید ادمین در «مدیریت کاربران» اقدام کند
 */
export default function MyProfilePage() {
  const { profile, loadProfile } = useAuthStore();
  const [fullName,   setFullName]   = useState('');
  const [phone,      setPhone]      = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwd1,    setPwd1]    = useState('');
  const [pwd2,    setPwd2]    = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone);
      setTelegramId(profile.telegram_id ?? '');
    }
  }, [profile]);

  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
        در حال بارگذاری…
      </div>
    );
  }

  const dirty =
    fullName !== profile.full_name ||
    phone !== profile.phone ||
    telegramId !== (profile.telegram_id ?? '');

  async function saveProfile() {
    if (!dirty) return;
    setSavingProfile(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('update_own_profile', {
        p_full_name:   fullName,
        p_phone:       phone,
        p_telegram_id: telegramId || null,
      });
      await loadProfile(profile!.id);
      toast.success('پروفایل به‌روز شد');
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (pwd1.length < 6) { toast.error('رمز جدید حداقل ۶ کاراکتر باشد'); return; }
    if (pwd1 !== pwd2)   { toast.error('رمز جدید با تکرارش یکی نیست'); return; }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd1 });
      if (error) throw error;
      setPwd1(''); setPwd2('');
      toast.success('رمز عبور عوض شد');
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setSavingPwd(false);
    }
  }

  const inputCls = 'w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none';
  const inputStyle = { borderColor: 'var(--border-strong)', color: 'var(--text-primary)' } as const;

  const roleFa = profile.role === 'admin' ? 'ادمین' : profile.role === 'accountant' ? 'حسابدار' : 'تریدر';

  return (
    <div className="space-y-6 max-w-3xl" dir="rtl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>پروفایل من</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          نام، موبایل، آیدی تلگرام و رمز عبور را خودتان می‌توانید تغییر دهید.
          نقش، وضعیت فعال و پارامترهای مالی فقط با تأیید ادمین قابل تغییر است.
        </p>
      </div>

      {/* فیلدهای ایمن */}
      <div className="rounded-xl border p-5"
           style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-4">
          <UserIcon size={16} style={{ color: 'var(--accent-gold)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>اطلاعات حساب</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>نام و نام خانوادگی</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>موبایل</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09…" className={inputCls} style={inputStyle} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>آیدی تلگرام</label>
            <input value={telegramId} onChange={(e) => setTelegramId(e.target.value)} placeholder="@username یا 123456789" className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={!dirty || savingProfile}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
          >
            <Save size={14} />
            {savingProfile ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
          </button>
        </div>
      </div>

      {/* تغییر رمز */}
      <div className="rounded-xl border p-5"
           style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} style={{ color: 'var(--accent-gold)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>تغییر رمز عبور</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>رمز جدید</label>
            <input type="password" value={pwd1} onChange={(e) => setPwd1(e.target.value)} dir="ltr" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>تکرار رمز جدید</label>
            <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} dir="ltr" className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void changePassword()}
            disabled={!pwd1 || !pwd2 || savingPwd}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
          >
            <Lock size={14} />
            {savingPwd ? 'در حال ذخیره…' : 'ذخیره رمز جدید'}
          </button>
        </div>
      </div>

      {/* فیلدهای فقط‌خواندنی — برای شفافیت */}
      <div className="rounded-xl border p-5"
           style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          اطلاعات حساب — فقط نمایشی
        </h2>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <span style={{ color: 'var(--text-tertiary)' }}>نقش</span>
          <span style={{ color: 'var(--text-primary)' }}>{roleFa}</span>

          <span style={{ color: 'var(--text-tertiary)' }}>وضعیت</span>
          <span style={{ color: profile.active ? 'var(--semantic-success)' : 'var(--semantic-danger)' }}>
            {profile.active ? 'فعال' : 'غیرفعال'}
          </span>

          {profile.role === 'trader' && (
            <>
              <span style={{ color: 'var(--text-tertiary)' }}>ودیعه</span>
              <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {profile.deposit_tether != null ? formatTether(profile.deposit_tether) : '—'}
              </span>

              <span style={{ color: 'var(--text-tertiary)' }}>بیعانه هر واحد</span>
              <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {profile.per_unit_deposit != null ? formatTether(profile.per_unit_deposit) : '—'}
              </span>

              <span style={{ color: 'var(--text-tertiary)' }}>کمیسیون هر واحد</span>
              <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {profile.commission_per_unit != null ? toFa(profile.commission_per_unit.toLocaleString('en-US')) + ' تومان' : '—'}
              </span>
            </>
          )}
        </div>
        <p className="mt-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          برای تغییر این مقادیر، با ادمین تماس بگیرید.
        </p>
      </div>
    </div>
  );
}
