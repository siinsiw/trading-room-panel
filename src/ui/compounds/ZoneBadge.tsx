import { cn } from '@/lib/cn';

export type MarginZone = 'safe' | 'warn' | 'risk' | 'call';

interface ZoneConfig {
  label: string;
  dotColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

const ZONE_CONFIG: Record<MarginZone, ZoneConfig> = {
  safe: {
    label: 'سالم',
    dotColor: 'var(--semantic-success)',
    textColor: 'var(--semantic-success)',
    bgColor: 'color-mix(in srgb, var(--semantic-success) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--semantic-success) 30%, transparent)',
  },
  warn: {
    label: 'هشدار',
    dotColor: '#eab308',
    textColor: '#eab308',
    bgColor: 'color-mix(in srgb, #eab308 12%, transparent)',
    borderColor: 'color-mix(in srgb, #eab308 30%, transparent)',
  },
  risk: {
    label: 'پرریسک',
    dotColor: 'var(--semantic-warn)',
    textColor: 'var(--semantic-warn)',
    bgColor: 'color-mix(in srgb, var(--semantic-warn) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--semantic-warn) 30%, transparent)',
  },
  call: {
    label: 'مارجین کال',
    dotColor: 'var(--semantic-danger)',
    textColor: 'var(--semantic-danger)',
    bgColor: 'color-mix(in srgb, var(--semantic-danger) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--semantic-danger) 30%, transparent)',
  },
};

interface ZoneBadgeProps {
  zone: MarginZone;
  showLabel?: boolean;
  className?: string;
}

export function ZoneBadge({ zone, showLabel = true, className }: ZoneBadgeProps) {
  const cfg = ZONE_CONFIG[zone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{
        backgroundColor: cfg.bgColor,
        borderColor: cfg.borderColor,
        color: cfg.textColor,
      }}
    >
      {/* Dot */}
      <span
        className="inline-block rounded-full"
        style={{
          width: 6,
          height: 6,
          backgroundColor: cfg.dotColor,
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      {showLabel && <span>{cfg.label}</span>}
    </span>
  );
}
