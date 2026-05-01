import { forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id: idProp, ...rest }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1" dir="rtl">
        {/* Label */}
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {label}
          </label>
        )}

        {/* Input */}
        <input
          ref={ref}
          id={id}
          aria-invalid={hasError || undefined}
          aria-describedby={
            [hint ? hintId : '', hasError ? errorId : ''].filter(Boolean).join(' ') || undefined
          }
          className={cn(
            'w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none',
            'transition-colors duration-150',
            // focus ring via CSS
            'focus-visible:ring-2 focus-visible:ring-offset-0',
            // RTL padding — icon room left side if needed
            'ps-3 pe-3',
            hasError
              ? 'border-[color:var(--semantic-danger)] focus-visible:ring-[color:var(--semantic-danger)]'
              : [
                  'border-[color:var(--border-subtle)]',
                  'hover:border-[color:var(--border-strong)]',
                  'focus-visible:border-[color:var(--accent-gold)]',
                  'focus-visible:ring-[color:var(--accent-gold)]',
                ],
            'disabled:cursor-not-allowed disabled:opacity-50',
            'placeholder:text-[color:var(--text-tertiary)]',
            className,
          )}
          style={{ color: 'var(--text-primary)' }}
          {...rest}
        />

        {/* Error text */}
        {hasError && (
          <p
            id={errorId}
            role="alert"
            className="text-xs"
            style={{ color: 'var(--semantic-danger)' }}
          >
            {error}
          </p>
        )}

        {/* Hint text */}
        {hint && !hasError && (
          <p
            id={hintId}
            className="text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
