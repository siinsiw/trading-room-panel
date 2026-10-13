import { useId, useRef } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { gsap, useGSAP } from '@/lib/gsap';
import { toFa } from '@/lib/persian';

export interface PricePoint {
  /** دقیقه از نیمه‌شب به وقت تهران */
  minute: number;
  price: number;
  qty?: number;
}

interface PriceChartProps {
  data: PricePoint[];
  /** دقیقهٔ شروع محور (پیش‌فرض ۹:۰۰) */
  openMinute?: number;
  /** دقیقهٔ قفل امروزی (پیش‌فرض ۱۳:۳۰) */
  lockMinute?: number;
  height?: number | `${number}%`;
}

const money = (n: number) => toFa(Math.round(n).toLocaleString('en-US')).replace(/,/g, '٬');
const hhmm = (m: number) => toFa(`${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`);

function GlassTip({ active, payload }: { active?: boolean; payload?: { payload: PricePoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div
      className="rounded-xl px-3 py-2 text-[13px]"
      style={{ background: 'rgba(27,24,19,.92)', color: '#F6EBD2', boxShadow: '0 12px 24px -10px rgba(27,24,19,.5)', direction: 'rtl' }}
    >
      <b className="text-[16px] text-white">{money(p.price)}</b> تومان · {hhmm(p.minute)}
      {p.qty ? <span className="opacity-70"> · {toFa(p.qty)} واحد</span> : null}
    </div>
  );
}

/**
 * نمودار تک‌رنگ قیمت روز — سبک «single-ink» از mono-charts، روی Recharts 3.
 * خط موقع ورود کشیده می‌شود (الگوی Draw a path در GSAP) و آخرین معامله
 * یک نقطهٔ تپنده دارد تا «زنده بودن» دیده شود.
 */
export function PriceChart({ data, openMinute = 540, lockMinute = 810, height = '100%' }: PriceChartProps) {
  const root = useRef<HTMLDivElement>(null);
  const fillId = useId().replace(/:/g, '');
  const drawn = useRef(false);
  const last = data.at(-1);
  const xMin = Math.min(openMinute, data[0]?.minute ?? openMinute);
  const xMax = Math.max(lockMinute, last?.minute ?? lockMinute) + 5;
  // یک برچسب برای هر ساعت کامل در بازه — معاملهٔ فردایی بعد از قفل هم برچسب دارد
  const ticks: number[] = [];
  for (let t = Math.ceil(xMin / 60) * 60; t <= xMax; t += 60) ticks.push(t);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // کشیدن خط فقط بار اول؛ با هر معاملهٔ تازه دوباره کشیده نمی‌شود
        const line = root.current?.querySelector<SVGPathElement>('.recharts-area-curve');
        if (line && !drawn.current) {
          drawn.current = true;
          const len = line.getTotalLength();
          gsap.fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, {
            strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut',
            // بعد از کشیدن پاک شود، وگرنه با تغییر اندازه طول مسیر عوض می‌شود و خط بریده می‌ماند
            clearProps: 'strokeDasharray,strokeDashoffset',
          });
          gsap.from(root.current!.querySelector('.recharts-area-area'), { autoAlpha: 0, duration: 1, delay: 0.8 });
        }
        const halo = root.current?.querySelector('.live-halo');
        if (halo) gsap.fromTo(halo, { scale: 0.4, opacity: 1 }, { scale: 1.9, opacity: 0, duration: 1.6, repeat: -1, ease: 'power1.out', transformOrigin: '50% 50%' });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [data.length], revertOnUpdate: true },
  );

  if (data.length < 2) {
    return (
      <div className="grid h-full min-h-[220px] place-items-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
        هنوز معامله‌ای امروز ثبت نشده — اولین معامله که بیاید، نمودار کشیده می‌شود.
      </div>
    );
  }

  return (
    <div ref={root} className="h-full min-h-[240px] w-full" style={{ direction: 'ltr' }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C8962F" stopOpacity={0.34} />
              <stop offset="100%" stopColor="#C8962F" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(70,52,20,.09)" strokeDasharray="2 5" />
          <XAxis
            dataKey="minute" type="number" domain={[xMin, xMax]}
            ticks={ticks}
            tickFormatter={hhmm} axisLine={false} tickLine={false}
            tick={{ fill: 'var(--text-tertiary)', fontSize: 12.5, fontFamily: 'var(--font-num)' }}
          />
          <YAxis
            orientation="right" domain={['dataMin - 150', 'dataMax + 150']} width={70}
            tickFormatter={money} axisLine={false} tickLine={false} tickCount={5}
            tick={{ fill: 'var(--text-tertiary)', fontSize: 12.5, fontFamily: 'var(--font-num)' }}
          />
          <ReferenceLine
            x={lockMinute} stroke="var(--semantic-sell)" strokeOpacity={0.5} strokeDasharray="3 4"
            label={{ value: `قفل ${hhmm(lockMinute)}`, position: 'insideTopLeft', fill: 'var(--semantic-sell)', fontSize: 12.5, fontFamily: 'var(--font-ui)' }}
          />
          <Tooltip
            content={<GlassTip />}
            cursor={{ stroke: 'var(--text-primary)', strokeOpacity: 0.25, strokeDasharray: '3 4' }}
          />
          <Area
            type="monotone" dataKey="price" stroke="#A97A1E" strokeWidth={2.4} fill={`url(#${fillId})`}
            isAnimationActive={false}
            activeDot={{ r: 5, fill: '#fff', stroke: '#A97A1E', strokeWidth: 2.5 }}
            dot={(props: { cx?: number; cy?: number; index?: number }) =>
              props.index === data.length - 1 && props.cx != null && props.cy != null ? (
                <g key="live">
                  <circle className="live-halo" cx={props.cx} cy={props.cy} r={11} fill="#C8962F" fillOpacity={0.3} />
                  <circle cx={props.cx} cy={props.cy} r={4.5} fill="#8A6114" stroke="#fff" strokeWidth={2} />
                </g>
              ) : <g key={props.index} />
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
