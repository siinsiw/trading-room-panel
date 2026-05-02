import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { parseError } from '@/lib/errors';
import type { Profile } from '@/lib/database.types';
import { X } from 'lucide-react';

interface MemberGroup {
  id: string;
  name: string;
  commission_per_unit: number;
}

interface Props {
  user: Profile;
  allTraders: Profile[];      // برای انتخاب «معرف»
  onClose: () => void;
  onSaved: () => void;
}

type FieldGroup = {
  title: string;
  fields: { label: string; key: string; render: () => React.ReactNode }[];
};

export function EditUserModal({ user, allTraders, onClose, onSaved }: Props) {
  const [fullName,    setFullName]    = useState(user.full_name);
  const [phone,       setPhone]       = useState(user.phone);
  const [telegramId,  setTelegramId]  = useState(user.telegram_id ?? '');
  const [role,        setRole]        = useState<'admin' | 'accountant' | 'trader'>(user.role);
  const [active,      setActive]      = useState(user.active);
  const [deposit,     setDeposit]     = useState(user.deposit_tether?.toString() ?? '');
  const [perUnit,     setPerUnit]     = useState(user.per_unit_deposit?.toString() ?? '');
  const [commission,  setCommission]  = useState(user.commission_per_unit?.toString() ?? '');
  const [maxUnits,    setMaxUnits]    = useState(user.max_open_units?.toString() ?? '');
  const [groupId,     setGroupId]     = useState(user.member_group_id ?? '');
  const [referrerId,  setReferrerId]  = useState(user.referrer_id ?? '');
  const [bonusPct,    setBonusPct]    = useState(user.referral_bonus_pct?.toString() ?? '');
  const [groups,      setGroups]      = useState<MemberGroup[]>([]);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.from('member_groups').select('*').order('name');
        setGroups((data as MemberGroup[]) ?? []);
      } catch {
        // ignore — جدول ممکن است هنوز migration نگرفته باشد
      }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        full_name:           fullName,
        phone,
        telegram_id:         telegramId || null,
        role,
        active,
        deposit_tether:      deposit    !== '' ? parseFloat(deposit)    : null,
        per_unit_deposit:    perUnit    !== '' ? parseFloat(perUnit)    : null,
        commission_per_unit: commission !== '' ? parseInt(commission, 10) : null,
        max_open_units:      maxUnits   !== '' ? parseInt(maxUnits, 10)   : null,
        member_group_id:     groupId    || null,
        referrer_id:         referrerId || null,
        referral_bonus_pct:  bonusPct   !== '' ? parseFloat(bonusPct)   : null,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('profiles') as any).update(updates).eq('id', user.id);
      if (error) throw error;

      toast.success(`${fullName} ذخیره شد`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none tabular-nums';
  const inputStyle = { borderColor: 'var(--border-strong)', color: 'var(--text-primary)' } as const;
  const labelCls = 'mb-1 block text-xs';
  const labelStyle = { color: 'var(--text-secondary)' } as const;

  const sections: FieldGroup[] = [
    {
      title: 'مشخصات',
      fields: [
        { label: 'نام و نام خانوادگی', key: 'fullName', render: () => (
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} style={inputStyle} />
        ) },
        { label: 'موبایل', key: 'phone', render: () => (
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09…" className={inputCls} style={inputStyle} />
        ) },
        { label: 'آیدی تلگرام', key: 'tg', render: () => (
          <input value={telegramId} onChange={(e) => setTelegramId(e.target.value)} placeholder="@username یا 123456789" className={inputCls} style={inputStyle} />
        ) },
        { label: 'نقش', key: 'role', render: () => (
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={inputCls} style={{ ...inputStyle, backgroundColor: 'var(--bg-overlay)' }}>
            <option value="trader">تریدر</option>
            <option value="accountant">حسابدار</option>
            <option value="admin">ادمین</option>
          </select>
        ) },
        { label: 'وضعیت', key: 'active', render: () => (
          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={() => setActive(true)}
              className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
              style={active ? { backgroundColor: 'var(--semantic-success)', color: '#000', borderColor: 'var(--semantic-success)' } : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
              فعال
            </button>
            <button type="button" onClick={() => setActive(false)}
              className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
              style={!active ? { backgroundColor: 'var(--semantic-danger)', color: '#fff', borderColor: 'var(--semantic-danger)' } : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
              غیرفعال
            </button>
          </div>
        ) },
      ],
    },
    {
      title: 'پارامترهای معاملاتی',
      fields: [
        { label: 'ودیعه (USDT)', key: 'deposit', render: () => (
          <input type="number" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="مثلاً 1000" className={inputCls} style={inputStyle} />
        ) },
        { label: 'بیعانه هر واحد (USDT)', key: 'perUnit', render: () => (
          <input type="number" inputMode="decimal" value={perUnit} onChange={(e) => setPerUnit(e.target.value)} placeholder="مثلاً 500" className={inputCls} style={inputStyle} />
        ) },
        { label: 'کمیسیون هر واحد (تومان)', key: 'commission', render: () => (
          <input type="number" inputMode="numeric" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="مثلاً 50000" className={inputCls} style={inputStyle} />
        ) },
        { label: 'سقف موقعیت باز (واحد)', key: 'maxUnits', render: () => (
          <input type="number" inputMode="numeric" value={maxUnits} onChange={(e) => setMaxUnits(e.target.value)} placeholder="خالی = بدون محدودیت" className={inputCls} style={inputStyle} />
        ) },
      ],
    },
    {
      title: 'گروه و رفرال',
      fields: [
        { label: 'گروه کاربری', key: 'group', render: () => (
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls} style={{ ...inputStyle, backgroundColor: 'var(--bg-overlay)' }}>
            <option value="">— بدون گروه —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        ) },
        { label: 'معرف', key: 'referrer', render: () => (
          <select value={referrerId} onChange={(e) => setReferrerId(e.target.value)} className={inputCls} style={{ ...inputStyle, backgroundColor: 'var(--bg-overlay)' }}>
            <option value="">— بدون معرف —</option>
            {allTraders.filter((t) => t.id !== user.id).map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        ) },
        { label: 'درصد پاداش از زیرمجموعه', key: 'bonus', render: () => (
          <input type="number" inputMode="decimal" value={bonusPct} onChange={(e) => setBonusPct(e.target.value)} placeholder="مثلاً 10" className={inputCls} style={inputStyle} />
        ) },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl my-6"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            ویرایش کاربر — <span style={{ color: 'var(--accent-gold)' }}>{user.full_name}</span>
          </h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-white/5" style={{ color: 'var(--text-tertiary)' }}>
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-tertiary)' }}>
                {section.title}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.fields.map((f) => (
                  <div key={f.key}>
                    <label className={labelCls} style={labelStyle}>{f.label}</label>
                    {f.render()}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* footer */}
        <div className="flex gap-3 px-5 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg py-2 text-sm font-medium hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
          >
            {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
          </button>
        </div>
      </div>
    </div>
  );
}
