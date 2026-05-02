import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  setProfile: (profile: Profile | null) => void;
  // load profile by user id (or fetch user from supabase if no id given)
  loadProfile: (userId?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
}

// Dedup همزمانی: اگر loadProfile در حال اجراست، promise جاری برمی‌گردد
let inflight: Promise<void> | null = null;

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return (data as Profile | null) ?? null;
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  loading: true,
  initialized: false,

  setProfile: (profile) => set({ profile }),

  loadProfile: async (userId?: string | null) => {
    // اگر در حال اجراست، همان را return می‌دهیم تا concurrent racing نشود
    if (inflight) return inflight;

    inflight = (async () => {
      set({ loading: true });
      try {
        let uid: string | null | undefined = userId;

        // اگر userId ندادند (مثلاً hard refresh)، از session بخوان نه getUser()
        if (uid === undefined) {
          const { data: { session } } = await supabase.auth.getSession();
          uid = session?.user?.id ?? null;
        }

        if (!uid) {
          set({ profile: null, loading: false, initialized: true });
          return;
        }

        const p = await fetchProfile(uid);
        set({ profile: p, loading: false, initialized: true });
      } catch {
        set({ profile: null, loading: false, initialized: true });
      } finally {
        inflight = null;
      }
    })();

    return inflight;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null, loading: false, initialized: true });
  },
}));

// ─── Listen to auth state changes ────────────────────────────────────────────
// نکته: داخل callback از `supabase.auth.getUser()` استفاده نمی‌کنیم
// چون باعث deadlock می‌شود (محدودیت معروف supabase-js).
// به‌جایش از session.user که خود callback می‌دهد استفاده می‌کنیم.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    inflight = null;
    useAuthStore.setState({ profile: null, loading: false, initialized: true });
    return;
  }

  if (event === 'TOKEN_REFRESHED' && !session) {
    // refresh failed — پاک کردن session بدون recursion
    void supabase.auth.signOut({ scope: 'local' });
    return;
  }

  if (
    event === 'SIGNED_IN' ||
    event === 'TOKEN_REFRESHED' ||
    event === 'USER_UPDATED' ||
    event === 'INITIAL_SESSION'
  ) {
    if (session?.user?.id) {
      // فراخوانی async در پس‌زمینه — async داخل callback ممنوع نیست
      // ولی نباید await کنیم تا callback را ببندد.
      void useAuthStore.getState().loadProfile(session.user.id);
    } else if (event === 'INITIAL_SESSION') {
      // هیچ session ای وجود نداشت
      useAuthStore.setState({ profile: null, loading: false, initialized: true });
    }
  }
});

// Fallback: اگر در ۶ ثانیه initialized نشد، باز کن
setTimeout(() => {
  if (!useAuthStore.getState().initialized) {
    useAuthStore.setState({ profile: null, loading: false, initialized: true });
  }
}, 6000);
