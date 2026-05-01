import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { parseError } from '@/lib/errors';

interface LocationState {
  email?: string;
}

export default function VerifyEmailPage() {
  const location = useLocation();
  const state = location.state as LocationState | null;
  const email = state?.email ?? '';

  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error('ایمیل موجود نیست. لطفاً مجدداً ثبت‌نام کنید.');
      return;
    }

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) {
        toast.error(parseError(error));
      } else {
        toast.success('ایمیل تأیید مجدداً ارسال شد');
      }
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="text-center">
      {/* Mail icon */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{
          background: 'linear-gradient(135deg, var(--accent-gold-dim), var(--accent-gold))',
        }}
      >
        <svg className="w-8 h-8 text-black" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M2 8l10 6 10-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        ایمیل خود را چک کنید
      </h1>

      <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
        یک ایمیل تأیید به آدرس زیر ارسال شده است:
      </p>

      {email && (
        <p
          className="text-sm font-medium mb-5 rounded-lg px-3 py-1.5 inline-block"
          dir="ltr"
          style={{
            color: 'var(--accent-gold)',
            backgroundColor: 'rgba(212,162,76,0.08)',
            border: '1px solid rgba(212,162,76,0.2)',
          }}
        >
          {email}
        </p>
      )}

      <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
        روی لینک داخل ایمیل کلیک کنید تا حساب شما فعال شود. اگر ایمیلی دریافت نکردید، پوشه اسپم را بررسی کنید.
      </p>

      {/* Resend button */}
      <button
        type="button"
        onClick={handleResend}
        disabled={resending || !email}
        className="w-full py-2.5 rounded-lg font-bold text-sm transition-opacity mb-4 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
      >
        {resending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            در حال ارسال…
          </span>
        ) : (
          'ارسال مجدد'
        )}
      </button>

      <Link
        to="/auth/login"
        className="text-sm hover:underline"
        style={{ color: 'var(--text-tertiary)' }}
      >
        ← بازگشت به ورود
      </Link>
    </div>
  );
}
