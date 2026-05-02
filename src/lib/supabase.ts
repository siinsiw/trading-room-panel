import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string;

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local');
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // از lock پیش‌فرض supabase-js (Web Locks API) استفاده می‌کنیم.
    // قبلاً یک override no-op داشتیم که باعث race condition بین onAuthStateChange
    // و فراخوانی‌های همزمان auth می‌شد.
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
