import type { AuditEntry, ID } from '@/domain/types';

export interface AuditRepository {
  getAll(): Promise<AuditEntry[]>;
  getLatest(limit: number): Promise<AuditEntry[]>;
  getByActor(actorId: ID): Promise<AuditEntry[]>;
  append(entry: AuditEntry): Promise<AuditEntry>;
}
