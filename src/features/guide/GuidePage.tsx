import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, CirclePlay, Search } from 'lucide-react';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';
import { useAuthStore } from '@/stores/auth.store';
import { GlassCard } from '@/ui/primitives/GlassCard';
import { navForRole } from '@/ui/layouts/shell/nav';
import { DAY_FLOW, HOW_TOS, PAGE_INTRO, type HowTo } from './content';

/**
 * صفحهٔ راهنما — سه بخش با سه ریتم متفاوت:
 *   «یک روز در اتاق»  خط زمانی عمودی؛ خطش با اسکرول کشیده می‌شود (ScrollTrigger scrub)
 *   «چطور…؟»         آکاردئون با ارتفاع خودکار (الگوی Animate auto height در GSAP)
 *   «همهٔ صفحه‌ها»    فهرست دوستونه، نه کارت — فقط اسم و یک جمله
 */
export default function GuidePage() {
  const role = useAuthStore((s) => s.profile?.role ?? null);
  const navigate = useNavigate();
  const { hash } = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const isAdmin = role === 'admin';
  const home = isAdmin ? '/admin/dashboard' : '/accountant/reports';

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // خط زمانی همراه اسکرول پر می‌شود — نشان می‌دهد کجای روز هستید
      gsap.fromTo('.day-line-fill', { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: '.day-flow', start: 'top 70%', end: 'bottom 60%', scrub: 0.6 },
      });
      gsap.utils.toArray<HTMLElement>('.day-step').forEach((el) => {
        gsap.from(el, {
          x: -18, autoAlpha: 0, duration: 0.6,
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' },
        });
      });
      gsap.from('.guide-intro > *', { y: 16, autoAlpha: 0, stagger: 0.07, duration: 0.6 });
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root} className="grid grid-cols-12 gap-[18px]" dir="rtl">
      <GlassCard className="guide-intro col-span-12 flex flex-wrap items-end gap-6 p-7"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.8), rgba(255,246,226,.55))' }}>
        <div className="min-w-[280px] flex-1">
          <p className="text-[14px] font-bold" style={{ color: 'var(--gold-deep)' }}>راهنمای اتاق معاملات</p>
          <h2 className="mt-1 text-[34px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>هر کاری، قدم‌به‌قدم</h2>
          <p className="mt-2 max-w-[640px] text-[16px] leading-8" style={{ color: 'var(--text-secondary)' }}>
            کار روزانه در پنل کوتاه است: صبح نگاهی به مزنه، در طول روز «نیاز به رسیدگی»، و ساعت ۱۳:۳۰ تصفیه.
            هر جای پنل گم شدید، دکمهٔ «راهنما» بالای صفحه همان صفحه را برایتان توضیح می‌دهد.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button" onClick={() => navigate(`${home}?tour=1`)}
            className="flex h-12 items-center gap-2 rounded-[14px] px-5 text-[15.5px] font-bold"
            style={{ color: '#FFF8E8', background: 'linear-gradient(180deg, #2C261C, #17140F)', boxShadow: '0 10px 20px -10px rgba(27,24,19,.6)' }}
          >
            <CirclePlay size={18} /> تور یک‌دقیقه‌ای پنل
          </button>
          <span className="flex h-12 items-center gap-2 rounded-[14px] px-4 text-[14.5px]" style={{ background: 'var(--surface-tint)', color: 'var(--text-secondary)' }}>
            <Search size={16} /> هر جا: <kbd className="font-bold" style={{ fontFamily: 'inherit' }}>Ctrl K</kbd>
          </span>
        </div>
      </GlassCard>

      {/* ── یک روز در اتاق ─────────────────────────────────────────────── */}
      <GlassCard className="col-span-12 p-7 xl:col-span-7">
        <h3 className="text-[22px] font-bold" style={{ color: 'var(--text-primary)' }}>یک روز در اتاق</h3>
        <p className="mb-6 text-[14.5px]" style={{ color: 'var(--text-tertiary)' }}>از باز شدن بازار تا بعد از تصفیه</p>
        <ol className="day-flow relative ps-0">
          <span aria-hidden className="absolute bottom-3 right-[52px] top-3 w-[2px] rounded-full" style={{ background: 'var(--border-subtle)' }} />
          <span aria-hidden className="day-line-fill absolute bottom-3 right-[52px] top-3 w-[2px] origin-top rounded-full" style={{ background: 'linear-gradient(var(--gold), var(--amber))' }} />
          {DAY_FLOW.map((s) => (
            <li key={s.title} className="day-step relative grid grid-cols-[104px_1fr] gap-4 pb-7 last:pb-0">
              <div className="relative text-center">
                <span className="relative z-[1] inline-block rounded-[10px] px-2 py-1 text-[15px] font-bold leading-tight"
                  style={{ background: 'var(--paper)', color: 'var(--gold-deep)', boxShadow: 'inset 0 0 0 1px rgba(200,150,47,.35)', fontFamily: 'var(--font-num)' }}>
                  {s.time}
                </span>
              </div>
              <div>
                <h4 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>{s.title}</h4>
                <p className="mt-1 text-[15px] leading-8" style={{ color: 'var(--text-secondary)' }}>{s.body}</p>
                {s.to && s.cta && isAdmin && (
                  <Link to={s.to} className="mt-2 inline-flex items-center gap-1.5 text-[14.5px] font-bold hover:underline" style={{ color: 'var(--gold-deep)' }}>
                    {s.cta} <ArrowLeft size={15} />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </GlassCard>

      {/* ── چطور…؟ ────────────────────────────────────────────────────── */}
      <div className="col-span-12 xl:col-span-5">
        <GlassCard className="p-7 xl:sticky xl:top-4">
          <h3 className="text-[22px] font-bold" style={{ color: 'var(--text-primary)' }}>چطور…؟</h3>
          <p className="mb-4 text-[14.5px]" style={{ color: 'var(--text-tertiary)' }}>کارهای رایج، هرکدام در چند قدم</p>
          {isAdmin
            ? <HowToList key={hash} items={HOW_TOS} openId={hash.slice(1)} />
            : <p className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>کارهای حسابدار در صفحه‌های «گزارش» و «تصفیه‌ها» است؛ هر کدام دکمهٔ «راهنما» خودش را دارد.</p>}
        </GlassCard>
      </div>

      {/* ── همهٔ صفحه‌ها ─────────────────────────────────────────────── */}
      <GlassCard className="col-span-12 p-7">
        <h3 className="mb-4 text-[22px] font-bold" style={{ color: 'var(--text-primary)' }}>همهٔ صفحه‌ها</h3>
        <div className="grid gap-x-10 gap-y-1 md:grid-cols-2">
          {navForRole(role).map((g) => (
            <section key={g.title} className="mb-3">
              <p className="mb-1 text-[13px] font-bold" style={{ color: 'var(--text-tertiary)' }}>{g.title}</p>
              {g.items.map((it) => {
                const Icon = it.icon;
                return (
                  <Link key={it.to} to={it.to} className="group flex items-start gap-3 rounded-[12px] px-2 py-2.5 transition-colors hover:bg-white/70">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px]" style={{ background: 'var(--gold-soft)', color: 'var(--gold-deep)' }}>
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="flex-1">
                      <b className="block text-[15.5px]" style={{ color: 'var(--text-primary)' }}>{it.full}</b>
                      <span className="text-[14px] leading-7" style={{ color: 'var(--text-secondary)' }}>{PAGE_INTRO[it.to]?.body}</span>
                    </span>
                    <ArrowLeft size={16} className="mt-2 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--gold-deep)' }} />
                  </Link>
                );
              })}
            </section>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

/** آکاردئون — ارتفاع خودکار با GSAP؛ هر بار یکی باز است.
 *  با عوض شدن #hash دوباره mount می‌شود (key) تا همان مورد باز شود. */
function HowToList({ items, openId }: { items: HowTo[]; openId: string }) {
  const [open, setOpen] = useState<string | null>(openId || items[0]?.id || null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const reduce = prefersReducedMotion();
    el.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => {
      const on = p.dataset.panel === open;
      gsap.to(p, { height: on ? 'auto' : 0, autoAlpha: on ? 1 : 0, duration: reduce ? 0 : 0.4, ease: 'power2.inOut', overwrite: true });
    });
    el.querySelectorAll<HTMLElement>('[data-chevron]').forEach((c) => {
      gsap.to(c, { rotation: c.dataset.chevron === open ? 180 : 0, duration: reduce ? 0 : 0.3, overwrite: true });
    });
    if (openId && open === openId) el.querySelector(`#${CSS.escape(openId)}`)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    return () => { gsap.killTweensOf(el.querySelectorAll('[data-panel],[data-chevron]')); };
  }, [open, openId]);

  return (
    <ul ref={list} className="flex flex-col">
      {items.map((h) => (
        <li key={h.id} id={h.id} className="border-t first:border-t-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            type="button" aria-expanded={open === h.id}
            onClick={() => setOpen((o) => (o === h.id ? null : h.id))}
            className="flex w-full items-center gap-3 py-3.5 text-right text-[16px] font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            <span className="flex-1">{h.title}</span>
            <span data-chevron={h.id} className="inline-flex" style={{ color: 'var(--text-tertiary)' }}><ChevronDown size={18} /></span>
          </button>
          <div data-panel={h.id} className="overflow-hidden" style={{ height: 0, opacity: 0, visibility: 'hidden' }}>
            <ol className="mb-4 flex flex-col gap-2 ps-1">
              {h.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-7" style={{ color: 'var(--text-secondary)' }}>
                  <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-bold"
                    style={{ background: 'var(--gold-soft)', color: 'var(--gold-deep)', fontFamily: 'var(--font-num)' }}>
                    {(i + 1).toLocaleString('fa-IR')}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            {h.to && (
              <Link to={h.to} className="mb-4 inline-flex items-center gap-1.5 text-[14.5px] font-bold hover:underline" style={{ color: 'var(--gold-deep)' }}>
                رفتن به همین صفحه <ArrowLeft size={15} />
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
