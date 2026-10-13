import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { gsap, useGSAP } from '@/lib/gsap';
import { CommandPalette } from '@/ui/compounds/CommandPalette';
import { PAGE_INTRO } from '@/features/guide/content';
import { startTour, tourSeen, markTourSeen } from '@/features/guide/tour';
import { RailNav } from './shell/RailNav';
import { TopBar } from './shell/TopBar';
import { extraItems, guidePath, navForRole, profilePath, usePendingRegistrations } from './shell/nav';

function roleFa(role: string | null | undefined): string {
  if (role === 'admin') return 'ادمین';
  if (role === 'accountant') return 'حسابدار';
  return '—';
}

/**
 * پوستهٔ دسکتاپ: ریل شیشه‌ای راست + نوار بالا + محتوا.
 * صفحه‌ها با یک بالا‌آمدن کوتاه وارد می‌شوند؛ Ctrl+K جستجو را باز می‌کند؛
 * بار اول که ادمین وارد داشبورد می‌شود، پیشنهاد تور می‌آید.
 */
export function DesktopShell() {
  const { profile, signOut } = useAuthStore();
  const role = profile?.role ?? null;
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const groups = useMemo(() => navForRole(role), [role]);
  const searchItems = useMemo(() => [...groups.flatMap((g) => g.items), ...extraItems(role)], [groups, role]);
  const pending = usePendingRegistrations(role === 'admin');
  const title = PAGE_INTRO[pathname]?.title ?? 'اتاق معاملات';

  const tour = useCallback(() => startTour(pathname), [pathname]);

  // Ctrl+K — با e.code تا روی کیبورد فارسی هم کار کند («ن» به‌جای k)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') { e.preventDefault(); setPaletteOpen((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ‎?tour=1 — دکمهٔ «تور» در صفحهٔ راهنما به صفحهٔ مقصد می‌رود و تور همان‌جا شروع می‌شود
  useEffect(() => {
    if (!new URLSearchParams(search).has('tour')) return;
    // بدون cleanup عمداً: پاک کردن ?tour از آدرس همین effect را دوباره اجرا
    // می‌کند و cleanup تایمر را قبل از شروع تور می‌کشت.
    const target = pathname;
    setTimeout(() => startTour(target), 900);
    navigate(pathname, { replace: true });
  }, [search, pathname, navigate]);

  // پیشنهاد تور برای بار اول — مزاحم نیست، یک toast با دکمه
  useEffect(() => {
    if (role !== 'admin' || pathname !== '/admin/dashboard' || tourSeen()) return;
    const id = setTimeout(() => {
      toast('اولین بار است؟', {
        description: 'یک تور یک‌دقیقه‌ای همهٔ قسمت‌های پنل را نشانتان می‌دهد.',
        duration: 12000,
        action: { label: 'شروع راهنما', onClick: () => startTour('/admin/dashboard') },
        onDismiss: markTourSeen,
      });
    }, 1600);
    return () => clearTimeout(id);
  }, [role, pathname]);

  // ورود پوسته یک‌بار
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.shell-rail', { x: 24, autoAlpha: 0, duration: 0.7 });
      gsap.from('.shell-top header > *', { y: -10, autoAlpha: 0, stagger: 0.05, duration: 0.5, delay: 0.1 });
    });
    return () => mm.revert();
  }, { scope: root });

  // ورود صفحه با هر تغییر مسیر
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(main.current, { y: 14, autoAlpha: 0, duration: 0.5, clearProps: 'transform,opacity,visibility' });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [pathname], revertOnUpdate: true });

  return (
    <div ref={root} className="flex min-h-screen" dir="rtl">
      <div className="shell-rail">
        <RailNav
          groups={groups}
          pendingRegistrations={pending}
          onHelp={tour}
          onSignOut={() => void signOut()}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shell-top">
          <TopBar
            title={title}
            name={profile?.full_name ?? '—'}
            role={(profile as { is_super_admin?: boolean } | null)?.is_super_admin ? 'سوپرادمین' : roleFa(role)}
            onSearch={() => setPaletteOpen(true)}
            onTour={tour}
            onGuide={() => navigate(guidePath(role))}
            onProfile={() => navigate(profilePath(role))}
            onSignOut={() => void signOut()}
          />
        </div>
        <main ref={main} className="flex-1 px-6 pb-10 lg:px-7">
          <Outlet />
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={searchItems}
        guideTo={guidePath(role)}
        onStartTour={tour}
        showHowTos={role === 'admin'}
      />
    </div>
  );
}
