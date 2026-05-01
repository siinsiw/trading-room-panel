import type { Market, ID } from '@/domain/types';

export interface MarketsRepository {
  getAll(): Promise<Market[]>;
  getById(id: ID): Promise<Market | null>;
  create(market: Market): Promise<Market>;
  createMany(markets: Market[]): Promise<Market[]>;
  update(id: ID, patch: Partial<Market>): Promise<Market>;
  delete(id: ID): Promise<void>;
}
