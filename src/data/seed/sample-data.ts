import { nanoid } from 'nanoid';
import type { Market, User, Order, Trade, Settlement, AuditEntry } from '@/domain/types';
import { getCurrentTradingDate, getNextSettlementDate } from '@/domain/time/trading-day';

const MAZNE = 88_300_000;
const TETHER_RATE = 97_000;

const TRADER_NAMES = [
  'رضا کریمی', 'مریم حسینی', 'امیر صوری',
  'فاطمه محمدی', 'علی رضایی', 'زهرا نوری',
  'حسن قاسمی', 'نیلوفر احمدی',
];

export function generateSampleData() {
  const today = getCurrentTradingDate();
  const tomorrow = getNextSettlementDate('tomorrow');

  // ─── Market ─────────────────────────────────────────────────────────────────
  const goldMarket: Market = {
    id: 'market-gold',
    name: 'طلای آب‌شده',
    symbol: 'GOLD',
    unitWeight: 100,
    unitLabel: 'گرم',
    lafzMin: 1,
    lafzMax: 999,
    lafzScale: 1000,
    mazneCurrent: MAZNE,
    active: true,
    createdAt: new Date().toISOString(),
  };

  // ─── Admins ──────────────────────────────────────────────────────────────────
  const admins: User[] = [
    { id: 'admin-1', fullName: 'مدیر اصلی',  phone: '09100000001', role: 'admin',      active: true, createdAt: new Date().toISOString() },
    { id: 'admin-2', fullName: 'معاون',       phone: '09100000002', role: 'admin',      active: true, createdAt: new Date().toISOString() },
    { id: 'admin-3', fullName: 'ناظر',        phone: '09100000003', role: 'admin',      active: true, createdAt: new Date().toISOString() },
  ];

  const accountant: User = {
    id: 'acct-1', fullName: 'حسابدار آرش', phone: '09100000010',
    role: 'accountant', active: true, createdAt: new Date().toISOString(),
  };

  // ─── Traders ─────────────────────────────────────────────────────────────────
  const traders: User[] = TRADER_NAMES.map((name, i) => ({
    id: `trader-${i + 1}`,
    fullName: name,
    phone: `0911000${String(i + 1).padStart(4, '0')}`,
    role: 'trader' as const,
    depositTether: 2000 + Math.floor(Math.random() * 18000),
    perUnitDeposit: 500,
    commissionPerUnit: 50_000,
    active: true,
    createdAt: new Date().toISOString(),
  }));

  // ─── Orders ──────────────────────────────────────────────────────────────────
  const orders: Order[] = [];
  const lafzValues = [285, 300, 310, 295, 315, 290, 305, 320, 280, 275, 295, 310, 300, 285, 320];

  for (let i = 0; i < 15; i++) {
    const trader = traders[i % traders.length];
    const side = i % 2 === 0 ? 'buy' : 'sell';
    const lafz = lafzValues[i];
    const priceToman = MAZNE + lafz * 1000;
    const settlementDate = i < 10 ? today : tomorrow;

    orders.push({
      id: nanoid(12),
      traderId: trader.id,
      marketId: goldMarket.id,
      side,
      kind: i < 10 ? 'today' : 'tomorrow',
      lafz,
      priceToman,
      quantity: 1 + Math.floor(Math.random() * 3),
      filled: 0,
      remaining: 1 + Math.floor(Math.random() * 3),
      settlementDate,
      status: 'open',
      allOrNothing: false,
      placedAt: new Date(Date.now() - i * 60_000).toISOString(),
    });
  }
  // fix remaining = quantity
  orders.forEach(o => { o.remaining = o.quantity; });

  // ─── Historical trades ────────────────────────────────────────────────────────
  const trades: Trade[] = Array.from({ length: 5 }, (_, i) => ({
    id: nanoid(12),
    marketId: goldMarket.id,
    buyerId: traders[i % traders.length].id,
    sellerId: traders[(i + 1) % traders.length].id,
    buyOrderId: nanoid(12),
    sellOrderId: nanoid(12),
    quantity: 1,
    priceToman: MAZNE + (250 + i * 10) * 1000,
    settlementDate: today,
    kind: 'today',
    tradeType: 'normal',
    manual: false,
    source: 'panel',
    matchedAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
    settled: false,
  }));

  // ─── Historical settlements ───────────────────────────────────────────────────
  const [prevYear, prevMonth, prevDay] = today.split('/').map(Number);
  const prevDate = `${prevYear}/${String(prevMonth).padStart(2,'0')}/${String(Math.max(prevDay - 1, 1)).padStart(2,'0')}`;

  const pastSettlement: Settlement = {
    id: nanoid(12),
    marketId: goldMarket.id,
    settlementDate: prevDate,
    rateToman: MAZNE + 200_000,
    rateTether: TETHER_RATE,
    appliedAt: new Date(Date.now() - 86_400_000).toISOString(),
    appliedBy: 'admin-1',
    snapshotBefore: JSON.stringify(
      traders.map(t => ({ userId: t.id, depositBefore: t.depositTether, depositAfter: t.depositTether, pnL: 0, commission: 0 }))
    ),
    totalTradesCount: 8,
    totalVolumeUnits: 10,
    totalCommissionToman: 800_000,
  };

  // ─── Audit entries ────────────────────────────────────────────────────────────
  const auditEntries: AuditEntry[] = [
    { id: nanoid(12), actorId: 'admin-1', actorRole: 'admin', action: 'SEED_INITIALIZED',  payload: { message: 'داده‌های نمونه بارگذاری شدند' }, timestamp: new Date().toISOString() },
    { id: nanoid(12), actorId: 'admin-1', actorRole: 'admin', action: 'SETTLEMENT_APPLIED', payload: { settlementDate: prevDate }, timestamp: new Date(Date.now() - 86_400_000).toISOString() },
  ];

  return {
    markets: [goldMarket],
    users: [...admins, accountant, ...traders],
    orders,
    trades,
    settlements: [pastSettlement],
    auditEntries,
  };
}
