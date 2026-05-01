import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { parseError } from '@/lib/errors';
import { cn } from '@/lib/cn';

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد')
      .regex(/[A-Z]/, 'رمز عبور باید حداقل یک حرف بزرگ داشته باشد')
      .regex(/[0-9]/, 'رمز عبور باید حداقل یک عدد داشته باشد'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'تکرار رمز عبور مطابقت ندارد',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: data.newPassword });

      if (error) {
        setServerError(parseError(error));
        return;
      }

      toast.success('رمز عبور با موفقیت تغییر کرد');
      navigate('/auth/login');
    } catch (err) {
      setServerError(parseError(err));
    }
  };

  const inputBase =
    'w-full rounded-lg px-4 py-2.5 text-sm bg-transparent border transition-colors focus:outline-none focus:ring-offset-0';

  const goldFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-gold)';
  };
  const clearFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = '';
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        تعیین رمز عبور جدید
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
        رمز عبور جدید خود را وارد کنید.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* New Password */}
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
            رمز عبور جدید
          </label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="حداقل ۸ کاراکتر"
              dir="ltr"
              {...register('newPassword')}
              className={cn(
                inputBase,
                'pl-16',
                errors.newPassword
                  ? 'border-[var(--semantic-danger)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
              )}
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' }}
              onFocus={goldFocus}
              onBlur={clearFocus}
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs select-none"
              style={{ color: 'var(--text-tertiary)' }}
              tabIndex={-1}
            >
              {showNew ? 'پنهان' : 'نمایش'}
            </button>
          </div>
          {errors.newPassword && (
            <p className="mt-1 text-xs" role="alert" style={{ color: 'var(--semantic-danger)' }}>
              {errors.newPassword.message}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
            تکرار رمز عبور جدید
          </label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              dir="ltr"
              {...register('confirmPassword')}
              className={cn(
                inputBase,
                'pl-16',
                errors.confirmPassword
                  ? 'border-[var(--semantic-danger)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
              )}
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
              در حال ذخیره…
            </span>
          ) : (
            'ذخیره رمز عبور'
          )}
        </button>
      </form>
    </div>
  );
}
