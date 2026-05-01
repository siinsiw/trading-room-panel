import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  BookOpen,
  History,
  User,
  BarChart2,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/cn';
import { NotificationBell } from '@/ui/compounds/NotificationBell';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

const adminNav: NavItem[] = [
  { label: 'داشبورد',  to: '/admin/dashboard',  icon: <LayoutDashboard size={20} /> },
  { label: 'بازارها',  to: '/admin/markets',    icon: <TrendingUp size={20} /> },
  { label: 'کاربران',  to: '/admin/users',      icon: <Users size={20} /> },
  { label: 'تصفیه',   to: '/admin/settlement', icon: <FileText size={20} /> },
];

const accountantNav: NavItem[] = [
  { label: 'گزارش',    to: '/accountant/reports',     icon: <BarChart2 size={20} /> },
  { label: 'معاملات',  to: '/accountant/trades',      icon: <TrendingUp size={20} /> },
  { label: 'تصفیه‌ها', to: '/accountant/settlements', icon: <FileText size={20} /> },
  { label: 'کاربران',  to: '/accountant/users',       icon: <Users size={20} /> },
];

const traderNav: NavItem[] = [
  { label: 'دفتر',     to: '/trader/orderbook', icon: <BookOpen size={20} /> },
  { label: 'سفارش‌ها', to: '/trader/orders',    icon: <TrendingUp size={20} /> },
  { label: 'تاریخچه',  to: '/trader/history',   icon: <History size={20} /> },
  { label: 'پروفایل',  to: '/trader/profile',   icon: <User size={20} /> },
];

function navForRole(role: string | null): NavItem[] {
  if (role === 'admin') return adminNav;
  if (role === 'trader') return traderNav;
  if (role === 'accountant') return accountantNav;
  return [];
}

export function MobileShell() {
  const { profile } = useAuthStore();
  const location = useLocation();
  const nav = navForRole(profile?.role ?? null);

  const pageTitle = document.title || 'اتاق معاملات';

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
      dir="rtl"
    >
      {/* TopBar */}
      <header
        className="flex shrink-0 items-center justify-between border-b px-4"
        style={{
          height: 48,
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <span
          className="text-sm font-semibold truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {pageTitle}
        </span>
        <NotificationBell />
      </header>

      {/* Main content */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ padding: 16, paddingBottom: 96 }}
      >
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 flex items-center justify-around border-t"
        style={{
          height: 64,
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 50,
        }}
      >
        {nav.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1',
                isActive ? 'nav-active' : '',
              )}
            >
              <span
                style={{
                  color: isActive ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                }}
              >
                {item.icon}
              </span>
              <span
                className="text-[10px] font-medium"
                style={{
                  color: isActive ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                }}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
