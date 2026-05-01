import type { AuditEntry, ID } from '@/domain/types';
import type { AuditRepository } from '@/data/repositories/audit.repo';
import { LocalStorageBase } from './base';

export class AuditLocalStorage extends LocalStorageBase<AuditEntry> implements AuditRepository {
  constructor() { super('tr:audit'); }

  async getLatest(limit: number): Promise<AuditEntry[]> {
    const all = await this.getAll();
    return all.slice(-limit).reverse();
  }

  async getByActor(actorId: ID): Promise<AuditEntry[]> {
    return (await this.getAll()).filter(e => e.actorId === actorId);
  }

  async append(entry: AuditEntry): Promise<AuditEntry> {
    return this.create(entry);
  }
}
