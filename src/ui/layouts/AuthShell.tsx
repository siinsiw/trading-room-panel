import { useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { gsap, useGSAP } from '@/lib/gsap';
import { Logo } from '@/ui/compounds/Logo';
import { LOGIN_BG_URL } from '@/ui/compounds/brand';

export function AuthShell() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(
      { motion: '(prefers-reduced-motion: no-preference)', fine: '(pointer: fine) and (prefers-reduced-motion: no-preference)' },
      (ctx) => {
        if (!ctx.conditions?.motion) return;
        // ورود: حکاکی گاو و خرس از کمی نزدیک‌تر عقب می‌نشیند، بعد لوگو و کارت
        gsap.timeline({ defaults: { ease: 'power3.out' } })
          .fromTo('.auth-bg', { scale: 1.08, autoAlpha: 0 }, { scale: 1.02, autoAlpha: 1, duration: 2.2, ease: 'power2.out' })
          .from('.auth-brand > *', { y: 14, autoAlpha: 0, stagger: 0.08, duration: 0.6 }, 0.35)
          .from('.auth-card', { y: 24, autoAlpha: 0, duration: 0.7 }, '<0.15');

        // روی دسکتاپ: پس‌زمینه خلاف جهت موس چند پیکسل می‌رود و کارت حداکثر
        // ~۲٫۵ درجه کج می‌شود — ورق شیشه‌ای که کمی از روی حکاکی بلند شده
        if (!ctx.conditions?.fine) return;
        const bg = root.current?.querySelector<HTMLElement>('.auth-bg');
        const card = root.current?.querySelector<HTMLElement>('.auth-card');
        const foil = root.current?.querySelector<HTMLElement>('.auth-sheen');
        if (!bg || !card || !foil) return;
        gsap.set(card, { transformPerspective: 1200 });
        const xTo = gsap.quickTo(bg, 'x', { duration: 1.2, ease: 'power3' });
        const yTo = gsap.quickTo(bg, 'y', { duration: 1.2, ease: 'power3' });
        const rx = gsap.quickTo(card, 'rotationX', { duration: 0.8, ease: 'power3' });
        const ry = gsap.quickTo(card, 'rotationY', { duration: 0.8, ease: 'power3' });
        const move = (e: PointerEvent) => {
          const nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
          xTo(nx * -14);
          yTo(ny * -10);
          ry(nx * 5);
          rx(-ny * 4);
        };
        // برق فویل: با ورود موس یک بار رد می‌شود، نه بیشتر از هر ۲٫۵ ثانیه
        let lastSheen = 0;
        const sheen = () => {
          if (Date.now() - lastSheen < 2500) return;
          lastSheen = Date.now();
          gsap.fromTo(foil, { xPercent: -140 }, { xPercent: 330, duration: 1.1, ease: 'power2.inOut' });
        };
        window.addEventListener('pointermove', move);
        card.addEventListener('pointerenter', sheen);
        return () => { window.removeEventListener('pointermove', move); card.removeEventListener('pointerenter', sheen); };
      },
    );
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root} className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      {/* حکاکی گاو و خرس — لایهٔ جدا تا با transform حرکت کند، نه background-position */}
      {LOGIN_BG_URL && (
        <>
          <div
            aria-hidden
            className="auth-bg pointer-events-none absolute -inset-4 will-change-transform"
            style={{ backgroundImage: `url(${LOGIN_BG_URL})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundColor: 'var(--auth-scrim)' }} />
        </>
      )}

      <div className="auth-brand z-10 mb-7 text-center">
        <div className="mx-auto mb-3 w-fit" style={{ filter: 'drop-shadow(0 14px 22px rgba(169,118,28,.45))' }}>
          <Logo size={76} />
        </div>
        <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>اتاق معاملات</p>
        <p className="text-[22px] font-bold" style={{ color: 'var(--gold-deep)' }}>تی‌تی</p>
      </div>

      <div className="auth-card glass glass-strong z-10 w-full max-w-[400px] p-8">
        {/* برق فویل اسکناس — لایهٔ بریده‌شده با گوشه‌های کارت */}
        <span aria-hidden className="pointer-events-none absolute inset-0 z-[5] overflow-hidden rounded-[inherit]">
          <span
            className="auth-sheen absolute -inset-y-[20%] left-0 w-[45%]"
            style={{
              background: 'linear-gradient(105deg, transparent 0%, rgba(255,236,190,0) 30%, rgba(255,236,190,.55) 50%, rgba(255,236,190,0) 70%, transparent 100%)',
              mixBlendMode: 'soft-light',
              transform: 'translateX(-140%) skewX(-12deg)',
            }}
          />
        </span>
        <Outlet />
      </div>
    </div>
  );
}
