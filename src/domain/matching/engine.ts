import { nanoid } from 'nanoid';
import type { Order, Trade, MatchResult, IsoDateTime } from '../types';

function now(): IsoDateTime {
  return new Date().toISOString();
}

export function matchOrder(newOrder: Order, book: Order[]): MatchResult {
  const isBuy = newOrder.side === 'buy';

  const candidates = book
    .filter(o => o.status === 'open' || o.status === 'partial')
    .filter(o => o.marketId === newOrder.marketId)
    .filter(o => o.settlementDate === newOrder.settlementDate)
    .filter(o => o.traderId !== newOrder.traderId)        // no self-trade
    .filter(o =>
      isBuy
        ? o.side === 'sell' && o.priceToman <= newOrder.priceToman
        : o.side === 'buy'  && o.priceToman >= newOrder.priceToman
    )
    // Best price for buyer (lowest ask first), then time priority
    .sort((a, b) => a.priceToman - b.priceToman || a.placedAt.localeCompare(b.placedAt));

  const trades: Trade[] = [];
  const updatedOrders: Order[] = [];
  let remaining = newOrder.remaining;

  for (const candidate of candidates) {
    if (remaining === 0) break;

    const matchQty = Math.min(remaining, candidate.remaining);
    // Matched price = MIN(buy, sell) — always best for buyer
    const matchPrice = Math.min(newOrder.priceToman, candidate.priceToman);

    const buyOrderId = isBuy ? newOrder.id : candidate.id;
    const sellOrderId = isBuy ? candidate.id : newOrder.id;
    const buyerId = isBuy ? newOrder.traderId : candidate.traderId;
    const sellerId = isBuy ? candidate.traderId : newOrder.traderId;

    const trade: Trade = {
      id: nanoid(12),
      marketId: newOrder.marketId,
      buyerId,
      sellerId,
      buyOrderId,
      sellOrderId,
      quantity: matchQty,
      priceToman: matchPrice,
      settlementDate: newOrder.settlementDate,
      kind: newOrder.kind,
      tradeType: 'normal',
      manual: false,
      source: 'panel',
      matchedAt: now(),
      settled: false,
    };
    trades.push(trade);

    const updatedCandidate: Order = {
      ...candidate,
      filled: candidate.filled + matchQty,
      remaining: candidate.remaining - matchQty,
      status: candidate.remaining - matchQty === 0 ? 'filled' : 'partial',
    };
    updatedOrders.push(updatedCandidate);

    remaining -= matchQty;
  }

  const updatedNew: Order = {
    ...newOrder,
    filled: newOrder.quantity - remaining,
    remaining,
    status:
      remaining === 0
        ? 'filled'
        : newOrder.quantity - remaining > 0
        ? 'partial'
        : 'open',
  };
  updatedOrders.push(updatedNew);

  return { trades, updatedOrders };
}
