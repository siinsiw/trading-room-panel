import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatTomans } from '@/lib/persian';

// Injected once into the document head
const STYLE_ID = 'price-ticker-keyframes';
function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes flashGreen {
      0%   { background-color: transparent; }
      20%  { background-color: color-mix(in srgb, var(--semantic-buy) 25%, transparent); }
      100% { background-color: transparent; }
    }
    @keyframes flashRed {
      0%   { background-color: transparent; }
      20%  { background-color: color-mix(in srgb, var(--semantic-sell) 25%, transparent); }
      100% { background-color: transparent; }
    }
    .price-flash-up   { animation: flashGreen 300ms ease-out forwards; }
    .price-flash-down { animation: flashRed   300ms ease-out forwards; }
  `;
  document.head.appendChild(style);
}

type FlashState = 'up' | 'down' | 'idle';

interface PriceTickerProps {
  value: number;
  className?: string;
}

export function PriceTicker({ value, className }: PriceTickerProps) {
  const prevRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<FlashState>('idle');

  useEffect(() => {
    injectKeyframes();
  }, []);

  useEffect(() => {
    if (prevRef.current === null) {
      prevRef.current = value;
      return;
    }
    if (value > prevRef.current) {
      setFlash('idle');
      requestAnimationFrame(() => setFlash('up'));
    } else if (value < prevRef.current) {
      setFlash('idle');
      requestAnimationFrame(() => setFlash('down'));
    }
    prevRef.current = value;
  }, [value]);

  const flashClass =
    flash === 'up'
      ? 'price-flash-up'
      : flash === 'down'
      ? 'price-flash-down'
      : '';

  return (
    <span
      className={cn(
        'rounded px-1 py-0.5 tabular-nums transition-colors',
        flashClass,
        className,
      )}
      style={{
        color: 'var(--text-primary)',
        fontFamily: "'Geist Mono', 'Menlo', monospace",
        fontVariantNumeric: 'tabular-nums',
      }}
      onAnimationEnd={() => setFlash('idle')}
    >
      {formatTomans(value)}
    </span>
  );
}
