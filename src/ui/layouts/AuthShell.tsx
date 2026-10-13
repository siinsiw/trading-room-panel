import { useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { gsap, useGSAP } from '@/lib/gsap';
import { Logo } from '@/ui/compounds/Logo';
import { LOGIN_BG_URL } from '@/ui/compounds/brand';

export function AuthShell() {
  const root = useRef<HTMLDivElement>(null);

  // لوگو و کارت با یک مکث کوتاه پشت‌سرهم وارد می‌شوند
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.auth-brand > *', { y: 14, autoAlpha: 0, stagger: 0.08, duration: 0.6 })
        .from('.auth-card', { y: 24, autoAlpha: 0, duration: 0.7 }, '<0.15');
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div
      ref={root}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4"
      style={LOGIN_BG_URL ? {
        // بدون VITE_LOGIN_BG_URL اصلاً backgroundImage ست نمی‌شود؛
        // `url()` خالی در بعضی مرورگرها یک درخواست بی‌مورد می‌سازد.
        backgroundImage: `url(${LOGIN_BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      } : undefined}
    >
      {/* پردهٔ کاغذی روی تصویر پس‌زمینه — بدون تصویر لازم نیست */}
      {LOGIN_BG_URL && (
        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: 'var(--auth-scrim)' }} />
      )}

      <div className="auth-brand z-10 mb-7 text-center">
        <div className="mx-auto mb-3 w-fit overflow-hidden rounded-[18px]" style={{ boxShadow: '0 14px 30px -10px rgba(169,118,28,.55)' }}>
          <Logo size={68} />
        </div>
        <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>اتاق معاملات</p>
        <p className="text-[22px] font-bold" style={{ color: 'var(--gold-deep)' }}>تی‌تی</p>
      </div>

      <div className="auth-card glass glass-strong z-10 w-full max-w-[400px] p-8">
        <Outlet />
      </div>
    </div>
  );
}
