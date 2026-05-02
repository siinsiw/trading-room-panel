import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { parseError } from '@/lib/errors';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/cn';

const schema = z.object({
  email: z.string().email('ایمیل معتبر وارد کنید'),
  password: z.string().min(1, 'رمز عبور الزامی است'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) { setServerError(parseError(error)); return; }
      if (!signInData.user) { setServerError('ورود ناموفق'); return; }

      // پروفایل را خودمان با id کاربر می‌گیریم — onAuthStateChange هم
      // به‌صورت موازی اجرا می‌شود ولی dedup داخل loadProfile رفع تداخل می‌کند.
      await useAuthStore.getState().loadProfile(signInData.user.id);
      const profile = useAuthStore.getState().profile;

      if (!profile) { setServerError('خطا در بارگذاری پروفایل. دوباره تلاش کنید.'); return; }

      if (profile.role === 'admin') navigate('/admin/dashboard');
      else if (profile.role === 'accountant') navigate('/accountant/reports');
      else if (profile.active) navigate('/trader/orderbook');
      else navigate('/auth/pending-approval');

    } catch (err) {
      setServerError(parseError(err));
    }
  };

  const inputBase =
    'w-full rounded-lg px-4 py-2.5 text-sm bg-transparent border transition-colors focus:outline-none focus:ring-offset-0';

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        ورود به اتاق معاملات
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
        خوش آمدید. اطلاعات حساب خود را وارد کنید.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
            className={cn(
              inputBase,
              errors.email
                ? 'border-[var(--semantic-danger)]'
                : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
            )}
            style={{
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-overlay)',
              boxShadow: errors.email ? undefined : undefined,
            }}
            onFocus={(e) => {
              if (!errors.email) {
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-gold)';
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = '';
            }}
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
              autoComplete="current-password"
              placeholder="••••••••"
              dir="ltr"
              {...register('password')}
              className={cn(
                inputBase,
                'pl-16',
                errors.password
                  ? 'border-[var(--semantic-danger)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
              )}
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
              onFocus={(e) => {
                if (!errors.password) {
                  e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-gold)';
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = '';
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs select-none px-1 py-0.5 rounded"
              style={{ color: 'var(--text-tertiary)' }}
              tabIndex={-1}
            >
              {showPassword ? 'پنهان' : 'نمایش'}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs" role="alert" style={{ color: 'var(--semantic-danger)' }}>
              {errors.password.message}
            </p>
          )}
        </div>

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
              در حال ورود…
            </span>
          ) : (
            'ورود'
          )}
        </button>
      </form>

      {/* Links */}
      <div className="mt-5 flex flex-col items-center gap-2 text-sm">
        <Link
          to="/auth/forgot-password"
          className="hover:underline"
          style={{ color: 'var(--accent-gold)' }}
        >
          رمز را فراموش کردید؟
        </Link>
        <span style={{ color: 'var(--text-tertiary)' }}>
          حساب ندارید؟{' '}
          <Link to="/auth/signup" className="font-medium hover:underline" style={{ color: 'var(--accent-gold)' }}>
            ثبت‌نام
          </Link>
        </span>
      </div>
    </div>
  );
}
