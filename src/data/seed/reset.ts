import { supabase } from '@/lib/supabase';

export function resetToSeedData(): void {
  // In Supabase mode, seed is done via SQL migration (supabase/migrations/0001_init.sql)
  // This function is a no-op — the seed data is already in the database.
  console.info('[seed] Supabase mode: seed data managed via SQL migration.');
}

export async function isSeeded(): Promise<boolean> {
  const { data, error } = await supabase.from('markets').select('id').limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}
