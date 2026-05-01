// Converts Supabase snake_case DB rows → camelCase domain types used in pages
import type {
  Market as DBMarket,
  Order as DBOrder,
  Trade as DBTrade,
  Settlement as DBSettlement,
} from './database.types';
import type { Market, Order, Trade, Settlement } from '@/domain/types';

export function dbToMarket(d: DBMarket): Market {
  return {
    id: d.id,
    name: d.name,
    symbol: d.symbol,
    unitWeight: Number(d.unit_weight),
    unitLabel: d.unit_label,
    lafzMin: d.lafz_min,
    lafzMax: d.lafz_max,
    lafzScale: Number(d.lafz_scale),
    mazneCurrent: Number(d.mazne_current),
    active: d.active,
    createdAt: d.created_at,
  };
}

export function dbToOrder(d: DBOrder): Order {
  return {
    id: d.id,
    traderId: d.trader_id,
    marketId: d.market_id,
    side: d.side,
    lafz: d.lafz,
    priceToman: Number(d.price_toman),
    quantity: d.quantity,
    filled: d.filled,
    remaining: d.remaining,
    settlementDate: d.settlement_date,
    status: d.status,
    placedAt: d.placed_at,
    cancelledAt: d.cancelled_at ?? undefined,
    cancelReason: d.cancel_reason ?? undefined,
  };
}

export function dbToTrade(d: DBTrade): Trade {
  return {
    id: d.id,
    marketId: d.market_id,
    buyerId: d.buyer_id,
    sellerId: d.seller_id,
    buyOrderId: d.buy_order_id,
    sellOrderId: d.sell_order_id,
    quantity: d.quantity,
    priceToman: Number(d.price_toman),
    settlementDate: d.settlement_date,
    matchedAt: d.matched_at,
    settled: d.settled,
    buyerPnLToman: d.buyer_pnl_toman ?? undefined,
    sellerPnLToman: d.seller_pnl_toman ?? undefined,
    buyerCommission: d.buyer_commission ?? undefined,
    sellerCommission: d.seller_commission ?? undefined,
  };
}

export function dbToSettlement(d: DBSettlement): Settlement {
  return {
    id: d.id,
    marketId: d.market_id,
    settlementDate: d.settlement_date,
    rateToman: Number(d.rate_toman),
    rateTether: Number(d.rate_tether),
    appliedAt: d.applied_at,
    appliedBy: d.applied_by,
    reversedAt: d.reversed_at ?? undefined,
    reversalReason: d.reversal_reason ?? undefined,
    snapshotBefore: typeof d.snapshot_before === 'string'
      ? d.snapshot_before
      : JSON.stringify(d.snapshot_before),
    totalTradesCount: d.total_trades_count,
    totalVolumeUnits: d.total_volume_units,
    totalCommissionToman: Number(d.total_commission_toman),
  };
}
