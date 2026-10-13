interface MarginBarProps {
  /** درصد زیان ودیعه، ۰ تا ۱۰۰ */
  value: number;
  warnAt: number;
  callAt: number;
  className?: string;
}

/**
 * نوار سه‌ناحیه‌ای مارجین با نشانگر جای فعلی کاربر —
 * الگوی CategoryBar در Tremor، با رنگ‌های اتاق و جهت راست‌به‌چپ.
 */
export function MarginBar({ value, warnAt, callAt, className }: MarginBarProps) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={className} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}>
      <div className="relative flex h-[5px] gap-[2px]">
        <i className="block h-full rounded-full" style={{ width: `${warnAt}%`, background: '#E9D7AE' }} />
        <i className="block h-full rounded-full" style={{ width: `${callAt - warnAt}%`, background: 'var(--amber)' }} />
        <i className="block h-full rounded-full" style={{ width: `${100 - callAt}%`, background: 'var(--semantic-sell)' }} />
        <span
          className="absolute -top-[3px] h-[11px] w-[3px] rounded-sm"
          style={{ right: `calc(${v}% - 1.5px)`, background: 'var(--text-primary)', boxShadow: '0 0 0 2px #fff' }}
        />
      </div>
    </div>
  );
}
