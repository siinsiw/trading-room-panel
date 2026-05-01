import { create } from 'zustand';
import type { Order, Trade } from '@/domain/types';

interface OrderbookState {
  orders: Order[];
  recentTrades: Trade[];
  lastUpdated: number;
  setOrders: (orders: Order[]) => void;
  setRecentTrades: (trades: Trade[]) => void;
  invalidate: () => void;
}

export const useOrderbookStore = create<OrderbookState>((set) => ({
  orders: [],
  recentTrades: [],
  lastUpdated: 0,

  setOrders: (orders) => set({ orders, lastUpdated: Date.now() }),
  setRecentTrades: (trades) => set({ recentTrades: trades }),
  invalidate: () => set({ lastUpdated: Date.now() }),
}));

// Derived selectors
export const selectBidsByMarket = (orders: Order[], marketId: string) =>
  orders
    .filter(o => o.marketId === marketId && o.side === 'buy'  && (o.status === 'open' || o.status === 'partial'))
    .sort((a, b) => b.priceToman - a.priceToman);

export const selectAsksByMarket = (orders: Order[], marketId: string) =>
  orders
    .filter(o => o.marketId === marketId && o.side === 'sell' && (o.status === 'open' || o.status === 'partial'))
    .sort((a, b) => a.priceToman - b.priceToman);
