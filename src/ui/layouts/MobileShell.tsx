import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  User,
  BarChart2,
  FileText,
  PlusCircle,
  CalendarOff,
  SlidersHorizontal,
  UserPlus,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/cn';
import { NotificationBell } from '@/ui/compounds/NotificationBell';
import { ThemeToggle } from '@/ui/compounds/ThemeToggle';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

const adminNav: NavItem[] = [
  { label: 'داشبورد',  to: '/admin/dashboard',    icon: <LayoutDashboard size={20} /> },
  { label: 'بازارها',  to: '/admin/markets',      icon: <TrendingUp size={20} /> },
  { label: 'کاربران',  to: '/admin/users',        icon: <Users size={20} /> },
  { label: 'تصفیه',    to: '/admin/settlement',   icon: <FileText size={20} /> },
  { label: 'معاملات',  to: '/admin/trades',       icon: <BarChart2 size={20} /> },
  { label: 'ثبت دستی', to: '/admin/manual-trade', icon: <PlusCircle size={20} /> },
  { label: 'تعطیلات',  to: '/admin/holidays',     icon: <CalendarOff size={20} /> },
  { label: 'عضویت‌ها', to: '/admin/registrations', icon: <UserPlus size={20} /> },
  { label: 'تنظیمات',  to: '/admin/settings',     icon: <SlidersHorizontal size={20} /> },
  { label: 'پروفایل',  to: '/admin/profile',      icon: <User size={20} /> },
];

const accountantNav: NavItem[] = [
  { label: 'گزارش',    to: '/accountant/reports',     icon: <BarChart2 size={20} /> },
  { label: 'معاملات',  to: '/accountant/trades',      icon: <TrendingUp size={20} /> },
  { label: 'تصفیه‌ها', to: '/accountant/settlements', icon: <FileText size={20} /> },
  { label: 'کاربران',  to: '/accountant/users',       icon: <Users size={20} /> },
  { label: 'پروفایل',  to: '/accountant/profile',     icon: <User size={20} /> },
];

// ناوبری معامله‌گر برداشته شد (۲۰۲۶-۰۹-۲۲) — پنل فقط داشبورد مدیریتی است.

function navForRole(role: string | null): NavItem[] {
  if (role === 'admin') return adminNav;
  if (role === 'accountant') return accountantNav;
  return [];
}

/** حداکثر آیتمی که در نوار پایین جا می‌شود؛ بقیه به شیت «بیشتر» می‌روند. */
const BAR_SLOTS = 4;

export function MobileShell() {
  const { profile } = useAuthStore();
  const location = useLocation();
  const nav = navForRole(profile?.role ?? null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const needsSheet = nav.length > BAR_SLOTS + 1;
  const primary = needsSheet ? nav.slice(0, BAR_SLOTS) : nav;
  const overflow = needsSheet ? nav.slice(BAR_SLOTS) : [];

  const active = nav.find((i) => location.pathname.startsWith(i.to));
  const overflowActive = overflow.some((i) => location.pathname.startsWith(i.to));

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
      dir="rtl"
    >
      {/* TopBar — عنوان از مسیر جاری می‌آید، نه از document.title
          که هیچ‌وقت به‌روز نمی‌شد. */}
      <header
        className="flex shrink-0 items-center justify-between gap-2 border-b px-4"
        style={{
          height: 48,
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <span
          className="min-w-0 flex-1 truncate text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {active?.label ?? 'اتاق معاملات'}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <ThemeToggle size={15} />
          <NotificationBell />
        </div>
      </header>

      <main
        className="flex-1 overflow-y-auto"
        style={{ padding: 16, paddingBottom: 96 }}
      >
        <Outlet />
      </main>

      {/* شیت «بیشتر» */}
      {sheetOpen && (
        <>
          <button
            type="button"
            aria-label="بستن"
            onClick={() => setSheetOpen(false)}
            className="fixed inset-0 z-[55]"
            style={{ backgroundColor: 'var(--modal-scrim)' }}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl border-t"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
            }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                بقیهٔ بخش‌ها
              </span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="rounded-lg p-2"
                style={{ color: 'var(--text-tertiary)' }}
                aria-label="بستن"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 px-3 pb-3 pt-1">
              {overflow.map((item) => {
                const isActive = location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSheetOpen(false)}
                    className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl px-2"
                    style={{
                      backgroundColor: isActive ? 'var(--bg-overlay)' : 'transparent',
                      color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    }}
                  >
                    {item.icon}
                    <span className="text-[11px] font-medium">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* نوار پایین — دیگر افقی اسکرول نمی‌شود؛ آیتم‌های اضافه به شیت می‌روند */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t"
        style={{
          height: 64,
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {primary.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 px-1',
                isActive ? 'nav-active' : '',
              )}
              style={{ color: isActive ? 'var(--accent-gold)' : 'var(--text-tertiary)' }}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}

        {needsSheet && (
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
            className={cn(
              'relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 px-1',
              overflowActive ? 'nav-active' : '',
            )}
            style={{
              color: overflowActive || sheetOpen ? 'var(--accent-gold)' : 'var(--text-tertiary)',
            }}
          >
            <MoreHorizontal size={20} />
            <span className="text-[10px] font-medium">بیشتر</span>
          </button>
        )}
      </nav>
    </div>
  );
}
