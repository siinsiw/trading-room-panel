import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/gsap';
import { toFa } from '@/lib/persian';

interface CountUpProps {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
  suffix?: string;
}

const fmt = (n: number, decimals: number) =>
  toFa(n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }))
    .replace(/,/g, '٬')
    .replace('.', '٫');

/**
 * عدد شمارشی — از مقدار قبلی تا مقدار تازه می‌شمارد، نه از صفر.
 * متن را مستقیم روی DOM می‌نویسد تا هر فریم رندر React نشود.
 * (CountUp در React Bits با Intl en-US قفل است و رقم فارسی نمی‌دهد.)
 */
export function CountUp({ value, decimals = 0, duration = 1.2, className, style, suffix = '' }: CountUpProps) {
  const el = useRef<HTMLSpanElement>(null);
  const state = useRef({ v: 0 });

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const paint = () => { node.textContent = fmt(state.current.v, decimals) + suffix; };
    const tween = gsap.to(state.current, {
      v: value,
      duration: prefersReducedMotion() ? 0 : duration,
      ease: 'power3.out',
      overwrite: true,
      onUpdate: paint,
      onComplete: paint,
    });
    return () => { tween.kill(); };
  }, [value, decimals, duration, suffix]);

  return (
    <span ref={el} className={className} style={{ fontFamily: 'var(--font-num)', ...style }}>
      {fmt(0, decimals) + suffix}
    </span>
  );
}
