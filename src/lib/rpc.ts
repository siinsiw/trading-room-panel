import { supabase } from './supabase';

// Type-safe wrapper around supabase.rpc until all RPC signatures are in database.types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
