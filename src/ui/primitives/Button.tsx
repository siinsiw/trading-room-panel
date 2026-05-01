import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-7  px-3  text-xs  gap-1.5',
  md: 'h-9  px-4  text-sm  gap-2',
  lg: 'h-11 px-5  text-base gap-2.5',
};

const VARIANT_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--accent-gold)',
    color: '#000',
    border: 'none',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
  },
  danger: {
    backgroundColor: 'var(--semantic-danger)',
    color: '#fff',
    border: 'none',
  },
  outline: {
    backgroundColor: 'transparent',
    color: 'var(--accent-gold)',
    border: '1px solid var(--accent-gold)',
  },
};

const HOVER_CLASS: Record<ButtonVariant, string> = {
  primary: 'hover:brightness-110',
  ghost: 'hover:bg-white/10',
  danger: 'hover:brightness-110',
  outline: 'hover:bg-[color-mix(in_srgb,var(--accent-gold)_10%,transparent)]',
};

function Spinner({ size }: { size: ButtonSize }) {
  const dim = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: dim, height: dim, flexShrink: 0 }}
      aria-hidden="true"
    />
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      className,
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-semibold',
          'rounded-lg transition-all duration-150 select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-gold)] focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          SIZE_CLASSES[size],
          HOVER_CLASS[variant],
          'active:scale-[0.97]',
          className,
        )}
        style={VARIANT_STYLE[variant]}
        {...rest}
      >
        {loading && <Spinner size={size} />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
