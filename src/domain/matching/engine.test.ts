import { describe, it, expect } from 'vitest';
import { nanoid } from 'nanoid';
import { matchOrder } from './engine';
import type { Order } from '../types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: nanoid(12),
    traderId: nanoid(12),
    marketId: 'GOLD',
    side: 'buy',
    kind: 'today',
    lafz: 100,
    priceToman: 88_400_000,
    quantity: 1,
    filled: 0,
    remaining: 1,
    settlementDate: '1405/02/11',
    status: 'open',
    allOrNothing: false,
    placedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('matchOrder', () => {
  it('1. no match when book is empty', () => {
    const order = makeOrder({ side: 'buy' });
    const result = matchOrder(order, []);
    expect(result.trades).toHaveLength(0);
    expect(result.updatedOrders).toHaveLength(1);
    expect(result.updatedOrders[0].status).toBe('open');
  });

  it('2. full 1-to-1 match', () => {
    const seller = makeOrder({ side: 'sell', priceToman: 88_300_000, traderId: 'seller-1' });
    const buyer = makeOrder({ side: 'buy',  priceToman: 88_400_000, traderId: 'buyer-1' });
    const result = matchOrder(buyer, [seller]);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].quantity).toBe(1);
    expect(result.updatedOrders.find(o => o.id === buyer.id)?.status).toBe('filled');
    expect(result.updatedOrders.find(o => o.id === seller.id)?.status).toBe('filled');
  });

  it('3. partial fill — incoming larger than resting', () => {
    const seller = makeOrder({ side: 'sell', quantity: 1, remaining: 1, traderId: 's1' });
    const buyer  = makeOrder({ side: 'buy',  quantity: 3, remaining: 3, traderId: 'b1' });
    const result = matchOrder(buyer, [seller]);
    expect(result.trades[0].quantity).toBe(1);
    expect(result.updatedOrders.find(o => o.id === buyer.id)?.status).toBe('partial');
    expect(result.updatedOrders.find(o => o.id === buyer.id)?.remaining).toBe(2);
  });

  it('4. partial fill — resting larger than incoming', () => {
    const seller = makeOrder({ side: 'sell', quantity: 5, remaining: 5, traderId: 's1' });
    const buyer  = makeOrder({ side: 'buy',  quantity: 2, remaining: 2, traderId: 'b1' });
    const result = matchOrder(buyer, [seller]);
    expect(result.trades[0].quantity).toBe(2);
    expect(result.updatedOrders.find(o => o.id === seller.id)?.remaining).toBe(3);
    expect(result.updatedOrders.find(o => o.id === buyer.id)?.status).toBe('filled');
  });

  it('5. multiple resting orders fill incoming completely', () => {
    const s1 = makeOrder({ side: 'sell', quantity: 1, remaining: 1, traderId: 's1', priceToman: 88_300_000 });
    const s2 = makeOrder({ side: 'sell', quantity: 1, remaining: 1, traderId: 's2', priceToman: 88_350_000 });
    const s3 = makeOrder({ side: 'sell', quantity: 1, remaining: 1, traderId: 's3', priceToman: 88_400_000 });
    const buyer = makeOrder({ side: 'buy', quantity: 3, remaining: 3, traderId: 'b1', priceToman: 88_500_000 });
    const result = matchOrder(buyer, [s1, s2, s3]);
    expect(result.trades).toHaveLength(3);
    expect(result.updatedOrders.find(o => o.id === buyer.id)?.status).toBe('filled');
  });

  it('6. buy at higher price matches with cheapest sell — best price for buyer', () => {
    const cheap  = makeOrder({ side: 'sell', priceToman: 88_300_000, traderId: 's1' });
    const expensive = makeOrder({ side: 'sell', priceToman: 88_450_000, traderId: 's2' });
    const buyer  = makeOrder({ side: 'buy',  priceToman: 88_500_000, traderId: 'b1' });
    const result = matchOrder(buyer, [expensive, cheap]);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].priceToman).toBe(88_300_000);   // matched at cheapest
  });

  it('7. no self-trade', () => {
    const traderId = 'same-trader';
    const seller = makeOrder({ side: 'sell', traderId });
    const buyer  = makeOrder({ side: 'buy',  traderId });
    const result = matchOrder(buyer, [seller]);
    expect(result.trades).toHaveLength(0);
  });

  it('8. time priority when prices are equal', () => {
    const early = makeOrder({ side: 'sell', priceToman: 88_300_000, traderId: 's1', placedAt: '2026-05-01T09:00:00.000Z' });
    const late  = makeOrder({ side: 'sell', priceToman: 88_300_000, traderId: 's2', placedAt: '2026-05-01T10:00:00.000Z' });
    const buyer = makeOrder({ side: 'buy',  priceToman: 88_300_000, quantity: 1, remaining: 1, traderId: 'b1' });
    const result = matchOrder(buyer, [late, early]);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].sellOrderId).toBe(early.id);
  });
});
