import { useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { BookOpen, CirclePlay, CircleHelp, Lock, LogOut, Search, User } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/gsap';
import { toFa } from '@/lib/persian';
import { clockFromSeconds, longJalaliDate } from '@/lib/jalali';
import { useTimeStore } from '@/stores/time.store';
import { NotificationBell } from '@/ui/compounds/NotificationBell';

interface TopBarProps {
  title: string;
  name: string;
  role: string;
  onSearch: () => void;
  onTour: () => void;
  onGuide: () => void;
  onProfile: () => void;
  onSignOut: () => void;
}

const initials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('');

function SessionPill() {
  const { tick, isLocked, lockCountdown } = useTimeStore();
  const dot = useRef<HTMLSpanElement>(null);

  // نبض نقطهٔ سبز فقط وقتی بازار باز است — یعنی «زنده»
  useGSAP(() => {
    if (isLocked || !dot.current) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(dot.current, { boxShadow: '0 0 0 0 rgba(14,138,124,.5)' }, { boxShadow: '0 0 0 7px rgba(14,138,124,0)', duration: 1.4, repeat: -1, ease: 'power1.out' });
    });
    return () => mm.revert();
  }, { dependencies: [isLocked], revertOnUpdate: true });

  return (
    <div
      data-tour="session"
      className="flex h-10 items-center gap-2 rounded-[14px] px-3.5 text-[14.5px] font-bold"
      style={isLocked
        ? { background: 'var(--sell-wash)', color: 'var(--semantic-sell)' }
        : { background: 'var(--buy-wash)', color: 'var(--semantic-buy)' }}
    >
      {isLocked ? (
        <>
          <Lock size={14} />
          قفل امروزی
          <span className="font-normal opacity-80">· {tick ? toFa(tick.tehranTime) : '—'}</span>
        </>
      ) : (
        <>
          <span ref={dot} className="h-2 w-2 rounded-full" style={{ background: 'var(--semantic-buy)' }} />
          بازار باز
          <span className="font-normal">· {clockFromSeconds(lockCountdown)} تا قفل</span>
        </>
      )}
    </div>
  );
}

const menuItem = 'flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14.5px] outline-none data-[highlighted]:bg-white/80 hover:bg-white/80';

export function TopBar({ title, name, role, onSearch, onTour, onGuide, onProfile, onSignOut }: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center gap-3 px-6 pb-4 pt-5 lg:px-7">
      <div className="me-2 min-w-0">
        <h1 className="truncate text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        <p className="text-[13.5px]" style={{ color: 'var(--text-tertiary)' }}>{longJalaliDate()}</p>
      </div>

      <button
        type="button"
        data-tour="search"
        onClick={onSearch}
        className="glass mx-auto flex h-11 min-w-0 max-w-[440px] flex-1 items-center gap-2.5 rounded-[16px] px-4 text-[14px]"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <Search size={18} />
        <span className="truncate">جستجوی صفحه یا کار…</span>
        <kbd className="ms-auto rounded-[7px] px-2 py-0.5 text-[12px]" style={{ background: 'var(--surface-tint)', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>Ctrl K</kbd>
      </button>

      <SessionPill />

      <div className="glass grid h-11 w-11 place-items-center rounded-[14px]"><NotificationBell /></div>

      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            data-tour="help"
            className="flex h-11 items-center gap-2 rounded-[14px] pe-4 ps-3.5 text-[15px] font-bold"
            style={{
              color: 'var(--gold-deep)',
              background: 'linear-gradient(180deg, #FFF8E8, #F4E3BC)',
              boxShadow: 'inset 0 1px 0 #fff, inset 0 0 0 1px rgba(200,150,47,.4), 0 8px 18px -10px rgba(138,97,20,.5)',
            }}
          >
            <CircleHelp size={18} />
            راهنما
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={8} dir="rtl" className="glass glass-strong z-40 w-[260px] rounded-[18px] p-1.5">
            <Popover.Close asChild>
              <button type="button" onClick={onTour} className={menuItem} style={{ color: 'var(--text-primary)' }}>
                <CirclePlay size={17} style={{ color: 'var(--gold-deep)' }} />
                <span className="text-right">
                  <b className="block">تور همین صفحه</b>
                  <small style={{ color: 'var(--text-tertiary)' }}>هر قسمت را نشانم بده</small>
                </span>
              </button>
            </Popover.Close>
            <Popover.Close asChild>
              <button type="button" onClick={onGuide} className={menuItem} style={{ color: 'var(--text-primary)' }}>
                <BookOpen size={17} style={{ color: 'var(--gold-deep)' }} />
                <span className="text-right">
                  <b className="block">صفحهٔ راهنما</b>
                  <small style={{ color: 'var(--text-tertiary)' }}>همهٔ کارها قدم‌به‌قدم</small>
                </span>
              </button>
            </Popover.Close>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Dropdown.Root dir="rtl">
        <Dropdown.Trigger asChild>
          <button type="button" className="glass flex h-12 items-center gap-2.5 rounded-[16px] pe-1 ps-3.5 text-right">
            <span className="leading-tight">
              <b className="block text-[14.5px]" style={{ color: 'var(--text-primary)' }}>{name}</b>
              <small className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>{role}</small>
            </span>
            <span
              className="grid h-[38px] w-[38px] place-items-center rounded-[12px] text-[14px] font-bold"
              style={{ background: 'linear-gradient(160deg, #3A3326, #1B1813)', color: '#F1E3C2' }}
            >
              {initials(name)}
            </span>
          </button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content align="end" sideOffset={8} className="glass glass-strong z-40 w-[200px] rounded-[18px] p-1.5">
            <Dropdown.Item onSelect={onProfile} className={menuItem} style={{ color: 'var(--text-primary)' }}>
              <User size={16} /> پروفایل من
            </Dropdown.Item>
            <Dropdown.Item onSelect={onSignOut} className={menuItem} style={{ color: 'var(--semantic-sell)' }}>
              <LogOut size={16} /> خروج از حساب
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
    </header>
  );
}
