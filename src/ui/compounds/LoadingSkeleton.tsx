import { cn } from '@/lib/cn';

// Inject shimmer keyframes once
const STYLE_ID = 'skeleton-shimmer-keyframes';
function injectShimmer() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }
    .skeleton-shimmer {
      background-color: var(--bg-overlay);
      background-image: linear-gradient(
        90deg,
        var(--bg-overlay) 0%,
        color-mix(in srgb, var(--border-subtle) 60%, var(--bg-overlay)) 40%,
        var(--bg-overlay) 80%
      );
      background-size: 800px 100%;
      animation: shimmer 1.6s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}
injectShimmer();

// ---------- SkeletonLine ----------

interface SkeletonLineProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function SkeletonLine({ width = '100%', height = 14, className, style }: SkeletonLineProps) {
  return (
    <span
      className={cn('skeleton-shimmer block rounded', className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

// ---------- SkeletonCard ----------

interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
  return (
    <div
      className={cn('rounded-xl border p-4', className)}
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
      aria-busy="true"
      aria-label="در حال بارگذاری..."
    >
      <SkeletonLine width="45%" height={16} className="mb-4" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine
            key={i}
            width={i === lines - 1 ? '65%' : '100%'}
            height={12}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- SkeletonTableRow ----------

interface SkeletonTableRowProps {
  cols?: number;
  className?: string;
}

export function SkeletonTableRow({ cols = 4, className }: SkeletonTableRowProps) {
  return (
    <div
      className={cn('flex items-center gap-4 px-4 py-3', className)}
      aria-hidden="true"
    >
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonLine
          key={i}
          height={12}
          style={{ flex: 1 } as React.CSSProperties}
          width={undefined}
        />
      ))}
    </div>
  );
}

// ---------- SkeletonRow (alias for SkeletonLine — configurable full-width bar) ----------

interface SkeletonRowProps {
  height?: string | number;
  className?: string;
}

export function SkeletonRow({ height = 16, className }: SkeletonRowProps) {
  return (
    <SkeletonLine width="100%" height={height} className={className} />
  );
}

// ---------- SkeletonTable (5 table-like skeleton rows) ----------

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, cols = 4, className }: SkeletonTableProps) {
  return (
    <div
      className={cn('rounded-xl border overflow-hidden', className)}
      style={{ borderColor: 'var(--border-subtle)' }}
      aria-busy="true"
      aria-label="در حال بارگذاری جدول..."
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} height={10} style={{ flex: 1 } as React.CSSProperties} width={undefined} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
          style={{ borderColor: 'var(--border-subtle)', backgroundColor: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-elevated)' }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonLine
              key={j}
              height={12}
              style={{ flex: 1 } as React.CSSProperties}
              width={undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- SkeletonChart ----------

interface SkeletonChartProps {
  className?: string;
}

export function SkeletonChart({ className }: SkeletonChartProps) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-xl', className)}
      aria-busy="true"
      aria-label="در حال بارگذاری نمودار..."
    >
      {/* Main chart body */}
      <SkeletonLine width="100%" height={200} className="rounded-xl" />
      {/* Decorative axis hint lines */}
      <div className="absolute inset-x-0 bottom-0 flex h-full flex-col justify-between px-3 py-3 pointer-events-none">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className="block h-px w-full opacity-20"
            style={{ backgroundColor: 'var(--border-subtle)' }}
          />
        ))}
      </div>
    </div>
  );
}
