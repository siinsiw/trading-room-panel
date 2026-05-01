import { supabase } from '@/lib/supabase';
import type { AuditEntry, ID } from '@/domain/types';
import type { AuditRepository } from '@/data/repositories/audit.repo';
import { SupabaseBase, unwrap } from './base';

export class AuditSupabase extends SupabaseBase<AuditEntry> implements AuditRepository {
  constructor() { super('audit_log'); }

  async getLatest(limit: number): Promise<AuditEntry[]> {
    const { data, error } = await supabase
      .from('audit_log').select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    return unwrap(data, error) as AuditEntry[];
  }

  async getByActor(actorId: ID): Promise<AuditEntry[]> {
    const { data, error } = await supabase
      .from('audit_log').select('*').eq('actorId', actorId);
    return unwrap(data, error) as AuditEntry[];
  }

  async append(entry: AuditEntry): Promise<AuditEntry> {
    return this.create(entry);
  }
}


