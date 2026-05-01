import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { UsersLocalStorage } from '@/data/adapters/localstorage/users.ls';
import { resetToSeedData, isSeeded } from '@/data/seed/reset';
import type { User, Role } from '@/domain/types';

const repo = new UsersLocalStorage();

const ROLES: { role: Role; label: string; desc: string }[] = [
  { role: 'admin',      label: 'ادمین',      desc: 'مدیریت بازار، تصفیه، کاربران' },
  { role: 'accountant', label: 'حسابدار',     desc: 'گزارش، تصفیه‌ها، مشاهده معاملات' },
  { role: 'trader',     label: 'تریدر',       desc: 'ثبت لفظ، دفتر سفارش، پروفایل' },
];

export default function RoleSelect() {
  const navigate = useNavigate();
  const { setCurrentUser } = useAuthStore();
  const [step, setStep] = useState<'role' | 'trader'>('role');
  const [traders, setTraders] = useState<User[]>([]);

  async function handleRoleSelect(role: Role) {
    if (role === 'trader') {
      const all = await repo.getByRole('trader');
      setTraders(all);
      setStep('trader');
      return;
    }
    // Pick first user of that role
    const users = await repo.getByRole(role);
    if (users[0]) {
      setCurrentUser(users[0]);
      navigate(role === 'admin' ? '/admin/dashboard' : '/accountant/reports');
    }
  }

  function handleTraderSelect(trader: User) {
    setCurrentUser(trader);
    navigate('/trader/orderbook');
  }

  function handleReset() {
    if (confirm('همه داده‌ها پاک و دوباره بارگذاری می‌شوند. ادامه؟')) {
      resetToSeedData();
      window.location.reload();
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6"
      style={{ backgroundColor: 'var(--bg-base)' }}>

      <div className="text-center">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--accent-gold)' }}>اتاق معاملات</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>انتخاب نقش برای ورود</p>
      </div>

      {step === 'role' && (
        <div className="flex flex-col gap-4 w-full max-w-sm">
          {ROLES.map(({ role, label, desc }) => (
            <button key={role} onClick={() => handleRoleSelect(role)}
              className="text-right p-5 rounded-xl border transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
              <div className="font-bold text-lg">{label}</div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{desc}</div>
            </button>
          ))}

          {isSeeded() && (
            <button onClick={handleReset}
              className="mt-4 text-sm text-center py-2 rounded-lg"
              style={{ color: 'var(--semantic-danger)', backgroundColor: 'var(--bg-overlay)' }}>
              حذف کامل و شروع از صفر
            </button>
          )}
        </div>
      )}

      {step === 'trader' && (
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>کدام تریدر؟</p>
          {traders.map(t => (
            <button key={t.id} onClick={() => handleTraderSelect(t)}
              className="text-right p-4 rounded-xl border transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
              {t.fullName}
              <span className="text-xs mr-2" style={{ color: 'var(--text-tertiary)' }}>{t.phone}</span>
            </button>
          ))}
          <button onClick={() => setStep('role')}
            className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            ← بازگشت
          </button>
        </div>
      )}
    </div>
  );
}
