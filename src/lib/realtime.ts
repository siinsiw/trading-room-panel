import { supabase } from './supabase';
import type {
  RealtimePostgresChangesPayload,
  RealtimeChannel,
} from '@supabase/supabase-js';

export type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeFilter {
  column: string;
  value: string;
}

export interface RealtimeOptions {
  table: string;
  event?: ChangeEvent;
  filter?: RealtimeFilter;
  schema?: string;
}

type ChangeCallback<T extends Record<string, unknown>> = (
  payload: RealtimePostgresChangesPayload<T>
) => void;

let channelCounter = 0;

export function subscribeToTable<T extends Record<string, unknown>>(
  opts: RealtimeOptions,
  callback: ChangeCallback<T>
): () => void {
  const channelName = `realtime-${opts.table}-${++channelCounter}`;
  const filterStr = opts.filter
    ? `${opts.filter.column}=eq.${opts.filter.value}`
    : undefined;

  const channel: RealtimeChannel = supabase.channel(channelName);

  channel.on(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    'postgres_changes',
    {
      event: opts.event ?? '*',
      schema: opts.schema ?? 'public',
      table: opts.table,
      ...(filterStr ? { filter: filterStr } : {}),
    },
    callback as ChangeCallback<Record<string, unknown>>
  ).subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
