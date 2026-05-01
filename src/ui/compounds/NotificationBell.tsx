import * as Popover from '@radix-ui/react-popover';
import { Bell } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { toFa } from '@/lib/persian';
import { formatIsoFull } from '@/lib/jalali';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification } from '@/lib/database.types';

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-1 px-4 py-3 transition-colors',
        'hover:bg-white/5',
        !notification.read && 'border-r-2',
      )}
      style={
        !notification.read
          ? { borderRightColor: 'var(--accent-gold)' }
          : undefined
      }
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className="text-xs font-semibold leading-snug"
          style={{ color: 'var(--text-primary)' }}
        >
          {notification.title}
        </p>
        {!notification.read && (
          <button
            type="button"
            onClick={() => onMarkRead(notification.id)}
            className="shrink-0 text-[10px] underline-offset-2 hover:underline"
            style={{ color: 'var(--accent-gold)' }}
          >
            خواندم
          </button>
        )}
      </div>

      <p
        className="text-[11px] leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        {notification.body}
      </p>

      <time
        className="text-[10px]"
        style={{ color: 'var(--text-tertiary)' }}
        dateTime={notification.created_at}
      >
        {formatIsoFull(notification.created_at)}
      </time>
    </div>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex h-9 w-9 items-center justify-center rounded-lg',
            'transition-colors duration-150 hover:bg-white/10',
          )}
          aria-label={`اعلان‌ها${unreadCount > 0 ? ` — ${toFa(unreadCount)} خوانده‌نشده` : ''}`}
          style={{ color: 'var(--text-secondary)' }}
        >
          <Bell size={20} />

          {/* Unread badge */}
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white"
                style={{ backgroundColor: 'var(--semantic-danger)' }}
                aria-hidden="true"
              >
                {unreadCount > 99 ? '۹۹+' : toFa(unreadCount)}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-50"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex w-80 flex-col overflow-hidden rounded-xl border shadow-2xl"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                اعلان‌ها
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs hover:underline underline-offset-2"
                  style={{ color: 'var(--accent-gold)' }}
                >
                  علامت همه به عنوان خوانده
                </button>
              )}
            </div>

            {/* List */}
            <div
              className="overflow-y-auto divide-y"
              style={{
                maxHeight: 400,
                divideColor: 'var(--border-subtle)',
              } as React.CSSProperties}
            >
              {notifications.length === 0 ? (
                <p
                  className="px-4 py-8 text-center text-sm"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  اعلانی وجود ندارد
                </p>
              ) : (
                notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={(id) => void markRead(id)}
                  />
                ))
              )}
            </div>
          </motion.div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
