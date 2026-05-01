import type { Settlement, ID, JalaliDate } from '@/domain/types';
import type { SettlementsRepository } from '@/data/repositories/settlements.repo';
import { LocalStorageBase } from './base';

export class SettlementsLocalStorage extends LocalStorageBase<Settlement> implements SettlementsRepository {
  constructor() { super('tr:settlements'); }

  async getById(id: ID): Promise<Settlement | null> {
    return super.getById(id);
  }

  async getByMarketAndDate(marketId: ID, settlementDate: JalaliDate): Promise<Settlement | null> {
    return (await this.getAll()).find(
      s => s.marketId === marketId && s.settlementDate === settlementDate
    ) ?? null;
  }

  async getLatest(): Promise<Settlement | null> {
    const all = await this.getAll();
    if (!all.length) return null;
    return all.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))[0];
  }
}
