import { supabase } from '@/lib/supabase';
import type { Settlement } from '@/lib/database.types';

export interface SettlementPreviewRow {
  trader_id: string;
  full_name: string;
  deposit_tether: number;
  floating_pnl_toman: number;
  floating_pnl_tether: number;
  commission_accumulated: number;
  required_tether: number;
  available_tether: number;
  percentage: number;
  zone: string;
}

export class SettlementsRepo {
  async getPreview(
    marketId: string,
    settlementDate: string,
    testPrice: number,
    tetherRate: number,
  ): Promise<SettlementPreviewRow[]> {
    const { data, error } = await (supabase as any).rpc('get_settlement_preview', {
      p_market_id: marketId,
      p_settlement_date: settlementDate,
      p_test_price: testPrice,
      p_tether_rate: tetherRate,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as SettlementPreviewRow[];
  }

  async applyFinal(
    marketId: string,
    date: string,
    rateToman: number,
    rateTether: number,
  ): Promise<{ settlement_id: string; affected_traders: number }> {
    const { data, error } = await (supabase as any).rpc('apply_settlement', {
      p_market_id: marketId,
      p_settlement_date: date,
      p_rate_toman: rateToman,
      p_rate_tether: rateTether,
    });
    if (error) throw new Error(error.message);
    return data as { settlement_id: string; affected_traders: number };
  }

  async reverse(settlementId: string, reason: string): Promise<void> {
    const { error } = await (supabase as any).rpc('reverse_settlement', {
      p_settlement_id: settlementId,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
  }

  async list(filter?: { marketId?: string }): Promise<Settlement[]> {
    let query = supabase
      .from('settlements')
      .select('*')
      .order('applied_at', { ascending: false });

    if (filter?.marketId !== undefined) {
      query = query.eq('market_id', filter.marketId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getById(id: string): Promise<Settlement | null> {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  }
}

export const settlementsRepo = new SettlementsRepo();




