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
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useTimeStore } from '@/stores/time.store';
import { toFa } from '@/lib/persian';
import { cn } from '@/lib/cn';
import { NotificationBell } from '@/ui/compounds/NotificationBell';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

const adminNav: NavItem[] = [
  { label: 'داشبورد',  to: '/admin/dashboard',  icon: <LayoutDashboard size={16} /> },
  { label: 'بازارها',  to: '/admin/markets',    icon: <TrendingUp size={16} /> },
  { label: 'کاربران',  to: '/admin/users',      icon: <Users size={16} /> },
  { label: 'تصفیه',   to: '/admin/settlement', icon: <FileText size={16} /> },
  { label: 'معاملات',  to: '/admin/trades',     icon: <BarChart2 size={16} /> },
];

const accountantNav: NavItem[] = [
  { label: 'گزارش',    to: '/accountant/reports',     icon: <BarChart2 size={16} /> },
  { label: 'معاملات',  to: '/accountant/trades',      icon: <TrendingUp size={16} /> },
  { label: 'تصفیه‌ها', to: '/accountant/settlements', icon: <FileText size={16} /> },
  { label: 'کاربران',  to: '/accountant/users',       icon: <Users size={16} /> },
];

const traderNav: NavItem[] = [
  { label: 'دفتر سفارش', to: '/trader/orderbook', icon: <BookOpen size={16} /> },
  { label: 'سفارش‌ها',   to: '/trader/orders',    icon: <TrendingUp size={16} /> },
  { label: 'تاریخچه',    to: '/trader/history',   icon: <History size={16} /> },
  { label: 'پروفایل',    to: '/trader/profile',   icon: <User size={16} /> },
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

  const lockMins = Math.floor(lockCountdown / 60);
  const lockSecs = lockCountdown % 60;
  const lockLabel = `${String(lockMins).padStart(2, '0')}:${String(lockSecs).padStart(2, '0')}`;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
      dir="rtl"
    >
      {/* Sidebar — right side in RTL */}
      <aside
        className="flex w-60 shrink-0 flex-col border-l overflow-y-auto"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        {/* Brand */}
        <div
          className="px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: 'var(--text-tertiary)' }}
          >
            اتاق معاملات
          </p>
          <p
            className="mt-0.5 text-base font-bold"
            style={{ color: 'var(--accent-gold)' }}
          >
            شمس‌العماره
          </p>
        </div>

        {/* User info */}
        {profile && (
          <div
            className="flex items-center gap-3 px-5 py-4 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent-gold) 20%, transparent)',
                color: 'var(--accent-gold)',
              }}
            >
              {initials(profile.full_name)}
            </div>
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
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
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
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div
          className="p-3 border-t shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <LogOut size={16} />
            خروج از حساب
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TopBar */}
        <header
          className="flex shrink-0 items-center justify-between gap-4 border-b px-8"
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
        <main
          className="flex-1 overflow-y-auto"
          style={{ padding: 32 }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
