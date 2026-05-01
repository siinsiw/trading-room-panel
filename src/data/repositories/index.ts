// Unified repository facade — wraps Supabase repos and converts to camelCase domain types.
// Pages import from here and use camelCase domain types throughout.

import { marketsRepo }     from '@/data/adapters/supabase/markets.sb';
import { ordersRepo }      from '@/data/adapters/supabase/orders.sb';
import { tradesRepo }      from '@/data/adapters/supabase/trades.sb';
import { usersRepo }       from '@/data/adapters/supabase/users.sb';
import { settlementsRepo } from '@/data/adapters/supabase/settlements.sb';
import { notificationsRepo } from '@/data/adapters/supabase/notifications.sb';
import { dbToMarket, dbToOrder, dbToTrade, dbToSettlement } from '@/lib/adapters';
import type { Market, Order, Trade, Settlement, ID, JalaliDate, Role } from '@/domain/types';
import type { Profile } from '@/lib/database.types';

export { marketsRepo, ordersRepo, tradesRepo, usersRepo, settlementsRepo, notificationsRepo };

export const repos = {
  // ─── Markets ──────────────────────────────────────────────────────────────
  markets: {
    getAll:  async (): Promise<Market[]>        => (await marketsRepo.list()).map(dbToMarket),
    getById: async (id: ID): Promise<Market | null> => {
      const d = await marketsRepo.getById(id);
      return d ? dbToMarket(d) : null;
    },
    create: async (m: Market): Promise<Market> => {
      const d = await marketsRepo.create({
        name: m.name, symbol: m.symbol,
        unit_weight: m.unitWeight, unit_label: m.unitLabel,
        lafz_min: m.lafzMin, lafz_max: m.lafzMax, lafz_scale: m.lafzScale,
        mazne_current: m.mazneCurrent, active: m.active,
      } as Parameters<typeof marketsRepo.create>[0]);
      return dbToMarket(d);
    },
    update: async (id: ID, patch: Partial<Market>): Promise<Market> => {
      const d = await marketsRepo.update(id, {
        ...(patch.name          !== undefined && { name:         patch.name }),
        ...(patch.symbol        !== undefined && { symbol:       patch.symbol }),
        ...(patch.unitWeight    !== undefined && { unit_weight:  patch.unitWeight }),
        ...(patch.unitLabel     !== undefined && { unit_label:   patch.unitLabel }),
        ...(patch.lafzMin       !== undefined && { lafz_min:     patch.lafzMin }),
        ...(patch.lafzMax       !== undefined && { lafz_max:     patch.lafzMax }),
        ...(patch.lafzScale     !== undefined && { lafz_scale:   patch.lafzScale }),
        ...(patch.mazneCurrent  !== undefined && { mazne_current: patch.mazneCurrent }),
        ...(patch.active        !== undefined && { active:       patch.active }),
      });
      return dbToMarket(d);
    },
    updateMazne: (id: ID, newMazne: number) => marketsRepo.updateMazne(id, newMazne),
  },

  // ─── Users ────────────────────────────────────────────────────────────────
  users: {
    getAll:            (): Promise<Profile[]>      => usersRepo.list(),
    getByRole:         (role: Role): Promise<Profile[]> => usersRepo.list({ role }),
    getById:           (id: ID): Promise<Profile | null> => usersRepo.getById(id),
    getCurrent:        (): Promise<Profile | null> => usersRepo.getCurrent(),
    listPending:       (): Promise<Profile[]>      => usersRepo.listPendingApprovals(),
    update:            (id: ID, d: Partial<Profile>) => usersRepo.update(id, d),
    approve:           (id: ID, dep: number, pu: number, com: number) =>
                         usersRepo.approve(id, dep, pu, com),
  },

  // ─── Orders ───────────────────────────────────────────────────────────────
  orders: {
    getByTrader:       async (_traderId: ID): Promise<Order[]> =>
                         (await ordersRepo.listMine()).map(dbToOrder),
    getByMarketAndDate: async (marketId: ID, settlementDate: JalaliDate): Promise<Order[]> =>
                         (await ordersRepo.listOrderBook(marketId, settlementDate)).map(dbToOrder),
    placeOrder:        (marketId: ID, side: 'buy'|'sell', lafz: number, qty: number, date: JalaliDate) =>
                         ordersRepo.placeOrder(marketId, side, lafz, qty, date),
    cancelOrder:       (id: ID, reason?: string) => ordersRepo.cancelOrder(id, reason),
  },

  // ─── Trades ───────────────────────────────────────────────────────────────
  trades: {
    getAll:            async (): Promise<Trade[]> =>
                         (await tradesRepo.listAll()).map(dbToTrade),
    getByTrader:       async (_traderId: ID): Promise<Trade[]> =>
                         (await tradesRepo.listMine()).map(dbToTrade),
    getByMarketAndDate: async (marketId: ID, date: JalaliDate): Promise<Trade[]> =>
                         (await tradesRepo.listByMarketAndDate(marketId, date)).map(dbToTrade),
    getUnsettled:      async (): Promise<Trade[]> =>
                         (await tradesRepo.listAll({ settled: false })).map(dbToTrade),
  },

  // ─── Settlements ─────────────────────────────────────────────────────────
  settlements: {
    getAll:      async (filter?: { marketId?: string }): Promise<Settlement[]> =>
                   (await settlementsRepo.list(filter)).map(dbToSettlement),
    getById:     async (id: ID): Promise<Settlement | null> => {
      const d = await settlementsRepo.getById(id);
      return d ? dbToSettlement(d) : null;
    },
    getLatest:   async (): Promise<Settlement | null> => {
      const all = await settlementsRepo.list();
      if (!all.length) return null;
      const d = all.sort((a, b) => b.applied_at.localeCompare(a.applied_at))[0];
      return dbToSettlement(d);
    },
    getPreview:  (mid: ID, date: JalaliDate, price: number, rate: number) =>
                   settlementsRepo.getPreview(mid, date, price, rate),
    applyFinal:  (mid: ID, date: JalaliDate, rt: number, rte: number) =>
                   settlementsRepo.applyFinal(mid, date, rt, rte),
    reverse:     (id: ID, reason: string) => settlementsRepo.reverse(id, reason),
  },

  // ─── Audit (stub - append-only via triggers, no direct write) ────────────
  audit: {
    getLatest: async (limit = 20) => {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);
      return data ?? [];
    },
  },
};
