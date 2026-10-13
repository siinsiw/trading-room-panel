import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { IS_DEMO, bootstrapDemo } from './demo';
import { createDemoClient } from './demo/client';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string;

// در حالت آفلاین هیچ اتصالی به شبکه برقرار نمی‌شود: کلاینت جعلی همان سطح
// PostgREST/Auth/Realtime را روی دادهٔ درون‌حافظه‌ای می‌سازد. (src/lib/demo)
function makeClient() {
  if (IS_DEMO) {
    bootstrapDemo();
    return createDemoClient() as unknown as ReturnType<typeof createClient<Database>>;
  }

  if (!url || !key) {
    throw new Error(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local — ' +
      'یا برای کار بدون بک‌اند، `npm run dev:demo` را اجرا کنید.',
    );
  }

  return createClient<Database>(url, key, {
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
}

export const supabase = makeClient();
export { IS_DEMO };
