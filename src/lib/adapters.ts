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

// PostgreSQL date columns return YYYY-MM-DD; frontend uses YYYY/MM/DD — normalize here
const normDate = (d: string) => d.replace(/-/g, '/');

export function dbToOrder(d: DBOrder): Order {
  return {
    id: d.id,
    traderId: d.trader_id,
    marketId: d.market_id,
    side: d.side,
    kind: d.kind,
    lafz: d.lafz,
    priceToman: Number(d.price_toman),
    quantity: d.quantity,
    filled: d.filled,
    remaining: d.remaining,
    settlementDate: normDate(d.settlement_date),
    status: d.status,
    allOrNothing: d.all_or_nothing,
    placedAt: d.placed_at,
    expiresAt: d.expires_at ?? undefined,
    overriddenAt: d.overridden_at ?? undefined,
    cancelledAt: d.cancelled_at ?? undefined,
    cancelReason: d.cancel_reason ?? undefined,
    telegramMsgId: d.telegram_msg_id ?? undefined,
  };
}

export function dbToTrade(d: DBTrade): Trade {
  return {
    id: d.id,
    marketId: d.market_id,
    buyerId: d.buyer_id,
    sellerId: d.seller_id,
    buyOrderId: d.buy_order_id ?? undefined,
    sellOrderId: d.sell_order_id ?? undefined,
    quantity: d.quantity,
    priceToman: Number(d.price_toman),
    settlementDate: normDate(d.settlement_date),
    kind: d.kind,
    tradeType: d.trade_type,
    rentBlockValue: d.rent_block_value ?? undefined,
    note: d.note ?? undefined,
    manual: d.manual,
    source: (d.source as Trade['source']) ?? 'bot',
    createdBy: d.created_by ?? undefined,
    matchedAt: d.matched_at,
    settled: d.settled,
    settlementId: d.settlement_id ?? undefined,
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
    settlementDate: normDate(d.settlement_date),
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
