import { useAuthStore } from '@/stores/auth.store';
import { formatTetherAmount } from '@/lib/format';
import { toFa } from '@/lib/persian';

export default function TraderProfile() {
  const { currentUser } = useAuthStore();

  if (!currentUser) return null;

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>پروفایل</h1>

      <div className="p-5 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{currentUser.fullName}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{toFa(currentUser.phone)}</p>
      </div>

      <div className="p-5 rounded-xl space-y-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>وضعیت حساب</p>
        <div className="flex justify-between">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>ودیعه</span>
          <span className="tabular text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {currentUser.depositTether !== undefined ? formatTetherAmount(currentUser.depositTether) : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>بیعانه هر واحد</span>
          <span className="tabular text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {currentUser.perUnitDeposit !== undefined ? formatTetherAmount(currentUser.perUnitDeposit) : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>کمیسیون هر واحد</span>
          <span className="tabular text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {currentUser.commissionPerUnit !== undefined
              ? toFa(currentUser.commissionPerUnit.toLocaleString('en-US')) + ' تومان'
              : '—'}
          </span>
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        مارجین gauge و پوزیشن‌های باز در مرحله بعد سیم‌کشی می‌شود
      </p>
    </div>
  );
}
