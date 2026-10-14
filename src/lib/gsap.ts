// تنها جای ثبت پلاگین‌های GSAP — هر کامپوننتی gsap را از اینجا بگیرد،
// نه مستقیم از 'gsap'، تا پلاگین‌ها پیش از اولین useGSAP ثبت شده باشند.
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, Flip, ScrollTrigger, DrawSVGPlugin, MorphSVGPlugin, SplitText);
gsap.defaults({ ease: 'power3.out', duration: 0.6 });

/** کاربرانی که حرکت کم خواسته‌اند — برای شاخه‌های بیرون از matchMedia. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export { gsap, Flip, ScrollTrigger, DrawSVGPlugin, MorphSVGPlugin, SplitText, useGSAP };
