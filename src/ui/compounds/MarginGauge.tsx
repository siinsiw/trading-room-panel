import { useEffect } from 'react';
import { useSpring, useTransform, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { toFa } from '@/lib/persian';

export type MarginZone = 'safe' | 'warn' | 'risk' | 'call';

const ZONE_COLOR: Record<MarginZone, string> = {
  safe: 'var(--semantic-success)',
  warn: '#eab308',
  risk: 'var(--semantic-warn)',
  call: 'var(--semantic-danger)',
};

// Arc: 270° sweep, starts at 225° (bottom-left), ends at -45° (bottom-right)
const START_ANGLE = 225; // degrees
const SWEEP = 270; // degrees

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

interface ArcProps {
  cx: number;
  cy: number;
  r: number;
  percentage: number;
  color: string;
  strokeWidth: number;
}

function AnimatedArc({ cx, cy, r, percentage, color, strokeWidth }: ArcProps) {
  const circumference = 2 * Math.PI * r;
  const arcLength = (SWEEP / 360) * circumference;

  const spring = useSpring(percentage, { stiffness: 80, damping: 20 });
  const dashOffset = useTransform(spring, (p) => {
    const filled = Math.min(Math.max(p, 0), 100) / 100;
    return arcLength - filled * arcLength;
  });

  useEffect(() => {
    spring.set(percentage);
  }, [percentage, spring]);

  const fullPath = arcPath(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP);

  return (
    <motion.path
      d={fullPath}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={arcLength}
      style={{ strokeDashoffset: dashOffset }}
    />
  );
}

interface MarginGaugeProps {
  percentage: number;
  zone: MarginZone;
  size?: number;
  className?: string;
}

export function MarginGauge({ percentage, zone, size = 160, className }: MarginGaugeProps) {
  const strokeWidth = 12;
  const padding = strokeWidth / 2 + 2;
  const viewBox = size;
  const cx = viewBox / 2;
  const cy = viewBox / 2;
  const r = viewBox / 2 - padding;

  const bgPath = arcPath(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP);
  const color = ZONE_COLOR[zone];

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        overflow="visible"
      >
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Animated foreground arc */}
        <AnimatedArc
          cx={cx}
          cy={cy}
          r={r}
          percentage={percentage}
          color={color}
          strokeWidth={strokeWidth}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 select-none">
        <span
          className="font-bold leading-none"
          style={{
            color,
            fontSize: size * 0.18,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {toFa(percentage.toFixed(1))}٪
        </span>
        <span
          className="font-medium leading-none"
          style={{
            color: 'var(--text-secondary)',
            fontSize: size * 0.1,
          }}
        >
          مارجین
        </span>
      </div>
    </div>
  );
}
