// آدرس دارایی‌های برند.
//
// جدا از Logo.tsx نگه داشته شده تا آن فایل فقط کامپوننت export کند و
// Fast Refresh نشکند (قاعدهٔ react-refresh/only-export-components).
//
// هر دو قبلاً مستقیم به Supabase Storage پروژهٔ قدیم سنجاق بودند؛ با رفتن
// آن پروژه هر دو ۴۰۴ شدند. حالا از env می‌آیند و خالی‌بودن‌شان مجاز است.

export const LOGO_URL = (import.meta.env.VITE_LOGO_URL as string | undefined) ?? '';

/** پس‌زمینهٔ صفحات ورود — خالی یعنی فقط رنگ/گرادیان تم */
export const LOGIN_BG_URL = (import.meta.env.VITE_LOGIN_BG_URL as string | undefined) ?? '';
