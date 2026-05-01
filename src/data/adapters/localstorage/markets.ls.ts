import type { Market, ID } from '@/domain/types';
import type { MarketsRepository } from '@/data/repositories/markets.repo';
import { LocalStorageBase } from './base';

export class MarketsLocalStorage extends LocalStorageBase<Market> implements MarketsRepository {
  constructor() { super('tr:markets'); }

  async getById(id: ID): Promise<Market | null> {
    return super.getById(id);
  }
}
