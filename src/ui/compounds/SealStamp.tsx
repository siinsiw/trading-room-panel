import { useId, useMemo, useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { LOGO_URL } from './brand';

interface SealStampProps {
  /** true که شد، مهر زده می‌شود */
  play: boolean;
  /** بعد از تمام شدن (یا فوراً با «کاهش حرکت») */
  onDone: () => void;
  caption?: string;
}

/** منحنی گل‌سرخی r = R + a·sin(kθ) — پایهٔ نقش گیوشهٔ اسکناس */
function rose(R: number, a: number, k: number, phase: number, steps = 900): string {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = R + a * Math.sin(k * t + phase);
    d += `${i ? 'L' : 'M'}${(r * Math.cos(t)).toFixed(2)},${(r * Math.sin(t)).toFixed(2)}`;
  }
  return `${d}Z`;
}

/**
 * مهر ورود موفق: نشان گاو-خرس روی کارت فرود می‌آید، بعد جوهر طلایی —
 * حلقه‌ها و گیوشه — از مرکز پخش می‌شود (DrawSVG، الگوی «Draw a path»).
 * پوشش کل کارت است؛ والدِ positioned (کارت شیشه‌ای) جایش را تعیین می‌کند.
 */
export function SealStamp({ play, onDone, caption = 'خوش آمدید — در حال باز کردن پنل…' }: SealStampProps) {
  const root = useRef<HTMLDivElement>(null);
  const pathId = `seal-ring-${useId().replace(/:/g, '')}`;
  const petals = useMemo(() => Array.from({ length: 6 }, (_, j) => rose(64, 11, 18, (j * Math.PI) / 9)), []);

  useGSAP(() => {
    if (!play || !root.current) return;
    const el = root.current;
    const seal = el.querySelector('.seal'), wash = el.querySelector('.wash');
    const lines = el.querySelectorAll('.g path'), rims = el.querySelectorAll('.rim');
    const legend = el.querySelector('text'), cap = el.querySelector('.cap');
    const card = el.parentElement?.closest('.auth-card') ?? null;

    const mm = gsap.matchMedia();
    mm.add({ ok: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
      gsap.set(el, { autoAlpha: 1 });
      if (ctx.conditions?.reduce) {
        gsap.set([wash, seal, legend, cap], { autoAlpha: 1 });
        const id = setTimeout(onDone, 400);
        return () => clearTimeout(id);
      }
      gsap.set([lines, rims], { drawSVG: '0%' });
      gsap.set([legend, cap], { autoAlpha: 0 });
      const tl = gsap.timeline({ onComplete: onDone });
      tl.to(wash, { autoAlpha: 1, duration: 0.4 })
        // مهر از بالا پایین می‌آید و روی کاغذ می‌نشیند
        .fromTo(seal, { scale: 1.7, autoAlpha: 0, rotation: -8 }, { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.42, ease: 'power4.in' }, '<0.1')
        .to(seal, { scale: 0.96, duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.out' });
      if (card) tl.to(card, { y: 3, duration: 0.08, yoyo: true, repeat: 1 }, '<');
      // جوهر طلایی پخش می‌شود: لبه‌ها، بعد گیوشه از مرکز به بیرون
      tl.to(rims, { drawSVG: '100%', duration: 0.7, stagger: 0.08, ease: 'power2.out' })
        .to(lines, { drawSVG: '100%', duration: 1.2, stagger: 0.05, ease: 'power1.inOut' }, '<0.1')
        .to(legend, { autoAlpha: 1, duration: 0.5 }, '<0.4')
        .to(cap, { autoAlpha: 1, y: -4, duration: 0.5 }, '<0.3')
        .to({}, { duration: 0.5 }); // یک مکث کوتاه تا مهر دیده شود
      return () => { tl.kill(); };
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [play], revertOnUpdate: true });

  return (
    <div ref={root} aria-hidden={!play} className="pointer-events-none absolute inset-0 z-[6] grid place-items-center" style={{ visibility: 'hidden' }}>
      <div className="wash absolute inset-0 rounded-[inherit]" style={{ background: 'rgba(255,252,244,.88)', borderRadius: 'var(--radius-lg)', opacity: 0 }} />
      <div className="seal relative h-[230px] w-[230px]">
        <svg viewBox="-115 -115 230 230" className="absolute inset-0 h-full w-full overflow-visible">
          <defs><path id={pathId} d="M 0,93 A 93,93 0 1 1 0.01,93" /></defs>
          <g className="g">
            {petals.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--gold)" strokeWidth={0.7} opacity={0.9} />)}
          </g>
          <circle className="rim" r={108} fill="none" stroke="var(--gold-deep)" strokeWidth={2} />
          <circle className="rim" r={103} fill="none" stroke="var(--gold)" strokeWidth={0.8} />
          <circle className="rim" r={84} fill="none" stroke="var(--gold)" strokeWidth={0.8} />
          {/* نوشتهٔ راست‌به‌چپ روی مسیر: وسط‌چین، وگرنه از ابتدای مسیر بیرون می‌افتد */}
          <text textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--gold-deep)" style={{ fontFamily: 'var(--font-ui)' }}>
            <textPath href={`#${pathId}`} startOffset="50%">✦ اتاق معاملات تی‌تی ✦ اتاق معاملات تی‌تی ✦</textPath>
          </text>
        </svg>
        <img src={LOGO_URL} alt="" className="absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-[22px]" />
      </div>
      <p className="cap absolute inset-x-0 bottom-8 text-center text-[17px] font-bold" style={{ color: 'var(--text-primary)', opacity: 0 }}>{caption}</p>
    </div>
  );
}
