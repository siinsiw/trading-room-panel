import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  setProfile: (profile: Profile | null) => void;
  loadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  loading: true,
  initialized: false,

  setProfile: (profile) => set({ profile }),

  loadProfile: async () => {
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { set({ profile: null, loading: false, initialized: true }); return; }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      set({ profile: data ?? null, loading: false, initialized: true });
    } catch {
      set({ profile: null, loading: false, initialized: true });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null });
  },
}));

// Initialize on module load — listen to auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    useAuthStore.setState({ profile: null, loading: false, initialized: true });
    return;
  }
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
    await useAuthStore.getState().loadProfile();
  }
});
