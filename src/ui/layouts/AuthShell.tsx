import { Outlet } from 'react-router-dom';
import { Logo } from '@/ui/compounds/Logo';
import { LOGIN_BG_URL } from '@/ui/compounds/brand';
import { ThemeToggle } from '@/ui/compounds/ThemeToggle';

export function AuthShell() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4"
      style={{
        backgroundColor: 'var(--bg-base)',
        // بدون VITE_LOGIN_BG_URL اصلاً backgroundImage ست نمی‌شود؛
        // `url()` خالی در بعضی مرورگرها یک درخواست بی‌مورد می‌سازد.
        ...(LOGIN_BG_URL && {
          backgroundImage: `url(${LOGIN_BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }),
      }}
    >
      {/* تیره‌سازی برای خوانایی فرم روی پس‌زمینه — بدون تصویر لازم نیست */}
      {LOGIN_BG_URL && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: 'var(--auth-scrim)' }}
        />
      )}

      {/* نور طلایی روی بالا */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, color-mix(in srgb, var(--accent-surface) 18%, transparent) 0%, transparent 70%)',
        }}
      />

      {/* تغییر تم — گوشهٔ بالا */}
      <div className="absolute left-4 top-4 z-20">
        <ThemeToggle />
      </div>

      {/* لوگو */}
      <div className="mb-8 text-center z-10">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-3 overflow-hidden shadow-lg ring-1"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            boxShadow: '0 4px 24px color-mix(in srgb, var(--accent-surface) 25%, transparent)',
            ['--tw-ring-color' as string]: 'var(--border-strong)',
          }}
        >
          <Logo size={64} />
        </div>
        <p
          className="text-xs tracking-widest uppercase"
          style={{ color: 'var(--text-secondary)' }}
        >
          اتاق معاملات
        </p>
        <p
          className="mt-1 text-sm font-bold"
          style={{ color: 'var(--accent-gold)' }}
        >
          تی‌تی
        </p>
      </div>

      {/* کارت فرم */}
      <div
        className="w-full max-w-[380px] z-10 rounded-2xl p-8 backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 85%, transparent)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <Outlet />
      </div>
    </div>
  );
}
