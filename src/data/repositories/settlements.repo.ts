import type { Settlement, ID, JalaliDate } from '@/domain/types';

export interface SettlementsRepository {
  getAll(): Promise<Settlement[]>;
  getById(id: ID): Promise<Settlement | null>;
  getByMarketAndDate(marketId: ID, settlementDate: JalaliDate): Promise<Settlement | null>;
  getLatest(): Promise<Settlement | null>;
  create(settlement: Settlement): Promise<Settlement>;
  createMany(settlements: Settlement[]): Promise<Settlement[]>;
  update(id: ID, patch: Partial<Settlement>): Promise<Settlement>;
}
