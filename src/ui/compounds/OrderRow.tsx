import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { toFa } from '@/lib/persian';

interface OrderRowProps {
  price: number;
  totalVolume: number;
  orderCount: number;
  side: 'buy' | 'sell';
  maxVolume: number;
  isBestPrice?: boolean;
  onClick?: (price: number) => void;
  className?: string;
}

export function OrderRow({
  price,
  totalVolume,
  orderCount,
  side,
  maxVolume,
  isBestPrice = false,
  onClick,
  className,
}: OrderRowProps) {
  const depthPct = maxVolume > 0 ? Math.min((totalVolume / maxVolume) * 100, 100) : 0;

  const isBuy = side === 'buy';
  const depthBg = isBuy
    ? 'color-mix(in srgb, var(--semantic-buy) 15%, transparent)'
    : 'color-mix(in srgb, var(--semantic-sell) 15%, transparent)';
  const priceColor = isBuy ? 'var(--semantic-buy)' : 'var(--semantic-sell)';

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={() => onClick?.(price)}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(price);
        }
      }}
      className={cn(
        'relative flex items-center overflow-hidden select-none',
        'px-3 py-1.5 text-xs',
        onClick && 'cursor-pointer hover:brightness-125',
        className,
      )}
      style={{
        boxShadow: isBestPrice
          ? '0 0 12px var(--accent-gold-dim)'
          : undefined,
        transition: 'filter var(--transition-default)',
      }}
    >
      {/* Depth bar — absolutely positioned behind content */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0"
        style={{
          // buy side: bar grows from right; sell side: from left
          [isBuy ? 'right' : 'left']: 0,
          width: `${depthPct}%`,
          backgroundColor: depthBg,
          transition: 'width 300ms ease',
        }}
      />

      {/* Price */}
      <span
        className="relative z-10 flex-1 font-mono font-semibold tabular-nums"
        style={{
          color: priceColor,
          fontFamily: "'Geist Mono', 'Menlo', monospace",
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatPrice(price)}
      </span>

      {/* Volume + count — right-aligned */}
      <span
        className="relative z-10 flex items-center gap-3 font-mono tabular-nums"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>{toFa(totalVolume)}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>({toFa(orderCount)})</span>
      </span>
    </div>
  );
}
