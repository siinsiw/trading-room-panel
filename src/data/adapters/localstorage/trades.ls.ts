import type { Trade, ID, JalaliDate } from '@/domain/types';
import type { TradesRepository } from '@/data/repositories/trades.repo';
import { LocalStorageBase } from './base';

export class TradesLocalStorage extends LocalStorageBase<Trade> implements TradesRepository {
  constructor() { super('tr:trades'); }

  async getById(id: ID): Promise<Trade | null> {
    return super.getById(id);
  }

  async getByTrader(traderId: ID): Promise<Trade[]> {
    return (await this.getAll()).filter(
      t => t.buyerId === traderId || t.sellerId === traderId
    );
  }

  async getByMarketAndDate(marketId: ID, settlementDate: JalaliDate): Promise<Trade[]> {
    return (await this.getAll()).filter(
      t => t.marketId === marketId && t.settlementDate === settlementDate
    );
  }

  async getUnsettled(): Promise<Trade[]> {
    return (await this.getAll()).filter(t => !t.settled);
  }
}
