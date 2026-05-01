import { cn } from '@/lib/cn';

function DefaultIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="6"
        y="6"
        width="44"
        height="44"
        rx="8"
        stroke="var(--border-strong)"
        strokeWidth="2"
      />
      {/* X mark */}
      <line
        x1="18"
        y1="18"
        x2="38"
        y2="38"
        stroke="var(--border-strong)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="38"
        y1="18"
        x2="18"
        y2="38"
        stroke="var(--border-strong)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-6 py-12 text-center',
        className,
      )}
      dir="rtl"
    >
      {/* Icon */}
      <div style={{ color: 'var(--text-tertiary)' }}>
        {icon ?? <DefaultIcon />}
      </div>

      {/* Title */}
      <p
        className="text-sm font-medium"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </p>

      {/* Description */}
      {description && (
        <p
          className="max-w-xs text-xs leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {description}
        </p>
      )}

      {/* Action */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            'mt-1 rounded-lg border px-4 py-2 text-xs font-semibold',
            'transition-colors duration-150',
            'hover:bg-[color-mix(in_srgb,var(--accent-gold)_10%,transparent)]',
          )}
          style={{
            borderColor: 'var(--accent-gold)',
            color: 'var(--accent-gold)',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
