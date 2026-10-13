// نقطهٔ ورود حالت آفلاین.
//
// روشن‌کردن:
//   • `VITE_DEMO_MODE=true` در env  (همان کاری که `npm run dev:demo` می‌کند)
//   • یا `?demo=1` روی URL — فقط در حالت توسعه، تا نسخهٔ عملیاتی با یک
//     پارامتر ساده به دادهٔ ساختگی سوییچ نشود.
//
// میان‌برهای URL:
//   ?as=admin | accountant | trader   ورود بی‌رمز با آن نقش
//   ?demo=reset                       پاک‌کردن تغییرات و برگشت به دادهٔ اولیه

import { resetDemo } from './db';
import { signInAs, getDemoSession } from './auth-state';

const params = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams();

const envFlag = String(import.meta.env.VITE_DEMO_MODE ?? '') === 'true';
const urlFlag = import.meta.env.DEV && (params.get('demo') === '1' || params.get('demo') === 'reset');

export const IS_DEMO = envFlag || urlFlag;

const ROLE_IDS: Record<string, string> = {
  admin: 'u-admin-1',
  accountant: 'u-acct-1',
  trader: 'u-trader-1',
};

/** پیش از ساخته‌شدن کلاینت اجرا می‌شود تا نشست آماده باشد */
export function bootstrapDemo(): void {
  if (!IS_DEMO) return;

  if (params.get('demo') === 'reset') {
    resetDemo();
  }

  const as = params.get('as');
  if (as && ROLE_IDS[as]) {
    signInAs(ROLE_IDS[as]);
  }

  if (import.meta.env.DEV) {
    const who = getDemoSession()?.user?.email ?? 'مهمان';
    console.info(
      `%c[دمو] پنل روی دادهٔ ساختگی اجرا می‌شود — کاربر: ${who}`,
      'color:#c08b2f;font-weight:bold',
    );
  }
}

export { resetDemo } from './db';
export { signInAs, emailFor } from './auth-state';
