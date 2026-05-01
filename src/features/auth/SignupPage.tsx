import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { parseError } from '@/lib/errors';
import { cn } from '@/lib/cn';

const schema = z
  .object({
    full_name: z.string().min(2, 'نام کامل باید حداقل ۲ کاراکتر باشد'),
    phone: z
      .string()
      .regex(/^09\d{9}$/, 'شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)'),
    telegram_id: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^@?[A-Za-z0-9_]{5,32}$/.test(v),
        'آیدی تلگرام معتبر نیست',
      ),
    email: z.string().email('ایمیل معتبر وارد کنید'),
    password: z
      .string()
      .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد')
      .regex(/[A-Z]/, 'رمز عبور باید حداقل یک حرف بزرگ داشته باشد')
      .regex(/[0-9]/, 'رمز عبور باید حداقل یک عدد داشته باشد'),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { error: 'پذیرش قوانین الزامی است' }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'تکرار رمز عبور مطابقت ندارد',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;
type PasswordStrength = 'weak' | 'medium' | 'strong';

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return 'weak';
  if (score <= 3) return 'medium';
  return 'strong';
}

const strengthConfig: Record<PasswordStrength, { label: string; color: string; width: string }> = {
  weak:   { label: 'ضعیف',  color: 'var(--semantic-danger)',  width: '33%'  },
  medium: { label: 'متوسط', color: '#f59e0b',                 width: '66%'  },
  strong: { label: 'قوی',   color: 'var(--semantic-success)', width: '100%' },
};

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [done, setDone] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            phone: data.phone,
            telegram_id: data.telegram_id?.trim() || null,
          },
        },
      });

      if (error) {
        setServerError(parseError(error));
        return;
      }

      setSentEmail(data.email);
      setDone(true);
    } catch (err) {
      setServerError(parseError(err));
    }
  };

  const inputBase =
    'w-full rounded-lg px-4 py-2.5 text-sm bg-transparent border transition-colors focus:outline-none focus:ring-offset-0';

  const fieldClass = (hasError: boolean) =>
    cn(
      inputBase,
      hasError
        ? 'border-[var(--semantic-danger)]'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
    );

  const goldFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-gold)';
  };
  const clearFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = '';
  };

  const strength = passwordValue ? getPasswordStrength(passwordValue) : null;

  if (done) {
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
          ثبت‌نام موفق
        </h1>
        <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>
          ایمیل تأیید برای شما ارسال شد
        </p>
        {sentEmail && (
          <p
            className="text-sm font-medium mb-4 rounded-lg px-3 py-1.5 inline-block"
            dir="ltr"
            style={{
              color: 'var(--accent-gold)',
              backgroundColor: 'rgba(212,162,76,0.08)',
              border: '1px solid rgba(212,162,76,0.2)',
            }}
          >
            {sentEmail}
          </p>
        )}
        <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
          پس از تأیید ایمیل، حساب شما در انتظار تأیید ادمین خواهد بود.
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
        ثبت‌نام در اتاق معاملات
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
        اطلاعات خود را وارد کنید تا درخواست ثبت‌نام ارسال شود.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
            نام و نام خانوادگی
          </label>
          <input
            type="text"
            autoComplete="name"
            placeholder="علی محمدی"
            {...register('full_name')}
            className={fieldClass(!!errors.full_name)}
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
            onFocus={goldFocus}
            onBlur={clearFocus}
          />
          {errors.full_name && (
            <p className="mt-1 text-xs" role="alert" style={{ color: 'var(--semantic-danger)' }}>
              {errors.full_name.message}
            </p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
            شماره موبایل
          </label>
          <input
            type="tel"
            autoComplete="tel"
            placeholder="09123456789"
            dir="ltr"
            {...register('phone')}
            className={fieldClass(!!errors.phone)}
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
            onFocus={goldFocus}
            onBlur={clearFocus}
          />
          {errors.phone && (
            <p className="mt-1 text-xs" role="alert" style={{ color: 'var(--semantic-danger)' }}>
              {errors.phone.message}
            </p>
          )}
        </div>

        {/* Telegram ID (optional) */}
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
            آیدی تلگرام{' '}
            <span className="font-normal text-xs" style={{ color: 'var(--text-tertiary)' }}>
              (اختیاری)
            </span>
          </label>
          <input
            type="text"
            placeholder="@username"
            dir="ltr"
            {...register('telegram_id')}
            className={fieldClass(!!errors.telegram_id)}
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
            onFocus={goldFocus}
            onBlur={clearFocus}
          />
          {errors.telegram_id && (
            <p className="mt-1 text-xs" role="alert" style={{ color: 'var(--semantic-danger)' }}>
              {errors.telegram_id.message}
            </p>
          )}
        </div>

        {/* Email */}
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
            className={fieldClass(!!errors.email)}
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
            onFocus={goldFocus}
            onBlur={clearFocus}
          />
          {errors.email && (
            <p className="mt-1 text-xs" role="alert" style={{ color: 'var(--semantic-danger)' }}>
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
            رمز عبور
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="حداقل ۸ کاراکتر"
              dir="ltr"
              {...register('password', {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  setPasswordValue(e.target.value),
              })}
              className={cn(fieldClass(!!errors.password), 'pl-16')}
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
              onFocus={goldFocus}
              onBlur={clearFocus}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs select-none"
              style={{ color: 'var(--text-tertiary)' }}
              tabIndex={-1}
            >
              {showPassword ? 'پنهان' : 'نمایش'}
            </button>
          </div>

          {/* Password strength bar */}
          {passwordValue && strength && (
            <div className="mt-2">
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--border-subtle)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: strengthConfig[strength].width,
                    backgroundColor: strengthConfig[strength].color,
                  }}
                />
              </div>
              <p className="mt-1 text-xs" style={{ color: strengthConfig[strength].color }}>
                قدرت رمز: {strengthConfig[strength].label}
              </p>
            </div>
          )}

          {errors.password && (
            <p className="mt-1 text-xs" role="alert" style={{ color: 'var(--semantic-danger)' }}>
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
            تکرار رمز عبور
          </label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              dir="ltr"
              {...register('confirmPassword')}
              className={cn(fieldClass(!!errors.confirmPassword), 'pl-16')}
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
              onFocus={goldFocus}
              onBlur={clearFocus}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs select-none"
              style={{ color: 'var(--text-tertiary)' }}
              tabIndex={-1}
            >
              {showConfirm ? 'پنهان' : 'نمایش'}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-xs" role="alert" style={{ color: 'var(--semantic-danger)' }}>
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Accept Terms */}
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="acceptTerms"
            {...register('acceptTerms')}
            className="mt-0.5 h-4 w-4 rounded accent-[var(--accent-gold)] cursor-pointer"
          />
          <label
            htmlFor="acceptTerms"
            className="text-sm cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            قوانین و مقررات اتاق معاملات را می‌پذیرم
          </label>
        </div>
        {errors.acceptTerms && (
          <p className="text-xs -mt-2" role="alert" style={{ color: 'var(--semantic-danger)' }}>
            {errors.acceptTerms.message}
          </p>
        )}

        {/* Server error */}
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

        {/* Submit */}
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
              در حال ثبت‌نام…
            </span>
          ) : (
            'ثبت‌نام'
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
        حساب دارید؟{' '}
        <Link to="/auth/login" className="font-medium hover:underline" style={{ color: 'var(--accent-gold)' }}>
          ورود
        </Link>
      </p>
    </div>
  );
}
