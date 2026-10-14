import { useId, useRef, useState, type InputHTMLAttributes, type Ref } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/gsap';
import { cn } from '@/lib/cn';
import { Reveal } from '@/ui/compounds/Reveal';

interface FloatFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  label: string;
  error?: string;
  /** پیام غیرخطا (مثلاً هشدار Caps Lock) — طلایی، زیر فیلد */
  note?: string;
  /** دکمه یا آیکون سمت چپ فیلد (در راست‌چین: انتهای فیلد) */
  end?: React.ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/**
 * فیلد با برچسب شناور و خط طلایی «حکاکی» که از راست کشیده می‌شود.
 * الگو: Origin «Input with label animation» (برچسب با origin-start تا در
 * راست‌چین به سمت راست کوچک شود) + خط با scaleX در GSAP.
 * با register در react-hook-form کار می‌کند: ref و onFocus/onBlur ادغام می‌شوند.
 */
export function FloatField({ label, error, note, end, ref, className, onFocus, onBlur, onChange, id, ...rest }: FloatFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const rule = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);
  const [filled, setFilled] = useState(false);
  const up = focused || filled;

  const drawRule = (to: number) => {
    gsap.to(rule.current, { scaleX: to, duration: prefersReducedMotion() ? 0 : 0.5, ease: 'power3.out', overwrite: true });
  };

  return (
    <div className={className}>
      <div className="relative">
        <input
          {...rest}
          id={inputId}
          ref={ref}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={`${inputId}-msg`}
          onFocus={(e) => { setFocused(true); drawRule(1); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); setFilled(e.target.value.length > 0); drawRule(e.target.value ? 0.35 : 0); onBlur?.(e); }}
          onChange={(e) => { setFilled(e.target.value.length > 0); onChange?.(e); }}
          // پرِ خودکار مرورگر رویداد change نمی‌دهد؛ globals.css روی :-webkit-autofill
          // یک انیمیشن خالی می‌گذارد تا همین‌جا بفهمیم فیلد پر شده
          onAnimationStart={(e) => { if (e.animationName === 'tt-autofill') setFilled(true); }}
          className={cn(
            'peer h-14 w-full rounded-[14px] border-0 px-3.5 pb-1.5 pt-5 text-[16px] outline-none transition-[box-shadow,background-color] duration-200',
            end && 'pl-12', // دکمهٔ انتها همیشه سمت چپ فیزیکی است، هر جهتی که فیلد داشته باشد
          )}
          style={{
            color: 'var(--text-primary)',
            textAlign: 'right', // ایمیل و رمز ltr‌اند ولی کنار برچسب راست می‌نشینند
            background: focused ? '#fff' : 'rgba(255,255,255,.72)',
            boxShadow: error
              ? 'inset 0 0 0 1px rgba(200,50,95,.45)'
              : focused ? 'inset 0 0 0 1px rgba(200,150,47,.55)' : 'inset 0 0 0 1px var(--border-strong)',
          }}
        />
        <label
          htmlFor={inputId}
          className="pointer-events-none absolute right-3.5 top-[17px] origin-top-right text-[15.5px] transition-[transform,color] duration-[280ms] ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{
            transform: up ? 'translateY(-11px) scale(.78)' : 'none',
            color: error ? 'var(--semantic-sell)' : up ? 'var(--gold-deep)' : 'var(--text-tertiary)',
          }}
        >
          {label}
        </label>
        <span
          ref={rule}
          aria-hidden
          className="absolute inset-x-3.5 bottom-[7px] h-[1.5px] origin-right scale-x-0 rounded-full"
          style={{ background: error ? 'var(--semantic-sell)' : 'linear-gradient(to left, var(--gold-deep), var(--gold))' }}
        />
        {end && <div className="absolute left-2 top-2">{end}</div>}
      </div>
      <Reveal show={Boolean(error || note)} id={`${inputId}-msg`}>
        <p className="px-1 pt-2 text-[13.5px]" role={error ? 'alert' : undefined} style={{ color: error ? 'var(--semantic-sell)' : 'var(--gold-deep)' }}>
          {error || note}
        </p>
      </Reveal>
    </div>
  );
}
