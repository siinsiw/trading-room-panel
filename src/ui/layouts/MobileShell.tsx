import { useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { CircleHelp, MoreHorizontal, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { gsap, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/cn';
import { NotificationBell } from '@/ui/compounds/NotificationBell';
import { PAGE_INTRO } from '@/features/guide/content';
import { startTour } from '@/features/guide/tour';
import { extraItems, navForRole, usePendingRegistrations } from './shell/nav';

/** حداکثر آیتمی که در نوار پایین جا می‌شود؛ بقیه به شیت «بیشتر» می‌روند. */
const BAR_SLOTS = 4;

export function MobileShell() {
  const { profile } = useAuthStore();
  const role = profile?.role ?? null;
  const { pathname } = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);

  const nav = useMemo(() => navForRole(role).flatMap((g) => g.items), [role]);
  const pending = usePendingRegistrations(role === 'admin');
  const needsSheet = nav.length > BAR_SLOTS + 1;
  const primary = needsSheet ? nav.slice(0, BAR_SLOTS) : nav;
  const overflow = [...(needsSheet ? nav.slice(BAR_SLOTS) : []), ...extraItems(role)];
  const overflowActive = overflow.some((i) => pathname.startsWith(i.to));
  const title = PAGE_INTRO[pathname]?.title ?? 'اتاق معاملات';

  // شیت از پایین بالا می‌آید — transform، نه height
  useGSAP(() => {
    if (!sheetOpen || !sheet.current) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(sheet.current, { yPercent: 100, duration: 0.45, ease: 'power3.out' });
      gsap.from(sheet.current!.querySelectorAll('a'), { y: 12, autoAlpha: 0, stagger: 0.03, duration: 0.35, delay: 0.1 });
    });
    return () => mm.revert();
  }, { dependencies: [sheetOpen], revertOnUpdate: true });

  return (
    <div className="flex min-h-[100dvh] flex-col" dir="rtl">
      <header
        className="glass sticky top-2 z-40 mx-2 mt-2 flex shrink-0 items-center gap-2 rounded-[18px] px-3"
        style={{ height: 52, marginTop: 'calc(env(safe-area-inset-top) + 8px)' }}
      >
        <span className="min-w-0 flex-1 truncate text-[17px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        <button
          type="button" onClick={() => startTour(pathname)} data-tour="help"
          className="flex h-9 items-center gap-1.5 rounded-[11px] px-2.5 text-[14px] font-bold"
          style={{ color: 'var(--gold-deep)', background: 'var(--gold-soft)' }}
        >
          <CircleHelp size={16} /> راهنما
        </button>
        <NotificationBell />
      </header>

      <main className="flex-1 px-3 pb-28 pt-3">
        <Outlet />
      </main>

      {sheetOpen && (
        <>
          <button
            type="button" aria-label="بستن" onClick={() => setSheetOpen(false)}
            className="fixed inset-0 z-[55]" style={{ backgroundColor: 'var(--modal-scrim)' }}
          />
          <div
            ref={sheet}
            className="glass glass-strong fixed inset-x-2 bottom-2 z-[60] rounded-[24px]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
          >
            <div className="flex items-center justify-between px-4 pb-1 pt-3">
              <span className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>بقیهٔ بخش‌ها</span>
              <button type="button" onClick={() => setSheetOpen(false)} className="rounded-lg p-2" style={{ color: 'var(--text-tertiary)' }} aria-label="بستن">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 px-3 pb-3 pt-1">
              {overflow.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to} to={item.to} onClick={() => setSheetOpen(false)}
                    className="relative flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[16px] px-2"
                    style={{ background: isActive ? 'rgba(255,255,255,.85)' : 'transparent', color: isActive ? 'var(--gold-deep)' : 'var(--text-secondary)' }}
                  >
                    {item.badge === 'registrations' && pending > 0 && (
                      <span className="absolute left-4 top-2 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--semantic-sell)' }} />
                    )}
                    <Icon size={21} strokeWidth={1.7} />
                    <span className="text-[12.5px]">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* نوار پایین شناور — دیگر افقی اسکرول نمی‌شود؛ آیتم‌های اضافه به شیت می‌روند */}
      <nav
        data-tour="nav"
        className="glass fixed inset-x-2 bottom-2 z-50 flex items-stretch rounded-[22px] px-1"
        style={{ height: 66, marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        {primary.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to} to={item.to}
              className={cn('relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 px-1', isActive && 'nav-active')}
              style={{ color: isActive ? 'var(--gold-deep)' : 'var(--text-tertiary)', fontWeight: isActive ? 700 : 400 }}
            >
              <Icon size={21} strokeWidth={1.7} />
              <span className="text-[12px]">{item.label}</span>
            </NavLink>
          );
        })}
        {needsSheet && (
          <button
            type="button" onClick={() => setSheetOpen((v) => !v)} aria-expanded={sheetOpen}
            className={cn('relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 px-1', overflowActive && 'nav-active')}
            style={{ color: overflowActive || sheetOpen ? 'var(--gold-deep)' : 'var(--text-tertiary)' }}
          >
            {pending > 0 && <span className="absolute left-1/2 top-2 ms-2 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--semantic-sell)' }} />}
            <MoreHorizontal size={21} />
            <span className="text-[12px]">بیشتر</span>
          </button>
        )}
      </nav>
    </div>
  );
}
