import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { CirclePlay, CornerDownLeft, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { HOW_TOS } from '@/features/guide/content';
import type { NavItem } from '@/ui/layouts/shell/nav';

interface Entry {
  id: string;
  title: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: NavItem[];
  guideTo: string;
  onStartTour: () => void;
  /** نقش حسابدار راهنماهای ادمین را نمی‌بیند */
  showHowTos: boolean;
}

/** ی و ک عربی و نیم‌فاصله را یکی کن تا «تصفیه» با «تصفيه» هم پیدا شود */
const norm = (s: string) => s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').toLowerCase();

/**
 * جستجوی سراسری (Ctrl+K) — صفحه‌ها، راهنماها و «تور همین صفحه».
 * الگو: Command Menu در 21st.dev، روی Radix Dialog که همین حالا در پروژه هست.
 */
export function CommandPalette({ open, onOpenChange, items, guideTo, onStartTour, showHowTos }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const close = (fn: () => void) => () => { setQ(''); setActive(0); onOpenChange(false); fn(); };
    return [
      ...items.map((it) => ({ id: it.to, title: it.full, hint: 'صفحه', icon: it.icon, run: close(() => navigate(it.to)) })),
      { id: 'tour', title: 'تور همین صفحه', hint: 'راهنما', icon: CirclePlay, run: close(onStartTour) },
      ...(showHowTos
        ? HOW_TOS.map((h) => ({ id: h.id, title: h.title, hint: 'چطور؟', icon: CornerDownLeft, run: close(() => navigate(`${guideTo}#${h.id}`)) }))
        : []),
    ];
  }, [items, guideTo, navigate, onOpenChange, onStartTour, showHowTos]);

  const shown = useMemo(() => {
    const n = norm(q.trim());
    return n ? entries.filter((e) => norm(e.title).includes(n)) : entries;
  }, [entries, q]);

  const setOpen = (v: boolean) => {
    if (!v) { setQ(''); setActive(0); }
    onOpenChange(v);
  };
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); shown[active]?.run(); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70]" style={{ background: 'var(--modal-scrim)', backdropFilter: 'blur(3px)' }} />
        <Dialog.Content
          dir="rtl"
          className="glass glass-strong fixed left-1/2 top-[14vh] z-[70] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden p-2"
          onKeyDown={onKey}
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">جستجو</Dialog.Title>
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ color: 'var(--text-tertiary)' }}>
            <Search size={19} />
            <input
              autoFocus
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              placeholder="اسم صفحه یا کاری که می‌خواهید…"
              className="flex-1 bg-transparent text-[16px] outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <ul ref={list} className="max-h-[52vh] overflow-y-auto border-t pt-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
            {shown.length === 0 && (
              <li className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>چیزی پیدا نشد.</li>
            )}
            {shown.map((e, i) => {
              const Icon = e.icon;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    data-i={i}
                    onMouseMove={() => setActive(i)}
                    onClick={e.run}
                    className={cn('flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-right text-[15px]')}
                    style={{ background: i === active ? 'rgba(255,255,255,.85)' : 'transparent', color: 'var(--text-primary)' }}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-[10px]" style={{ background: 'var(--gold-soft)', color: 'var(--gold-deep)' }}>
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="flex-1">{e.title}</span>
                    <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>{e.hint}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
