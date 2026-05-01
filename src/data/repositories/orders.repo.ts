import type { Order, ID, JalaliDate } from '@/domain/types';

export interface OrdersRepository {
  getAll(): Promise<Order[]>;
  getById(id: ID): Promise<Order | null>;
  getByTrader(traderId: ID): Promise<Order[]>;
  getByMarketAndDate(marketId: ID, settlementDate: JalaliDate): Promise<Order[]>;
  create(order: Order): Promise<Order>;
  createMany(orders: Order[]): Promise<Order[]>;
  update(id: ID, patch: Partial<Order>): Promise<Order>;
  updateMany(orders: Order[]): Promise<Order[]>;
  delete(id: ID): Promise<void>;
}
