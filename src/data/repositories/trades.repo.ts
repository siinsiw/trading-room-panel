import type { Trade, ID, JalaliDate } from '@/domain/types';

export interface TradesRepository {
  getAll(): Promise<Trade[]>;
  getById(id: ID): Promise<Trade | null>;
  getByTrader(traderId: ID): Promise<Trade[]>;
  getByMarketAndDate(marketId: ID, settlementDate: JalaliDate): Promise<Trade[]>;
  getUnsettled(): Promise<Trade[]>;
  create(trade: Trade): Promise<Trade>;
  createMany(trades: Trade[]): Promise<Trade[]>;
  update(id: ID, patch: Partial<Trade>): Promise<Trade>;
  updateMany(trades: Trade[]): Promise<Trade[]>;
}
