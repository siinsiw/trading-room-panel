import { useRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useSpotlight } from '@/hooks/useSpotlight';

interface GlassCardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'article' | 'div' | 'aside';
  /** نور دنبال‌کنندهٔ اشاره‌گر — برای کارت‌های بزرگ، نه ردیف‌های ریز */
  spotlight?: boolean;
  strong?: boolean;
  children: ReactNode;
}

/** سطح شیشه‌ای پایه: پس‌زمینهٔ مات، لبهٔ نوری، سایهٔ لایه‌لایه. */
export function GlassCard({ as: Tag = 'section', spotlight = true, strong, className, children, ...rest }: GlassCardProps) {
  const ref = useRef<HTMLElement>(null);
  useSpotlight(ref, spotlight);
  return (
    <Tag
      ref={ref as never}
      className={cn('glass', strong && 'glass-strong', className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** سربرگ یکدست کارت: عنوان راست، هر چیز اضافه چپ. */
export function CardHeader({ title, aside, className }: { title: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <header className={cn('mb-3 flex items-center gap-3', className)}>
      <h2 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {aside && <div className="ms-auto flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>{aside}</div>}
    </header>
  );
}
