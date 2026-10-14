import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/gsap';

interface RevealProps {
  show: boolean;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

/**
 * باز و بسته شدن نرم با ارتفاع خودکار — پیام خطا یا هشدار زیر فیلد بدون
 * پرش چیدمان باز می‌شود (الگوی «Animate auto height» در demos.gsap.com).
 * height اینجا عمداً متحرک است: تنها راه کنار رفتن نرم چیزهای زیرش.
 */
export function Reveal({ show, children, className, id }: RevealProps) {
  const el = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const d = first.current || prefersReducedMotion() ? 0 : 0.35;
    first.current = false;
    const t = gsap.to(node, { height: show ? 'auto' : 0, autoAlpha: show ? 1 : 0, duration: d, ease: 'power2.inOut', overwrite: true });
    return () => { t.kill(); };
  }, [show]);

  return (
    <div ref={el} id={id} aria-live="polite" className={className} style={{ height: 0, opacity: 0, visibility: 'hidden', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
