import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import type { Order } from '@/lib/database.types';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

let _channelCounter = 0;

export interface PlaceOrderResult {
  order_id: string;
  trades: unknown[];
  remaining: number;
}

export class OrdersRepo {
  async placeOrder(
    marketId: string,
    side: 'buy' | 'sell',
    lafz: number,
    quantity: number,
    settlementDate: string,
  ): Promise<PlaceOrderResult> {
    const { data, error } = await db.rpc('place_order', {
      p_market_id: marketId,
      p_side: side,
      p_lafz: lafz,
      p_quantity: quantity,
      p_settlement_date: settlementDate,
    });
    if (error) throw new Error(error.message);
    return data as PlaceOrderResult;
  }

  async cancelOrder(id: string, reason?: string): Promise<void> {
    const { error } = await db.rpc('cancel_order', {
      p_order_id: id,
      ...(reason !== undefined ? { p_reason: reason } : {}),
    });
    if (error) throw new Error(error.message);
  }

  async listMine(filter?: { status?: Order['status'] }): Promise<Order[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('orders')
      .select('*')
      .eq('trader_id', user.id)
      .order('placed_at', { ascending: false });

    if (filter?.status !== undefined) {
      query = query.eq('status', filter.status);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async listOrderBook(marketId: string, settlementDate: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('market_id', marketId)
      .eq('settlement_date', settlementDate)
      .in('status', ['open', 'partial'])
      .order('price_toman', { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  subscribeToBook(
    marketId: string,
    settlementDate: string,
    callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  ): () => void {
    const channelName = `orderbook-${marketId}-${settlementDate}-${++_channelCounter}`;
    const filter = `market_id=eq.${marketId}`;

    const ch = db.channel(channelName);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const channel = ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const record = (payload.new ?? payload.old) as Record<string, unknown> | undefined;
        if (record && record['settlement_date'] === settlementDate) {
          callback(payload);
        }
      },
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }
}

export const ordersRepo = new OrdersRepo();

