import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useTimeStore } from '@/stores/time.store';
import { toFa } from '@/lib/persian';
import { cn } from '@/lib/cn';

interface NavItem { label: string; to: string; }

const adminNav:      NavItem[] = [
  { label: 'داشبورد', to: '/admin/dashboard' },
  { label: 'بازارها',  to: '/admin/markets'   },
  { label: 'کاربران',  to: '/admin/users'      },
  { label: 'تصفیه',   to: '/admin/settlement' },
  { label: 'معاملات',  to: '/admin/trades'    },
];
const traderNav:     NavItem[] = [
  { label: 'دفتر سفارش', to: '/trader/orderbook' },
  { label: 'سفارش‌ها',   to: '/trader/orders'    },
  { label: 'تاریخچه',    to: '/trader/history'   },
  { label: 'پروفایل',    to: '/trader/profile'   },
];
const accountantNav: NavItem[] = [
  { label: 'گزارش',     to: '/accountant/reports'     },
  { label: 'معاملات',   to: '/accountant/trades'      },
  { label: 'تصفیه‌ها',  to: '/accountant/settlements' },
  { label: 'کاربران',   to: '/accountant/users'       },
];

function navForRole(role: string | null): NavItem[] {
  if (role === 'admin')      return adminNav;
  if (role === 'trader')     return traderNav;
  if (role === 'accountant') return accountantNav;
  return [];
}

export function DesktopShell() {
  const { currentUser, clearSession } = useAuthStore();
  const { tick, isLocked } = useTimeStore();
  const navigate = useNavigate();
  const nav = navForRole(currentUser?.role ?? null);

  function handleSwitchRole() {
    clearSession();
    navigate('/');
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Sidebar — RTL: right side */}
      <aside className="flex flex-col w-60 border-l shrink-0 overflow-y-auto"
        style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>

        <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>اتاق معاملات</p>
          <p className="font-bold mt-0.5" style={{ color: 'var(--accent-gold)' }}>
            {currentUser?.fullName ?? '—'}
          </p>
          <span className="text-xs px-2 py-0.5 rounded mt-1 inline-block"
            style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}>
            {currentUser?.role === 'admin' ? 'ادمین' : currentUser?.role === 'accountant' ? 'حسابدار' : 'تریدر'}
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(item => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => cn(
                'flex items-center px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'font-medium'
                  : 'hover:opacity-80'
              )}
              style={({ isActive }) => isActive
                ? { color: 'var(--accent-gold)', backgroundColor: 'var(--bg-overlay)' }
                : { color: 'var(--text-secondary)' }
              }>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <button onClick={handleSwitchRole}
            className="w-full text-sm text-center py-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-overlay)' }}>
            تغییر نقش
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-8 border-b shrink-0"
          style={{ height: 64, borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
          <div className="flex items-center gap-3">
            <span className={cn('w-2 h-2 rounded-full', isLocked ? 'bg-red-500' : 'bg-green-500')} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {isLocked ? 'قفل شده' : 'باز'}
            </span>
          </div>
          <div className="tabular text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
            {tick ? toFa(tick.tehranTime) : '––:––:––'}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
