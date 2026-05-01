import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import type { Profile } from '@/lib/database.types';

let _channelCounter = 0;

export class UsersRepo {
  async getCurrent(): Promise<Profile | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  }

  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  }

  async list(filter?: { role?: Profile['role']; active?: boolean }): Promise<Profile[]> {
    let query = db.from('profiles').select('*');

    if (filter?.role !== undefined) {
      query = query.eq('role', filter.role);
    }
    if (filter?.active !== undefined) {
      query = query.eq('active', filter.active);
    }

    const { data, error } = await query.order('full_name');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async listPendingApprovals(): Promise<Profile[]> {
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('role', 'trader')
      .eq('active', false)
      .order('created_at');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async update(id: string, data: Partial<Profile>): Promise<Profile> {
    const { data: updated, error } = await db
      .from('profiles')
      .update(data as any)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  }

  async approve(
    id: string,
    deposit: number,
    perUnitDeposit: number,
    commission: number,
  ): Promise<void> {
    const { error } = await (supabase as any).rpc('approve_trader', {
      p_trader_id: id,
      p_deposit: deposit,
      p_per_unit_deposit: perUnitDeposit,
      p_commission: commission,
    });
    if (error) throw new Error(error.message);
  }

  subscribe(userId: string, callback: (profile: Profile) => void): () => void {
    const channelName = `profile-${userId}-${++_channelCounter}`;
    const ch = db.channel(channelName);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const channel = ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
      (payload: { new?: Profile }) => { if (payload.new) callback(payload.new); }
    ).subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }
}

export const usersRepo = new UsersRepo();



