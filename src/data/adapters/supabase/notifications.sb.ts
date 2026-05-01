import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import type { Notification } from '@/lib/database.types';

let _channelCounter = 0;

export class NotificationsRepo {
  async listMine(): Promise<Notification[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await db.from('notifications').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async markRead(id: string): Promise<void> {
    const { error } = await db.from('notifications').update({ read: true }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async markAllRead(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await db.from('notifications').update({ read: true }).eq('user_id', user.id);
    if (error) throw new Error(error.message);
  }

  async getUnreadCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;
    const { count, error } = await db.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('read', false);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  subscribe(userId: string, callback: (n: Notification) => void): () => void {
    const channelName = `notifications-${userId}-${++_channelCounter}`;
    const ch = db.channel(channelName);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const channel = ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload: { new?: Notification }) => { if (payload.new) callback(payload.new); }
    ).subscribe();
    return () => { db.removeChannel(channel); };
  }
}

export const notificationsRepo = new NotificationsRepo();
