import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { parseError } from '@/lib/errors';
import { cn } from '@/lib/cn';

const schema = z.object({
  email: z.string().email('ایمیل معتبر وارد کنید'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState('');
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: window.location.origin + '/auth/reset-password',
      });

      if (error) {
        setServerError(parseError(error));
        return;
      }

      setSent(true);
    } catch (err) {
      setServerError(parseError(err));
    }
  };

  const inputBase =
    'w-full rounded-lg px-4 py-2.5 text-sm bg-transparent border transition-colors focus:outline-none focus:ring-offset-0';

  if (sent) {
    return (
      <div className="text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
        >
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--semantic-success)' }}>
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          ایمیل ارسال شد
        </h1>
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
          ایمیل بازیابی ارسال شد. صندوق ورودی خود را چک کنید.
        </p>
        <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
          اگر ایمیلی دریافت نکردید، پوشه اسپم را بررسی کنید.
        </p>

        <Link
          to="/auth/login"
          className="inline-block text-sm font-medium hover:underline"
          style={{ color: 'var(--accent-gold)' }}
        >
          ← بازگشت به ورود
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        بازیابی رمز عبور
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
        ایمیل حساب خود را وارد کنید. لینک بازیابی برای شما ارسال می‌شود.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
            ایمیل
          </label>
          <input
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            dir="ltr"
            {...register('email')}
            className={cn(
              inputBase,
              errors.email
                ? 'border-[var(--semantic-danger)]'
                : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
            )}
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-gold)'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = ''; }}
          />
          {errors.email && (
            <p className="mt-1 text-xs" role="alert" style={{ color: 'var(--semantic-danger)' }}>
              {errors.email.message}
            </p>
          )}
        </div>

        {serverError && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            role="alert"
            style={{
              color: 'var(--semantic-danger)',
              backgroundColor: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'w-full py-2.5 rounded-lg font-bold text-sm transition-opacity',
            isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90',
          )}
          style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              در حال ارسال…
            </span>
          ) : (
            'ارسال لینک بازیابی'
          )}
        </button>
      </form>

      <div className="mt-5 text-center">
        <Link
          to="/auth/login"
          className="text-sm hover:underline"
          style={{ color: 'var(--accent-gold)' }}
        >
          ← بازگشت به ورود
        </Link>
      </div>
    </div>
  );
}
