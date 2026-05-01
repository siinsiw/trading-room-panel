import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/lib/database.types';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Fetch on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchNotifications() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data && !cancelled) {
        setNotifications(data);
      }
    }

    fetchNotifications();
    return () => { cancelled = true; };
  }, []);

  // Realtime subscription to inserts for current user
  useEffect(() => {
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    async function subscribe() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channelRef = supabase
        .channel(`notifications:${user.id}`)
        .on<Notification>(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: RealtimePostgresInsertPayload<Notification>) => {
            setNotifications((prev) => [payload.new, ...prev]);
          },
        )
        .subscribe();
    }

    subscribe();

    return () => {
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markRead, markAllRead };
}
