import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'warn' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface UiState {
  sidebarOpen: boolean;
  activeModal: string | null;
  toasts: Toast[];
  setSidebarOpen: (open: boolean) => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  addToast: (message: string, variant?: ToastVariant) => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  activeModal: null,
  toasts: [],

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),

  addToast: (message, variant = 'info') => {
    const id = `toast-${++toastCounter}`;
    set(s => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) =>
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
