const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials':         'ایمیل یا رمز عبور اشتباه است.',
  'Email not confirmed':               'ایمیل شما هنوز تأیید نشده است. لینک تأیید را چک کنید.',
  'User already registered':           'این ایمیل قبلاً ثبت‌نام کرده است.',
  'Password should be at least 6 characters': 'رمز عبور باید حداقل ۶ کاراکتر باشد.',
  'Email rate limit exceeded':         'تعداد درخواست‌ها زیاد است. لطفاً چند دقیقه صبر کنید.',
  'Token has expired or is invalid':   'لینک منقضی شده است. مجدداً درخواست کنید.',
  'New password should be different from the old password': 'رمز جدید باید با رمز قدیم فرق داشته باشد.',
  'Invalid Refresh Token: Refresh Token Not Found': 'نشست شما منقضی شده. دوباره وارد شوید.',
  'Auth session missing!':             'نشست شما منقضی شده. دوباره وارد شوید.',
};

// خطای شبکه — مرورگرها هر کدام متن خودشان را می‌دهند و هیچ‌کدام کدی
// ندارند که بشود روی آن سوییچ کرد، پس با زیررشته تشخیص می‌دهیم.
// این حالت واقعاً پیش می‌آید: قطعی اینترنت، فیلترینگ، یا از کار افتادن
// سرویس Supabase. بدون این نگاشت، کاربر فارسی «Failed to fetch» می‌بیند.
const NETWORK_HINTS = [
  'failed to fetch',
  'networkerror',
  'network request failed',
  'load failed',
  'err_internet_disconnected',
  'err_name_not_resolved',
  'fetch failed',
  'timeout',
  'aborted',
];

function isNetworkError(msg: string): boolean {
  const m = msg.toLowerCase();
  return NETWORK_HINTS.some((h) => m.includes(h));
}

const NETWORK_MESSAGE =
  'ارتباط با سرور برقرار نشد. اینترنت خود را چک کنید؛ اگر وصل است، سرویس موقتاً در دسترس نیست.';

const DB_ERRORS: Record<string, string> = {
  '23505': 'این اطلاعات قبلاً ثبت شده است.',
  '23503': 'رکورد مرتبط یافت نشد.',
  '42501': 'دسترسی کافی ندارید.',
  'PGRST116': 'رکورد یافت نشد.',
  'PGRST301': 'دسترسی کافی ندارید.',
};

export function parseError(err: unknown): string {
  if (!err) return 'خطای ناشناخته رخ داد.';

  // برای دیباگ، در کنسول لاگ کامل می‌گذاریم
  // eslint-disable-next-line no-console
  console.error('[parseError]', err);

  if (typeof err === 'string') {
    if (AUTH_ERRORS[err]) return AUTH_ERRORS[err];
    if (isNetworkError(err)) return NETWORK_MESSAGE;
    return err;
  }

  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;

    if (typeof e['message'] === 'string') {
      const msg = e['message'] as string;
      if (AUTH_ERRORS[msg]) return AUTH_ERRORS[msg];
      if (isNetworkError(msg)) return NETWORK_MESSAGE;

      const code = (e['code'] as string) ?? '';
      if (DB_ERRORS[code]) return DB_ERRORS[code];

      // Postgres errors معمولاً message + hint + details دارند
      const hint    = typeof e['hint']    === 'string' ? e['hint']    as string : '';
      const details = typeof e['details'] === 'string' ? e['details'] as string : '';

      // اگر message کلی است (مثل hint) و details جزئیات دارد، با هم نشان بده
      const parts = [msg, details, hint].filter(Boolean).filter((p, i, a) => a.indexOf(p) === i);
      return parts.join(' • ');
    }
  }

  return 'خطایی رخ داد. اگر تکرار شد با ادمین تماس بگیرید.';
}
