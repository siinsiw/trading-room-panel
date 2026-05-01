import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import type { Market } from '@/lib/database.types';

let _channelCounter = 0;

export class MarketsRepo {
  async list(): Promise<Market[]> {
    const { data, error } = await db.from('markets').select('*').order('name');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getById(id: string): Promise<Market | null> {
    const { data, error } = await db.from('markets').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  }

  async create(data: Omit<Market, 'id' | 'created_at' | 'updated_at'>): Promise<Market> {
    const { data: created, error } = await db.from('markets').insert(data).select().single();
    if (error) throw new Error(error.message);
    return created;
  }

  async update(id: string, data: Partial<Market>): Promise<Market> {
    const { data: updated, error } = await db.from('markets').update(data).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return updated;
  }

  async updateMazne(id: string, newMazne: number): Promise<void> {
    const { error } = await db.rpc('update_mazne', { p_market_id: id, p_new_mazne: newMazne });
    if (error) throw new Error(error.message);
  }

  subscribe(callback: (market: Market) => void): () => void {
    const channelName = `markets-changes-${++_channelCounter}`;
    const ch = db.channel(channelName);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const channel = ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'markets' },
      (payload: { new?: Market }) => { if (payload.new) callback(payload.new); }
    ).subscribe();
    return () => { db.removeChannel(channel); };
  }
}

export const marketsRepo = new MarketsRepo();
