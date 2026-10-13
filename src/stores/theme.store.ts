import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'tt.theme';

/** تمی که واقعاً باید اعمال شود — `system` را به dark/light حل می‌کند. */
export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function readInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';

  // ‎?theme=light در URL بر همه‌چیز اولویت دارد — برای اسکرین‌شات و
  // لینک‌دادن به یک نمای مشخص.
  const q = new URLSearchParams(window.location.search).get('theme');
  if (q === 'light' || q === 'dark') return q;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;

  return 'dark';
}

/** `data-theme` را روی <html> می‌نشاند. */
function apply(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', mode);
  }
  // نوار آدرس موبایل هم‌رنگ شود
  const resolved = resolveTheme(mode);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#F6F4EF' : '#08080C');
}

interface ThemeState {
  mode: ThemeMode;
  resolved: 'dark' | 'light';
  setMode: (mode: ThemeMode) => void;
  /** چرخهٔ تیره ← روشن ← سیستم */
  cycle: () => void;
}

const initialMode = readInitialMode();
apply(initialMode);

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initialMode,
  resolved: resolveTheme(initialMode),

  setMode: (mode) => {
    apply(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // حالت ناشناس / استوریج مسدود — تم همین سشن کار می‌کند
    }
    set({ mode, resolved: resolveTheme(mode) });
  },

  cycle: () => {
    const order: ThemeMode[] = ['dark', 'light', 'system'];
    const next = order[(order.indexOf(get().mode) + 1) % order.length]!;
    get().setMode(next);
  },
}));

/** وقتی کاربر روی «سیستم» است و تم سیستم عوض می‌شود، همراهش برویم. */
if (typeof window !== 'undefined') {
  window
    .matchMedia('(prefers-color-scheme: light)')
    .addEventListener('change', () => {
      const { mode } = useThemeStore.getState();
      if (mode === 'system') {
        useThemeStore.setState({ resolved: resolveTheme('system') });
        apply('system');
      }
    });
}
