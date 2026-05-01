import { create } from 'zustand';
import type { User, Role } from '@/domain/types';

interface AuthState {
  currentUser: User | null;
  role: Role | null;
  setCurrentUser: (user: User) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  role: null,
  setCurrentUser: (user) => set({ currentUser: user, role: user.role }),
  clearSession: () => set({ currentUser: null, role: null }),
}));
