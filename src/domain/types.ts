// ─── Primitive aliases ───────────────────────────────────────────────────────
export type ID = string;            // nanoid(12)
export type Toman = number;         // integer, no decimals
export type Tether = number;        // up to 6 decimals
export type IsoDateTime = string;   // "2026-05-01T12:30:00.000+03:30"
export type JalaliDate = string;    // "1405/02/11" — display only

// ─── Auth ────────────────────────────────────────────────────────────────────
export type Role = 'admin' | 'accountant' | 'trader';

// ─── Market ──────────────────────────────────────────────────────────────────
export interface Market {
  id: ID;
  name: string;           // "طلای آب‌شده"
  symbol: string;         // "GOLD"
  unitWeight: number;     // grams per unit, e.g. 100
  unitLabel: string;      // "گرم" | "عدد"
  lafzMin: number;        // smallest legal lafz, e.g. 1
  lafzMax: number;        // largest legal lafz, e.g. 999
  lafzScale: Toman;       // toman per lafz unit — default 1000
  mazneCurrent: Toman;    // current base price set by admin
  active: boolean;
  createdAt: IsoDateTime;
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: ID;
  fullName: string;
  phone: string;
  telegramId?: string;
  role: Role;
  // Trader-specific (undefined for admin/accountant):
  depositTether?: Tether;       // current balance in USDT
  perUnitDeposit?: Tether;      // required margin per open unit
  commissionPerUnit?: Toman;    // flat commission per unit traded
  active: boolean;
  createdAt: IsoDateTime;
}

// ─── Order ────────────────────────────────────────────────────────────────────
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled';

export interface Order {
  id: ID;
  traderId: ID;
  marketId: ID;
  side: OrderSide;
  lafz: number;                   // the integer the trader wrote
  priceToman: Toman;              // computed: mazne + lafz * lafzScale
  quantity: number;               // units requested
  filled: number;                 // units already matched
  remaining: number;              // quantity - filled
  settlementDate: JalaliDate;     // which day's settlement
  status: OrderStatus;
  placedAt: IsoDateTime;
  cancelledAt?: IsoDateTime;
  cancelReason?: string;
}

// ─── Trade ────────────────────────────────────────────────────────────────────
export interface Trade {
  id: ID;
  marketId: ID;
  buyerId: ID;
  sellerId: ID;
  buyOrderId: ID;
  sellOrderId: ID;
  quantity: number;
  priceToman: Toman;              // matched price — best for buyer (lowest)
  settlementDate: JalaliDate;
  matchedAt: IsoDateTime;
  // Filled at settlement time:
  settled: boolean;
  buyerPnLToman?: Toman;
  sellerPnLToman?: Toman;
  buyerCommission?: Toman;
  sellerCommission?: Toman;
}

// ─── Settlement ───────────────────────────────────────────────────────────────
export interface SettlementSnapshot {
  userId: ID;
  depositBefore: Tether;
  depositAfter: Tether;
  pnL: Toman;
  commission: Toman;
}

export interface Settlement {
  id: ID;
  marketId: ID;
  settlementDate: JalaliDate;
  rateToman: Toman;               // official settlement price
  rateTether: Toman;              // 1 USDT in Toman at settlement time
  appliedAt: IsoDateTime;
  appliedBy: ID;                  // admin user id
  reversedAt?: IsoDateTime;
  reversalReason?: string;
  snapshotBefore: string;         // JSON of SettlementSnapshot[]
  totalTradesCount: number;
  totalVolumeUnits: number;
  totalCommissionToman: Toman;
}

// ─── Audit ────────────────────────────────────────────────────────────────────
export interface AuditEntry {
  id: ID;                         // hash-chained: sha256(prevId + payload)
  prevId?: ID;
  actorId: ID;
  actorRole: Role;
  action: string;                 // "USER_CREATED", "TRADE_EDITED", etc.
  payload: Record<string, unknown>;
  timestamp: IsoDateTime;
}

// ─── Margin ───────────────────────────────────────────────────────────────────
export type MarginZone = 'safe' | 'warn' | 'risk' | 'call';

export interface MarginResult {
  requiredTether: Tether;
  availableTether: Tether;
  floatingPnLTether: Tether;
  percentage: number;
  zone: MarginZone;
}

// ─── Matching ─────────────────────────────────────────────────────────────────
export interface MatchResult {
  trades: Trade[];
  updatedOrders: Order[];
}

// ─── Temporary settlement row ─────────────────────────────────────────────────
export interface TempSettlementRow {
  trader: User;
  floatingPnLToman: Toman;
  floatingPnLTether: Tether;
  commissionAccumulated: Toman;
  margin: MarginResult;
}
