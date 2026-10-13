import type { RefObject } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

/**
 * نور طلایی ملایمی که روی کارت شیشه‌ای دنبال اشاره‌گر می‌آید.
 * متغیرهای --mx / --my / --spot را روی خود عنصر می‌نشاند و
 * `.glass::before` در globals.css آن‌ها را می‌خواند.
 *
 * quickTo یک tween را بازمصرف می‌کند — برای حرکت موس tween تازه ساخته نمی‌شود.
 * روی لمسی و برای کاربرِ «حرکت کمتر» کاملاً خاموش است.
 */
export function useSpotlight(ref: RefObject<HTMLElement | null>, enabled = true) {
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || !enabled) return;
      const mm = gsap.matchMedia();
      mm.add('(pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
        const p = { x: 0, y: 0 };
        const paint = () => {
          el.style.setProperty('--mx', `${p.x}px`);
          el.style.setProperty('--my', `${p.y}px`);
        };
        const xTo = gsap.quickTo(p, 'x', { duration: 0.5, ease: 'power3', onUpdate: paint });
        const yTo = gsap.quickTo(p, 'y', { duration: 0.5, ease: 'power3', onUpdate: paint });
        const enter = () => gsap.to(el, { '--spot': 1, duration: 0.4, overwrite: 'auto' });
        const leave = () => gsap.to(el, { '--spot': 0, duration: 0.6, overwrite: 'auto' });
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          xTo(e.clientX - r.left);
          yTo(e.clientY - r.top);
        };
        el.addEventListener('pointerenter', enter);
        el.addEventListener('pointerleave', leave);
        el.addEventListener('pointermove', move);
        return () => {
          el.removeEventListener('pointerenter', enter);
          el.removeEventListener('pointerleave', leave);
          el.removeEventListener('pointermove', move);
        };
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [enabled] },
  );
}
