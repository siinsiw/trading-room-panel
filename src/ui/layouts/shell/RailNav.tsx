import { Fragment, useLayoutEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CircleHelp, LogOut } from 'lucide-react';
import { Flip, prefersReducedMotion } from '@/lib/gsap';
import { toFa } from '@/lib/persian';
import { cn } from '@/lib/cn';
import { Logo } from '@/ui/compounds/Logo';
import { type NavGroup } from './nav';

interface RailNavProps {
  groups: NavGroup[];
  pendingRegistrations: number;
  onHelp: () => void;
  onSignOut: () => void;
}

/**
 * ریل باریک شیشه‌ای — آیکون با اسم کوتاه زیرش، تا ادمین برای پیدا کردن
 * صفحه حدس نزند. نشانگر صفحهٔ فعال با Flip از آیتم قبلی سُر می‌خورد.
 */
export function RailNav({ groups, pendingRegistrations, onHelp, onSignOut }: RailNavProps) {
  const { pathname } = useLocation();
  const pill = useRef<HTMLSpanElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);

  // حالت نشانگر قبل از عوض شدن مسیر گرفته می‌شود (در onClick) و اینجا پخش می‌شود
  useLayoutEffect(() => {
    if (!flipState.current || !pill.current) return;
    const t = Flip.from(flipState.current, { targets: pill.current, duration: prefersReducedMotion() ? 0 : 0.55, ease: 'power3.inOut' });
    flipState.current = null;
    return () => { t.kill(); };
  }, [pathname]);

  const capture = () => { if (pill.current) flipState.current = Flip.getState(pill.current); };

  return (
    <aside
      className="glass sticky top-3.5 m-3.5 me-0 flex h-[calc(100vh-28px)] w-[92px] shrink-0 flex-col items-center rounded-[28px] py-4"
      aria-label="منوی اصلی"
    >
      <div className="mb-3 overflow-hidden rounded-[14px]" style={{ boxShadow: '0 8px 18px -6px rgba(169,118,28,.45)' }}>
        <Logo size={46} />
      </div>

      <nav data-tour="nav" className="no-scrollbar flex w-full flex-1 flex-col gap-0.5 overflow-y-auto px-2.5">
        {groups.map((g, gi) => (
          <Fragment key={g.title}>
            {gi > 0 && <hr className="mx-4 my-2 border-0 border-t" style={{ borderColor: 'var(--border-subtle)' }} />}
            {g.items.map((it) => {
              const Icon = it.icon;
              const badge = it.badge === 'registrations' ? pendingRegistrations : 0;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  onClick={capture}
                  title={it.full}
                  className={({ isActive }) => cn(
                    'relative isolate flex flex-col items-center gap-1 rounded-[14px] px-1 pb-1.5 pt-2 text-[12px] leading-tight transition-colors',
                    isActive ? 'font-bold' : 'hover:text-[var(--text-primary)]',
                  )}
                  style={({ isActive }) => ({ color: isActive ? 'var(--gold-deep)' : 'var(--text-tertiary)' })}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          ref={pill}
                          data-flip-id="rail-pill"
                          aria-hidden
                          className="absolute inset-0 -z-10 rounded-[14px]"
                          style={{
                            background: 'linear-gradient(180deg, rgba(255,255,255,.95), rgba(241,227,194,.7))',
                            boxShadow: 'inset 0 1px 0 #fff, 0 6px 14px -6px rgba(138,97,20,.35)',
                          }}
                        />
                      )}
                      {badge > 0 && (
                        <span
                          className="absolute left-3 top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[11px] font-bold text-white"
                          style={{ background: 'var(--semantic-sell)' }}
                          aria-label={`${toFa(badge)} درخواست منتظر`}
                        >
                          {toFa(badge)}
                        </span>
                      )}
                      <Icon size={20} strokeWidth={1.7} />
                      <span className="text-center">{it.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </Fragment>
        ))}
      </nav>

      <div className="mt-2 flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={onHelp}
          title="راهنمای همین صفحه"
          className="grid h-[52px] w-[52px] place-items-center rounded-[18px] transition-transform hover:-translate-y-0.5"
          style={{ color: 'var(--gold-deep)', background: 'var(--gold-soft)', boxShadow: 'inset 0 0 0 1px rgba(200,150,47,.35)' }}
        >
          <CircleHelp size={24} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          onClick={onSignOut}
          title="خروج از حساب"
          className="grid h-10 w-10 place-items-center rounded-[12px] transition-colors hover:bg-[var(--surface-tint)]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <LogOut size={18} strokeWidth={1.7} />
        </button>
      </div>
    </aside>
  );
}
