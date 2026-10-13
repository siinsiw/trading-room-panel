import { Moon, Sun, MonitorCog } from 'lucide-react';
import { useThemeStore, type ThemeMode } from '@/stores/theme.store';
import { cn } from '@/lib/cn';

const LABEL: Record<ThemeMode, string> = {
  dark: 'تم تیره',
  light: 'تم روشن',
  system: 'هماهنگ با سیستم',
};

const NEXT: Record<ThemeMode, ThemeMode> = {
  dark: 'light',
  light: 'system',
  system: 'dark',
};

interface Props {
  /** در موبایل آیکون کوچک‌تر است */
  size?: number;
  className?: string;
}

/**
 * یک دکمه که بین سه حالت می‌چرخد: تیره ← روشن ← سیستم.
 * چرخهٔ سه‌تایی به‌جای سوییچ دوتایی، چون «هماهنگ با سیستم» برای
 * کسی که پنل را صبح و شب باز می‌کند حالت مفیدی است.
 */
export function ThemeToggle({ size = 16, className }: Props) {
  const { mode, cycle } = useThemeStore();

  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : MonitorCog;

  return (
    <button
      type="button"
      onClick={cycle}
      title={`${LABEL[mode]} — کلیک: ${LABEL[NEXT[mode]]}`}
      aria-label={LABEL[mode]}
      className={cn(
        'flex items-center justify-center rounded-lg p-2 transition-colors',
        'hover:bg-[var(--surface-tint)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-gold)]',
        className,
      )}
      style={{ color: 'var(--text-secondary)' }}
    >
      <Icon size={size} />
    </button>
  );
}
