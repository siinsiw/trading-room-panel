import { Outlet } from 'react-router-dom';

export function AuthShell() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4"
      style={{ backgroundColor: 'var(--bg-base)' }}>

      {/* Gold radial glow background */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,162,76,0.12) 0%, transparent 70%)',
      }} />

      {/* Logo */}
      <div className="mb-8 text-center z-10">
        <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--accent-gold-dim), var(--accent-gold))' }}>
          <span className="text-xl font-bold text-black">م</span>
        </div>
        <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>
          اتاق معاملات
        </p>
      </div>

      {/* Auth form card */}
      <div className="w-full max-w-[380px] z-10 rounded-2xl p-8"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <Outlet />
      </div>
    </div>
  );
}
