import { useId, useLayoutEffect, useRef } from 'react';
import { Flip, prefersReducedMotion } from '@/lib/gsap';
import { cn } from '@/lib/cn';

interface Item<T extends string> { value: T; label: React.ReactNode }

interface SegmentedControlProps<T extends string> {
  items: Item<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

/**
 * تب‌های کنار هم با نشانگر کشویی. نشانگر یک عنصر است که داخل دکمهٔ فعال
 * جابه‌جا می‌شود و Flip فاصلهٔ دو حالت را پر می‌کند (الگوی PillNav در React Bits).
 */
export function SegmentedControl<T extends string>({ items, value, onChange, size = 'md', className, ...aria }: SegmentedControlProps<T>) {
  const pill = useRef<HTMLSpanElement>(null);
  const flipId = useId();
  const state = useRef<Flip.FlipState | null>(null);

  // بعد از رندر تازه، از حالت ذخیره‌شده تا جای جدید حرکت کن
  useLayoutEffect(() => {
    if (!state.current || !pill.current) return;
    // نشانگر بعد از رندر یک عنصر تازه است؛ Flip دو عنصر را با data-flip-id یکی می‌گیرد
    const tween = Flip.from(state.current, { targets: pill.current, duration: prefersReducedMotion() ? 0 : 0.5, ease: 'power3.inOut' });
    state.current = null;
    return () => { tween.kill(); };
  }, [value]);

  const select = (v: T) => {
    if (v === value) return;
    if (pill.current) state.current = Flip.getState(pill.current);
    onChange(v);
  };

  return (
    <div
      role="tablist"
      aria-label={aria['aria-label']}
      className={cn('inline-flex rounded-[14px] p-1', className)}
      style={{ background: 'var(--surface-tint)' }}
    >
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => select(it.value)}
            className={cn(
              'relative isolate whitespace-nowrap rounded-[10px] transition-colors',
              size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-4 text-[14.5px]',
              on ? 'font-bold' : '',
            )}
            style={{ color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          >
            {on && (
              <span
                ref={pill}
                data-flip-id={flipId}
                aria-hidden
                className="absolute inset-0 -z-10 rounded-[10px]"
                style={{ background: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9), 0 4px 10px -4px rgba(80,58,16,.28)' }}
              />
            )}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
