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
  depositTether?: Tether;       // current balance in USDT (ودیعه)
  perUnitDeposit?: Tether;      // required margin per open unit (بیعانه)
  commissionPerUnit?: Toman;    // flat commission per unit traded
  memberGroupId?: ID;           // گروه کاربری برای کمیسیون پلکانی
  referrerId?: ID;              // معرف
  referralBonusPct?: number;    // درصد پاداش از کمیسیون زیرمجموعه
  maxOpenUnits?: number;        // سقف موقعیت باز (null = بدون محدودیت)
  active: boolean;
  createdAt: IsoDateTime;
}

// ─── Order (لفظ) ─────────────────────────────────────────────────────────────
// در دامنه‌ی واقعی، یک Order همان «لفظ» تلگرامی است:
//   - side: خرید (خ) یا فروش (ف)
//   - kind: امروزی (today) یا فردایی (tomorrow) — معادل «خ/ف» vs «خف/فف»
//   - allOrNothing: لفظ یک‌جا (پارشال‌فیل ممنوع)
//   - expiresAt: TTL یک‌دقیقه‌ای (default از system_settings.lafz_ttl_seconds)
//   - overriddenAt: اگر مالک با «ب روی برکت» تأیید کرده باشد، تنظیم می‌شود
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled' | 'expired';
export type LafzKind = 'today' | 'tomorrow';

export interface Order {
  id: ID;
  traderId: ID;
  marketId: ID;
  side: OrderSide;
  kind: LafzKind;
  lafz: number;                   // the integer the trader wrote (می‌تواند منفی باشد)
  priceToman: Toman;              // computed: mazne + lafz * lafzScale
  quantity: number;               // units requested
  filled: number;                 // units already matched
  remaining: number;              // quantity - filled
  settlementDate: JalaliDate;     // which day's settlement
  status: OrderStatus;
  allOrNothing: boolean;          // لفظ «یک‌جا» — نباید پارشال‌فیل شود
  placedAt: IsoDateTime;
  expiresAt?: IsoDateTime;        // TTL یک دقیقه‌ای
  overriddenAt?: IsoDateTime;     // مالک «ب» روی برکت زده تا overrides TTL
  cancelledAt?: IsoDateTime;
  cancelReason?: string;          // 'user_n' (لغو با ن) | 'auto_expired' | 'auto_cancel_settlement' | …
  telegramMsgId?: number;
}

// ─── Trade ────────────────────────────────────────────────────────────────────
// نوع معامله: عادی، اجاره، بلوکه — اجاره/بلوکه عدد توافقی اضافه دارد.
export type TradeType = 'normal' | 'rent' | 'blocked';

export interface Trade {
  id: ID;
  marketId: ID;
  buyerId: ID;
  sellerId: ID;
  buyOrderId?: ID;                // null برای ثبت دستی
  sellOrderId?: ID;
  quantity: number;
  priceToman: Toman;              // matched price — best for buyer (lowest)
  settlementDate: JalaliDate;
  kind: LafzKind;                 // today / tomorrow
  tradeType: TradeType;           // normal / rent / blocked
  rentBlockValue?: Toman;         // عدد توافقی برای rent/blocked
  note?: string;                  // مثلاً «بدون پری»
  manual: boolean;                // ثبت دستی؟
  source: 'bot' | 'panel' | 'today_tomorrow_group';
  createdBy?: ID;                 // ادمین/حسابداری که ثبت کرد
  matchedAt: IsoDateTime;
  // Filled at settlement time:
  settled: boolean;
  settlementId?: ID;
  buyerPnLToman?: Toman;
  sellerPnLToman?: Toman;
  buyerCommission?: Toman;
  sellerCommission?: Toman;
}

// ─── Member Group (گروه‌بندی برای کمیسیون پلکانی) ───────────────────────────
export interface MemberGroup {
  id: ID;
  name: string;
  commissionPerUnit: Toman;       // کمیسیون پایه‌ی گروه
  description?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
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
