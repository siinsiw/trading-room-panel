import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/gsap';
import { cn } from '@/lib/cn';
import { toFa } from '@/lib/persian';

const DIGITS = '۰۱۲۳۴۵۶۷۸۹';

interface OdometerProps {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * عدد با رقم‌های چرخان — هر رقم یک ستون ۰ تا ۹ است و با yPercent جابه‌جا می‌شود.
 * الگو: GSAP «Rolling text» (demos.gsap.com/demo/rolling-text) و Counter در React Bits.
 *
 * فقط transform متحرک است. با «حرکت کمتر» رقم‌ها بی‌انیمیشن عوض می‌شوند.
 * جهت ltr است چون عدد فارسی هم از چپ به راست نوشته می‌شود.
 */
export function Odometer({ value, className, style }: OdometerProps) {
  const root = useRef<HTMLSpanElement>(null);
  const text = Math.round(value).toLocaleString('en-US');

  // useEffect و نه useGSAP: قیمت زنده روزی هزاران بار عوض می‌شود و useGSAP
  // بدون revertOnUpdate همهٔ tweenهای تمام‌شده را در یک context انباشته می‌کند؛
  // با revertOnUpdate هم ستون‌ها هر بار از صفر می‌چرخیدند. اینجا هر ستون فقط
  // یک tween زنده دارد (overwrite) و موقع unmount کشته می‌شود.
  useEffect(() => {
    const cols = root.current ? Array.from(root.current.querySelectorAll<HTMLElement>('.odo-col')) : [];
    const digits = text.replace(/,/g, '');
    const reduce = prefersReducedMotion();
    cols.forEach((col, i) => {
      gsap.to(col, {
        yPercent: -10 * Number(digits[i]),
        duration: reduce ? 0 : 0.8,
        delay: reduce ? 0 : i * 0.04,
        ease: 'power3.inOut',
        overwrite: true,
      });
    });
    return () => { gsap.killTweensOf(cols); };
  }, [text]);

  return (
    <span
      ref={root}
      className={cn('inline-flex overflow-hidden leading-none', className)}
      style={{ direction: 'ltr', fontFamily: 'var(--font-num)', ...style }}
      role="text"
      aria-label={toFa(text).replace(/,/g, '٬')}
    >
      {[...text].map((ch, i) =>
        ch === ',' ? (
          <span key={`s${i}`} aria-hidden className="inline-block h-[1.15em] leading-[1.15em]" style={{ color: 'var(--text-tertiary)', width: '0.3em', textAlign: 'center' }}>٬</span>
        ) : (
          // کلید بر اساس فاصله از انتها: با اضافه‌شدن رقم، ستون‌های موجود سر جایشان می‌مانند
          <span key={`d${text.length - i}`} aria-hidden className="inline-block h-[1.15em] overflow-hidden">
            <span className="odo-col flex flex-col will-change-transform">
              {[...DIGITS].map((d) => (
                <span key={d} className="block h-[1.15em] text-center leading-[1.15em]">{d}</span>
              ))}
            </span>
          </span>
        ),
      )}
    </span>
  );
}
