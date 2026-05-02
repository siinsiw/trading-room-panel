import { Outlet } from 'react-router-dom';
import { Logo, LOGIN_BG_URL } from '@/ui/compounds/Logo';

export function AuthShell() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4"
      style={{
        backgroundColor: 'var(--bg-base)',
        backgroundImage: `url(${LOGIN_BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* تیره‌سازی برای خوانایی فرم روی پس‌زمینه */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      />

      {/* نور طلایی روی بالا */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,162,76,0.18) 0%, transparent 70%)',
        }}
      />

      {/* لوگو */}
      <div className="mb-8 text-center z-10">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-3 overflow-hidden shadow-lg ring-1"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            boxShadow: '0 4px 24px rgba(212,162,76,0.25)',
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
          شمس‌العماره
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
