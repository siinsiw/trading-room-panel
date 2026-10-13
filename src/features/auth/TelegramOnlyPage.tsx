// صفحه‌ای که معامله‌گر — اگر به هر دلیلی وارد پنل شود — می‌بیند.
//
// تصمیم کارفرما (۲۰۲۶-۰۹-۲۲): کاربر عادی هرگز وارد سایت نمی‌شود؛ پنل
// فقط داشبورد مدیریتی است. حساب‌های معامله‌گر با ایمیل ساختگی ساخته
// می‌شوند و رمزشان به کسی داده نمی‌شود، ولی حساب‌های قدیمی هنوز رمز
// دارند — پس این مسیر باید بسته باشد، نه فقط پنهان.

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export default function TelegramOnlyPage() {
  const { signOut } = useAuthStore();

  // نشست را همین‌جا می‌بندیم تا کاربر در حالت نیمه‌واردشده نماند.
  useEffect(() => { void signOut(); }, [signOut]);

  return (
    <div className="text-center">
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--accent-wash)', color: 'var(--accent-gold)' }}
      >
        <Send size={22} />
      </div>

      <h1 className="mb-2 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
        معاملات در تلگرام انجام می‌شود
      </h1>

      <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        این پنل فقط برای مدیر و حسابدار اتاق است.
        <br />
        برای دیدن وضعیت حساب، ودیعه و معاملات، به ربات تلگرام بروید و
        <span className="font-bold" style={{ color: 'var(--text-primary)' }}> /start </span>
        را بزنید.
      </p>

      <Link
        to="/auth/login"
        className="inline-block text-sm hover:underline"
        style={{ color: 'var(--accent-gold)' }}
      >
        ورود با حساب مدیریتی
      </Link>
    </div>
  );
}
