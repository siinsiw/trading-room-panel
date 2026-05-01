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
];
const traderNav:     NavItem[] = [
  { label: 'دفتر',    to: '/trader/orderbook' },
  { label: 'سفارش‌ها', to: '/trader/orders'    },
  { label: 'تاریخچه', to: '/trader/history'   },
  { label: 'پروفایل', to: '/trader/profile'   },
];
const accountantNav: NavItem[] = [
  { label: 'گزارش',    to: '/accountant/reports'     },
  { label: 'معاملات',  to: '/accountant/trades'      },
  { label: 'تصفیه‌ها', to: '/accountant/settlements' },
  { label: 'کاربران',  to: '/accountant/users'       },
];

function navForRole(role: string | null): NavItem[] {
  if (role === 'admin')      return adminNav;
  if (role === 'trader')     return traderNav;
  if (role === 'accountant') return accountantNav;
  return [];
}

export function MobileShell() {
  const { currentUser } = useAuthStore();
  const { tick } = useTimeStore();
  const navigate = useNavigate();
  const nav = navForRole(currentUser?.role ?? null);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}>

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 48, backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
        <button onClick={() => navigate(-1)}
          className="text-sm icon-chevron icon-arrow"
          style={{ color: 'var(--text-secondary)' }}>
          ‹
        </button>
        <span className="tabular text-sm" style={{ color: 'var(--text-secondary)' }}>
          {tick ? toFa(tick.tehranTime) : '––:––:––'}
        </span>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto p-4" style={{ paddingBottom: '80px' }}>
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 flex items-center justify-around"
        style={{
          height: 64,
          backgroundColor: 'var(--bg-elevated)',
          borderTop: '1px solid var(--border-subtle)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
        {nav.map(item => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) => cn(
              'relative flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px]',
              isActive ? 'nav-active' : ''
            )}>
            {({ isActive }) => (
              <span className="text-[11px]"
                style={{ color: isActive ? 'var(--accent-gold)' : 'var(--text-tertiary)' }}>
                {item.label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
