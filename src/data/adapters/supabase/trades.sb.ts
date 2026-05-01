import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import type { Trade } from '@/lib/database.types';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

let _channelCounter = 0;

export interface TradeFilter {
  marketId?: string;
  settlementDate?: string;
  settled?: boolean;
}

export class TradesRepo {
  async listAll(filter?: TradeFilter): Promise<Trade[]> {
    let query = supabase
      .from('trades')
      .select('*')
      .order('matched_at', { ascending: false });

    if (filter?.marketId !== undefined) {
      query = query.eq('market_id', filter.marketId);
    }
    if (filter?.settlementDate !== undefined) {
      query = query.eq('settlement_date', filter.settlementDate);
    }
    if (filter?.settled !== undefined) {
      query = query.eq('settled', filter.settled);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async listMine(filter?: TradeFilter): Promise<Trade[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('trades')
      .select('*')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('matched_at', { ascending: false });

    if (filter?.marketId !== undefined) {
      query = query.eq('market_id', filter.marketId);
    }
    if (filter?.settlementDate !== undefined) {
      query = query.eq('settlement_date', filter.settlementDate);
    }
    if (filter?.settled !== undefined) {
      query = query.eq('settled', filter.settled);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async listByMarketAndDate(marketId: string, date: string): Promise<Trade[]> {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('market_id', marketId)
      .eq('settlement_date', date)
      .order('matched_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  subscribe(
    callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  ): () => void {
    const channelName = `trades-changes-${++_channelCounter}`;
    const ch = db.channel(channelName);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const channel = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, callback).subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }
}

export const tradesRepo = new TradesRepo();

