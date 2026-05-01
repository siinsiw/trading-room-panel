import { useState, useRef, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  requireType?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  variant = 'default',
  requireType,
  loading = false,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset typed value when dialog opens
  useEffect(() => {
    if (open) {
      setTyped('');
      if (requireType) {
        setTimeout(() => inputRef.current?.focus(), 120);
      }
    }
  }, [open, requireType]);

  const isConfirmDisabled =
    submitting ||
    loading ||
    (requireType !== undefined && typed.trim() !== requireType);

  async function handleConfirm() {
    if (isConfirmDisabled) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  const isDanger = variant === 'danger';
  const busy = submitting || loading;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Backdrop */}
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>

            {/* Dialog card */}
            <Dialog.Content asChild>
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                initial={{ opacity: 0, scale: 0.93 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.93 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              >
                <div
                  className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-strong)',
                  }}
                  dir="rtl"
                >
                  {/* Title */}
                  <Dialog.Title
                    className="mb-2 text-base font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {title}
                  </Dialog.Title>

                  {/* Description */}
                  {description && (
                    <Dialog.Description
                      className="mb-4 text-sm leading-relaxed"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {description}
                    </Dialog.Description>
                  )}

                  {/* requireType input */}
                  {requireType && (
                    <div className="mb-5">
                      <p
                        className="mb-2 text-sm"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        برای تأیید، کلمه{' '}
                        <span
                          className="font-semibold"
                          style={{ color: isDanger ? 'var(--semantic-danger)' : 'var(--accent-gold)' }}
                        >
                          «{requireType}»
                        </span>{' '}
                        را تایپ کنید
                      </p>
                      <input
                        ref={inputRef}
                        type="text"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        placeholder={requireType}
                        className={cn(
                          'w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none',
                          'transition-colors duration-150',
                          'focus:ring-2',
                        )}
                        style={{
                          color: 'var(--text-primary)',
                          borderColor:
                            typed && typed !== requireType
                              ? 'var(--semantic-danger)'
                              : 'var(--border-strong)',
                          '--tw-ring-color': isDanger
                            ? 'var(--semantic-danger)'
                            : 'var(--accent-gold)',
                        } as React.CSSProperties}
                        autoComplete="off"
                        spellCheck={false}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirm();
                        }}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3">
                    {/* Cancel */}
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={busy}
                      className={cn(
                        'rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150',
                        'hover:bg-white/5 disabled:opacity-50',
                      )}
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {cancelLabel}
                    </button>

                    {/* Confirm */}
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={isConfirmDisabled}
                      className={cn(
                        'relative flex min-w-[80px] items-center justify-center gap-2',
                        'rounded-lg px-4 py-2 text-sm font-semibold',
                        'transition-opacity duration-150',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                      )}
                      style={
                        isDanger
                          ? { backgroundColor: 'var(--semantic-danger)', color: '#fff' }
                          : { backgroundColor: 'var(--accent-gold)', color: '#000' }
                      }
                    >
                      {busy && (
                        <span
                          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                          aria-hidden="true"
                        />
                      )}
                      {confirmLabel}
                    </button>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
