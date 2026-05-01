import { useEffect } from 'react';
import { subscribeToTable, type RealtimeOptions } from '@/lib/realtime';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export function useRealtime<T extends Record<string, unknown>>(
  opts: RealtimeOptions,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void,
  deps: unknown[] = []
) {
  useEffect(() => {
    const unsub = subscribeToTable<T>(opts, onChange);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
