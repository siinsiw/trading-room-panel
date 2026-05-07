import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { parseError } from '@/lib/errors';
import { toFa } from '@/lib/persian';
import { X, AlertTriangle } from 'lucide-react';

interface MemberGroup { id: string; name: string }

interface Props {
  userIds: string[];
  onClose: () => void;
  onSaved: () => void;
}

// ─── ویرایش گروهی همهٔ فیلدها ─────────────────────────────────
// هر فیلد دو حالت دارد: «بدون تغییر» (پیش‌فرض) یا «اعمال این مقدار به همه».
// از RPC bulk_update_traders استفاده می‌کند که فقط مقادیر non-null را اعمال می‌کند.
export function BulkUpdateModal({ userIds, onClose, onSaved }: Props) {
  // toggles — کدام فیلد شامل تغییر است
  const [t, setT] = useState({
    perUnit: false,
    commission: false,
    maxUnits: false,
    memberGroup: false,
    referralBonus: false,
    active: false,
    isCredit: false,
    creditUnits: false,
    marginDisabled: false,
  });

  // values
  const [perUnit, setPerUnit]              = useState('');
  const [commission, setCommission]        = useState('');
  const [maxUnits, setMaxUnits]            = useState('');
  const [memberGroupId, setMemberGroupId]  = useState('');
  const [referralBonus, setReferralBonus]  = useState('');
  const [active, setActive]                = useState(true);
  const [isCredit, setIsCredit]            = useState(false);
  const [creditUnits, setCreditUnits]      = useState('');
  const [marginDisabled, setMarginDisabled] = useState(false);

  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.from('member_groups').select('id,name').order('name');
        setGroups((data as MemberGroup[]) ?? []);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function handleApply() {
    if (userIds.length === 0) { toast.error('هیچ کاربری انتخاب نشده'); return; }
    const anyChange = Object.values(t).some(Boolean);
    if (!anyChange) { toast.error('حداقل یک فیلد را برای تغییر انتخاب کنید'); return; }

    setSaving(true);
    try {
      const args: Record<string, unknown> = { p_user_ids: userIds };
      if (t.perUnit)         args.p_per_unit_deposit       = parseFloat(perUnit);
      if (t.commission)      args.p_commission_per_unit    = parseInt(commission, 10);
      if (t.maxUnits)        args.p_max_open_units         = maxUnits === '' ? null : parseInt(maxUnits, 10);
      if (t.memberGroup)     args.p_member_group_id        = memberGroupId || null;
      if (t.referralBonus)   args.p_referral_bonus_pct     = parseFloat(referralBonus);
      if (t.active)          args.p_active                 = active;
      if (t.isCredit)        args.p_is_credit_user         = isCredit;
      if (t.creditUnits)     args.p_credit_units           = creditUnits === '' ? null : parseInt(creditUnits, 10);
      if (t.marginDisabled)  args.p_margin_call_disabled   = marginDisabled;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('bulk_update_traders', args);
      if (error) throw error;
      const count = Number(data ?? userIds.length);
      toast.success(`${toFa(count)} کاربر به‌روز شد`);
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

  function FieldRow({
    enabled, onToggle, label, children,
  }: { enabled: boolean; onToggle: () => void; label: string; children: React.ReactNode }) {
    return (
      <div
        className="rounded-lg border p-3"
        style={{
          borderColor: enabled ? 'var(--accent-gold)' : 'var(--border-subtle)',
          backgroundColor: enabled ? 'color-mix(in srgb, var(--accent-gold) 6%, transparent)' : 'transparent',
        }}
      >
        <label className="mb-2 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
            style={{ accentColor: 'var(--accent-gold)' }}
          />
          <span className="text-xs font-medium" style={{ color: enabled ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
            {label}
          </span>
        </label>
        <div style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}>
          {children}
        </div>
      </div>
    );
  }

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
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              ویرایش گروهی <span style={{ color: 'var(--accent-gold)' }}>{toFa(userIds.length)} کاربر</span>
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              فقط فیلدهایی که تیک می‌زنید روی همهٔ کاربران انتخاب‌شده اعمال می‌شوند.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-white/5" style={{ color: 'var(--text-tertiary)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div
            className="flex items-start gap-2 rounded-md border-r-4 px-3 py-2 text-xs"
            style={{
              borderRightColor: 'var(--semantic-warn)',
              backgroundColor: 'color-mix(in srgb, var(--semantic-warn) 8%, transparent)',
              color: 'var(--semantic-warn)',
            }}
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p>
              این عملیات در audit log ثبت می‌شود. ودیعه (deposit_tether) به‌خاطر یکتا بودنش گروهی قابل تغییر نیست — از فرم ویرایش تک‌نفره استفاده کنید.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow enabled={t.perUnit}      onToggle={() => setT({ ...t, perUnit: !t.perUnit })}      label="بیعانه هر واحد (USDT)">
              <input type="number" inputMode="decimal" value={perUnit}    onChange={(e) => setPerUnit(e.target.value)}    placeholder="مثلاً 200" className={inputCls} style={inputStyle} />
            </FieldRow>

            <FieldRow enabled={t.commission}   onToggle={() => setT({ ...t, commission: !t.commission })} label="کمیسیون هر واحد (تومان)">
              <input type="number" inputMode="numeric" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="مثلاً 50000" className={inputCls} style={inputStyle} />
            </FieldRow>

            <FieldRow enabled={t.maxUnits}     onToggle={() => setT({ ...t, maxUnits: !t.maxUnits })}    label="سقف موقعیت باز (واحد)">
              <input type="number" inputMode="numeric" value={maxUnits} onChange={(e) => setMaxUnits(e.target.value)} placeholder="خالی = حذف محدودیت" className={inputCls} style={inputStyle} />
            </FieldRow>

            <FieldRow enabled={t.memberGroup}  onToggle={() => setT({ ...t, memberGroup: !t.memberGroup })} label="گروه کاربری">
              <select value={memberGroupId} onChange={(e) => setMemberGroupId(e.target.value)} className={inputCls} style={{ ...inputStyle, backgroundColor: 'var(--bg-overlay)' }}>
                <option value="">— بدون گروه —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </FieldRow>

            <FieldRow enabled={t.referralBonus} onToggle={() => setT({ ...t, referralBonus: !t.referralBonus })} label="درصد پاداش رفرال">
              <input type="number" inputMode="decimal" value={referralBonus} onChange={(e) => setReferralBonus(e.target.value)} placeholder="مثلاً 10" className={inputCls} style={inputStyle} />
            </FieldRow>

            <FieldRow enabled={t.active}       onToggle={() => setT({ ...t, active: !t.active })}        label="وضعیت فعال/غیرفعال">
              <div className="flex gap-2">
                <button type="button" onClick={() => setActive(true)}  className="flex-1 rounded-md border py-1.5 text-xs"
                  style={active ? { backgroundColor: 'var(--semantic-success)', color: '#000', borderColor: 'var(--semantic-success)' } : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
                  فعال
                </button>
                <button type="button" onClick={() => setActive(false)} className="flex-1 rounded-md border py-1.5 text-xs"
                  style={!active ? { backgroundColor: 'var(--semantic-danger)', color: '#fff', borderColor: 'var(--semantic-danger)' } : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
                  غیرفعال
                </button>
              </div>
            </FieldRow>

            <FieldRow enabled={t.isCredit}     onToggle={() => setT({ ...t, isCredit: !t.isCredit })}    label="نوع حساب">
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsCredit(false)} className="flex-1 rounded-md border py-1.5 text-xs"
                  style={!isCredit ? { backgroundColor: 'var(--accent-gold)', color: '#000', borderColor: 'var(--accent-gold)' } : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
                  ودیعه‌ای
                </button>
                <button type="button" onClick={() => setIsCredit(true)} className="flex-1 rounded-md border py-1.5 text-xs"
                  style={isCredit ? { backgroundColor: 'var(--accent-gold)', color: '#000', borderColor: 'var(--accent-gold)' } : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
                  اعتباری
                </button>
              </div>
            </FieldRow>

            <FieldRow enabled={t.creditUnits}  onToggle={() => setT({ ...t, creditUnits: !t.creditUnits })} label="تعداد واحد اعتبار">
              <input type="number" inputMode="numeric" value={creditUnits} onChange={(e) => setCreditUnits(e.target.value)} placeholder="مثلاً 5" className={inputCls} style={inputStyle} />
            </FieldRow>

            <FieldRow enabled={t.marginDisabled} onToggle={() => setT({ ...t, marginDisabled: !t.marginDisabled })} label="حراج خودکار (کال مارجین)">
              <div className="flex gap-2">
                <button type="button" onClick={() => setMarginDisabled(false)} className="flex-1 rounded-md border py-1.5 text-xs"
                  style={!marginDisabled ? { backgroundColor: 'var(--semantic-success)', color: '#000', borderColor: 'var(--semantic-success)' } : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
                  فعال
                </button>
                <button type="button" onClick={() => setMarginDisabled(true)} className="flex-1 rounded-md border py-1.5 text-xs"
                  style={marginDisabled ? { backgroundColor: 'var(--semantic-warn)', color: '#000', borderColor: 'var(--semantic-warn)' } : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
                  غیرفعال
                </button>
              </div>
            </FieldRow>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-40"
            style={{ color: 'var(--text-secondary)' }}
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={saving}
            className="flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
          >
            {saving ? 'در حال اعمال…' : `اعمال روی ${toFa(userIds.length)} کاربر`}
          </button>
        </div>
      </div>
    </div>
  );
}
