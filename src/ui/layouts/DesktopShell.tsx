import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  BookOpen,
  History,
  User,
  BarChart2,
  FileText,
  LogOut,
  Lock,
  Unlock,
  PlusCircle,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useTimeStore } from '@/stores/time.store';
import { toFa } from '@/lib/persian';
import { cn } from '@/lib/cn';
import { NotificationBell } from '@/ui/compounds/NotificationBell';
import { Logo } from '@/ui/compounds/Logo';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

const adminNav: NavItem[] = [
  { label: 'داشبورد',         to: '/admin/dashboard',     icon: <LayoutDashboard size={16} /> },
  { label: 'بازارها / مزنه',  to: '/admin/markets',       icon: <TrendingUp size={16} /> },
  { label: 'کاربران',         to: '/admin/users',         icon: <Users size={16} /> },
  { label: 'تصفیه',          to: '/admin/settlement',    icon: <FileText size={16} /> },
  { label: 'لیست معاملات',    to: '/admin/trades',        icon: <BarChart2 size={16} /> },
  { label: 'ثبت دستی معامله', to: '/admin/manual-trade',  icon: <PlusCircle size={16} /> },
  { label: 'پروفایل من',      to: '/admin/profile',       icon: <User size={16} /> },
];

const accountantNav: NavItem[] = [
  { label: 'گزارش',     to: '/accountant/reports',     icon: <BarChart2 size={16} /> },
  { label: 'معاملات',   to: '/accountant/trades',      icon: <TrendingUp size={16} /> },
  { label: 'تصفیه‌ها',  to: '/accountant/settlements', icon: <FileText size={16} /> },
  { label: 'کاربران',   to: '/accountant/users',       icon: <Users size={16} /> },
  { label: 'پروفایل من', to: '/accountant/profile',    icon: <User size={16} /> },
];

const traderNav: NavItem[] = [
  { label: 'دفتر سفارش', to: '/trader/orderbook', icon: <BookOpen size={16} /> },
  { label: 'سفارش‌ها',   to: '/trader/orders',    icon: <TrendingUp size={16} /> },
  { label: 'تاریخچه',    to: '/trader/history',   icon: <History size={16} /> },
  { label: 'حساب‌من',    to: '/trader/account',   icon: <User size={16} /> },
];

function navForRole(role: string | null): NavItem[] {
  if (role === 'admin') return adminNav;
  if (role === 'trader') return traderNav;
  if (role === 'accountant') return accountantNav;
  return [];
}

function roleFa(role: string | null): string {
  if (role === 'admin') return 'ادمین';
  if (role === 'accountant') return 'حسابدار';
  if (role === 'trader') return 'تریدر';
  return '—';
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
}

export function DesktopShell() {
  const { profile, signOut } = useAuthStore();
  const { tick, isLocked, lockCountdown } = useTimeStore();
  const nav = navForRole(profile?.role ?? null);

  // Auto-collapse sidebar below 1024px (tablet range), allow user toggle.
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const lockMins = Math.floor(lockCountdown / 60);
  const lockSecs = lockCountdown % 60;
  const lockLabel = `${String(lockMins).padStart(2, '0')}:${String(lockSecs).padStart(2, '0')}`;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
      dir="rtl"
    >
      {/* Sidebar — right side in RTL — collapses to icon-only at <1024px */}
      <aside
        className="flex shrink-0 flex-col border-l overflow-y-auto transition-[width] duration-200"
        style={{
          width: collapsed ? 64 : 240,
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        {/* Brand + collapse toggle */}
        <div
          className="flex items-center gap-2 px-3 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {/* لوگو */}
          <div
            className={cn('overflow-hidden rounded-lg shrink-0', collapsed ? 'mx-auto' : '')}
            style={{ backgroundColor: 'var(--bg-overlay)' }}
          >
            <Logo size={collapsed ? 32 : 36} />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p
                className="text-[10px] font-medium tracking-widest uppercase truncate"
                style={{ color: 'var(--text-tertiary)' }}
              >
                اتاق معاملات
              </p>
              <p
                className="mt-0.5 text-sm font-bold truncate"
                style={{ color: 'var(--accent-gold)' }}
              >
                شمس‌العماره
              </p>
            </div>
          )}

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="جمع کردن منو"
              className="rounded p-1.5 hover:bg-white/5 transition-colors shrink-0"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <PanelRightClose size={16} />
            </button>
          )}
        </div>

        {/* دکمه‌ی باز کردن وقتی collapsed است */}
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="باز کردن منو"
            className="mx-auto mt-1 mb-1 rounded p-1.5 hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <PanelRightOpen size={16} />
          </button>
        )}

        {/* User info */}
        {profile && (
          <div
            className="flex items-center gap-3 px-3 py-4 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold mx-auto"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent-gold) 20%, transparent)',
                color: 'var(--accent-gold)',
              }}
              title={collapsed ? `${profile.full_name} (${roleFa(profile.role)})` : undefined}
            >
              {initials(profile.full_name)}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {profile.full_name}
                </p>
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium mt-0.5"
                  style={{
                    backgroundColor: 'var(--bg-overlay)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {roleFa(profile.role)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className={cn('flex-1 py-3 space-y-0.5', collapsed ? 'px-2' : 'px-3')}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-lg text-sm font-medium transition-colors duration-150',
                  collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5',
                  isActive ? '' : 'hover:bg-white/5',
                )
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      color: 'var(--accent-gold)',
                      backgroundColor: 'var(--bg-overlay)',
                    }
                  : { color: 'var(--text-secondary)' }
              }
            >
              {item.icon}
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div
          className={cn('border-t shrink-0', collapsed ? 'p-2' : 'p-3')}
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={() => void signOut()}
            title={collapsed ? 'خروج از حساب' : undefined}
            className={cn(
              'flex w-full items-center rounded-lg text-sm font-medium transition-colors hover:bg-white/5',
              collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5',
            )}
            style={{ color: 'var(--text-secondary)' }}
          >
            <LogOut size={16} />
            {!collapsed && 'خروج از حساب'}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* TopBar */}
        <header
          className="flex shrink-0 items-center justify-between gap-4 border-b px-4 lg:px-8"
          style={{
            height: 64,
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          {/* Left side: clock + lock */}
          <div className="flex items-center gap-4">
            {/* Clock */}
            <span
              className="tabular text-lg font-semibold"
              style={{
                color: 'var(--text-primary)',
                fontFamily: "'Geist Mono', monospace",
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {tick ? toFa(tick.tehranTime) : '——:——:——'}
            </span>

            {/* Lock badge */}
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={
                isLocked
                  ? {
                      backgroundColor: 'color-mix(in srgb, var(--semantic-danger) 15%, transparent)',
                      color: 'var(--semantic-danger)',
                    }
                  : {
                      backgroundColor: 'color-mix(in srgb, var(--semantic-success) 15%, transparent)',
                      color: 'var(--semantic-success)',
                    }
              }
            >
              {isLocked ? <Lock size={11} /> : <Unlock size={11} />}
              {isLocked ? 'قفل شده' : 'باز'}
            </span>

            {/* Countdown to lock */}
            {!isLocked && lockCountdown > 0 && (
              <span
                className="text-xs"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <span
                  className="tabular font-medium"
                  style={{
                    color: 'var(--accent-gold)',
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {toFa(lockLabel)}
                </span>
                {' '}تا قفل
              </span>
            )}
          </div>

          {/* Right side: notification bell */}
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
