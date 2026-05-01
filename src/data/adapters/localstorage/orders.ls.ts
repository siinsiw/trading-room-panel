import type { Order, ID, JalaliDate } from '@/domain/types';
import type { OrdersRepository } from '@/data/repositories/orders.repo';
import { LocalStorageBase } from './base';

export class OrdersLocalStorage extends LocalStorageBase<Order> implements OrdersRepository {
  constructor() { super('tr:orders'); }

  async getById(id: ID): Promise<Order | null> {
    return super.getById(id);
  }

  async getByTrader(traderId: ID): Promise<Order[]> {
    return (await this.getAll()).filter(o => o.traderId === traderId);
  }

  async getByMarketAndDate(marketId: ID, settlementDate: JalaliDate): Promise<Order[]> {
    return (await this.getAll()).filter(
      o => o.marketId === marketId && o.settlementDate === settlementDate
    );
  }
}
