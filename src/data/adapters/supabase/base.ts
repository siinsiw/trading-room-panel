import { supabase } from '@/lib/supabase';
import type { PostgrestError } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function unwrap<T>(data: T | null, error: PostgrestError | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No data returned');
  return data;
}

export class SupabaseBase<T extends { id: string }> {
  protected readonly table: string;
  constructor(table: string) { this.table = table; }

  async getAll(): Promise<T[]> {
    const { data, error } = await db.from(this.table).select('*').order('id');
    if (error) throw new Error((error as PostgrestError).message);
    return (data ?? []) as T[];
  }

  async getById(id: string): Promise<T | null> {
    const { data, error } = await db.from(this.table).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error((error as PostgrestError).message);
    return data as T | null;
  }

  async create(item: T): Promise<T> {
    const { data, error } = await db.from(this.table).insert(item).select().single();
    if (error) throw new Error((error as PostgrestError).message);
    return data as T;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const { data, error } = await db.from(this.table).update(patch).eq('id', id).select().single();
    if (error) throw new Error((error as PostgrestError).message);
    return data as T;
  }

  async updateMany(items: T[]): Promise<T[]> {
    const { data, error } = await db.from(this.table).upsert(items).select();
    if (error) throw new Error((error as PostgrestError).message);
    return (data ?? []) as T[];
  }

  async createMany(items: T[]): Promise<T[]> {
    if (!items.length) return [];
    const { data, error } = await db.from(this.table).insert(items).select();
    if (error) throw new Error((error as PostgrestError).message);
    return (data ?? []) as T[];
  }

  async delete(id: string): Promise<void> {
    const { error } = await db.from(this.table).delete().eq('id', id);
    if (error) throw new Error((error as PostgrestError).message);
  }
}
