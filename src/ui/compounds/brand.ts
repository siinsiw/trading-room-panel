// آدرس دارایی‌های برند.
//
// جدا از Logo.tsx نگه داشته شده تا آن فایل فقط کامپوننت export کند و
// Fast Refresh نشکند (قاعدهٔ react-refresh/only-export-components).
//
// هر دو قبلاً مستقیم به Supabase Storage پروژهٔ قدیم سنجاق بودند؛ با رفتن
// آن پروژه هر دو ۴۰۴ شدند. از ۲۰۲۶-۱۰-۱۴ خود فایل‌ها در public/brand هستند
// (طراحی با ChatGPT: نشان گاو-خرس، و حکاکی گاو و خرس برای صفحهٔ ورود).
// env هنوز می‌تواند جایگزینشان کند. `||` نه `??`: env خالی هم یعنی پیش‌فرض.

export const LOGO_URL = (import.meta.env.VITE_LOGO_URL as string | undefined) || '/brand/logo.webp';

/** پس‌زمینهٔ صفحات ورود */
export const LOGIN_BG_URL = (import.meta.env.VITE_LOGIN_BG_URL as string | undefined) || '/brand/login-bg.webp';
