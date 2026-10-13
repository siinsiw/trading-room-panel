import { useId, useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface SemiGaugeProps {
  /** ۰ تا ۱۰۰ */
  value: number;
  warnAt: number;
  callAt: number;
  children?: React.ReactNode;
}

const CX = 150, CY = 140;
const polar = (r: number, v: number): [number, number] => {
  const a = Math.PI * (1 - v / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};
const arc = (r: number, a: number, b: number) => {
  const [x1, y1] = polar(r, a), [x2, y2] = polar(r, b);
  return `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`;
};

/**
 * عقربهٔ نیم‌دایره با سه ناحیهٔ امن / هشدار / حراج روی لبهٔ بیرونی.
 * کمان مقدار با strokeDashoffset جارو می‌شود (همان روش «Draw a path» در GSAP،
 * بی‌نیاز از پلاگین DrawSVG).
 */
export function SemiGauge({ value, warnAt, callAt, children }: SemiGaugeProps) {
  const root = useRef<SVGSVGElement>(null);
  const prev = useRef(0);
  const gid = useId().replace(/:/g, '');
  const v = Math.max(0, Math.min(100, value));

  useGSAP(
    () => {
      const p = root.current?.querySelector<SVGPathElement>('.val-arc');
      if (!p) return;
      const len = p.getTotalLength();
      const mm = gsap.matchMedia();
      mm.add({ ok: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        gsap.fromTo(
          p,
          { strokeDasharray: len, strokeDashoffset: len * (1 - prev.current / 100) },
          { strokeDashoffset: len * (1 - v / 100), duration: ctx.conditions?.reduce ? 0 : 1.4, ease: 'power3.out' },
        );
      });
      prev.current = v;
      return () => mm.revert();
    },
    { scope: root, dependencies: [v], revertOnUpdate: true },
  );

  const zones: [number, number, string][] = [
    [0, warnAt - 0.6, '#E9D7AE'],
    [warnAt + 0.6, callAt - 0.6, 'var(--amber)'],
    [callAt + 0.6, 100, 'var(--semantic-sell)'],
  ];

  return (
    <div className="relative grid h-[150px] place-items-end justify-center">
      <svg ref={root} viewBox="0 0 300 150" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" x2="1">
            <stop offset="0" stopColor="var(--gold-deep)" />
            <stop offset="1" stopColor="var(--amber)" />
          </linearGradient>
        </defs>
        {zones.map(([a, b, c]) => (
          <path key={a} d={arc(128, a, b)} stroke={c} strokeWidth={4} fill="none" strokeLinecap="round" />
        ))}
        <path d={arc(112, 0, 100)} stroke="rgba(70,52,20,.08)" strokeWidth={18} fill="none" strokeLinecap="round" />
        <path className="val-arc" d={arc(112, 0, 100)} stroke={`url(#${gid})`} strokeWidth={18} fill="none" strokeLinecap="round" />
        {[warnAt, callAt].map((t) => {
          const [x1, y1] = polar(104, t), [x2, y2] = polar(122, t);
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--text-primary)" strokeOpacity={0.35} strokeWidth={1.5} />;
        })}
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}
