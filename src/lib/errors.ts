const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials':         'ایمیل یا رمز عبور اشتباه است.',
  'Email not confirmed':               'ایمیل شما هنوز تأیید نشده است. لینک تأیید را چک کنید.',
  'User already registered':           'این ایمیل قبلاً ثبت‌نام کرده است.',
  'Password should be at least 6 characters': 'رمز عبور باید حداقل ۶ کاراکتر باشد.',
  'Email rate limit exceeded':         'تعداد درخواست‌ها زیاد است. لطفاً چند دقیقه صبر کنید.',
  'Token has expired or is invalid':   'لینک منقضی شده است. مجدداً درخواست کنید.',
  'New password should be different from the old password': 'رمز جدید باید با رمز قدیم فرق داشته باشد.',
};

const DB_ERRORS: Record<string, string> = {
  '23505': 'این اطلاعات قبلاً ثبت شده است.',
  '23503': 'رکورد مرتبط یافت نشد.',
  '42501': 'دسترسی کافی ندارید.',
  'PGRST116': 'رکورد یافت نشد.',
  'PGRST301': 'دسترسی کافی ندارید.',
};

export function parseError(err: unknown): string {
  if (!err) return 'خطای ناشناخته رخ داد.';

  if (typeof err === 'string') {
    return AUTH_ERRORS[err] ?? err;
  }

  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;

    // Supabase Auth error
    if (typeof e['message'] === 'string') {
      const msg = e['message'] as string;
      if (AUTH_ERRORS[msg]) return AUTH_ERRORS[msg];

      // DB error code
      const code = (e['code'] as string) ?? '';
      if (DB_ERRORS[code]) return DB_ERRORS[code];

      // Hint from postgres
      if (typeof e['hint'] === 'string') return e['hint'] as string;

      return msg;
    }
  }

  return 'خطایی رخ داد. اگر تکرار شد با ادمین تماس بگیرید.';
}
