import { nanoid } from 'nanoid';
import type {
  User, Trade, Settlement, AuditEntry,
  Toman, JalaliDate, ID,
} from '../types';

export interface FinalSettlementInput {
  marketId: ID;
  settlementDate: JalaliDate;
  rateToman: Toman;
  rateTether: Toman;
  appliedBy: ID;
  appliedByRole: AuditEntry['actorRole'];
  trades: Trade[];
  traders: User[];
}

export interface FinalSettlementResult {
  settlement: Settlement;
  updatedTrades: Trade[];
  updatedTraders: User[];
  auditEntry: AuditEntry;
  cancelledOrderIds: ID[];
}

export function applyFinalSettlement(input: FinalSettlementInput): FinalSettlementResult {
  const { marketId, settlementDate, rateToman, rateTether, appliedBy, appliedByRole } = input;

  const relevantTrades = input.trades.filter(
    t => t.marketId === marketId && t.settlementDate === settlementDate && !t.settled
  );

  const traderMap = new Map(input.traders.map(u => [u.id, { ...u }]));

  const snapshotBefore = input.traders
    .filter(u => u.role === 'trader')
    .map(u => ({ userId: u.id, depositBefore: u.depositTether ?? 0 }));

  const updatedTrades: Trade[] = relevantTrades.map(trade => {
    const buyer  = traderMap.get(trade.buyerId);
    const seller = traderMap.get(trade.sellerId);

    const buyerPnLToman: Toman  = (rateToman - trade.priceToman) * trade.quantity;
    const sellerPnLToman: Toman = -buyerPnLToman;
    const buyerCommission: Toman  = (buyer?.commissionPerUnit  ?? 0) * trade.quantity;
    const sellerCommission: Toman = (seller?.commissionPerUnit ?? 0) * trade.quantity;

    if (buyer && rateTether > 0) {
      const net = (buyerPnLToman - buyerCommission) / rateTether;
      buyer.depositTether = (buyer.depositTether ?? 0) + net;
    }
    if (seller && rateTether > 0) {
      const net = (sellerPnLToman - sellerCommission) / rateTether;
      seller.depositTether = (seller.depositTether ?? 0) + net;
    }

    return { ...trade, settled: true, buyerPnLToman, sellerPnLToman, buyerCommission, sellerCommission };
  });

  const snapshotAfter = snapshotBefore.map(s => ({
    ...s,
    depositAfter: traderMap.get(s.userId)?.depositTether ?? 0,
    pnL: 0,
    commission: 0,
  }));

  const now = new Date().toISOString();
  const settlementId = nanoid(12);

  const settlement: Settlement = {
    id: settlementId,
    marketId,
    settlementDate,
    rateToman,
    rateTether,
    appliedAt: now,
    appliedBy,
    snapshotBefore: JSON.stringify(snapshotAfter),
    totalTradesCount: relevantTrades.length,
    totalVolumeUnits: relevantTrades.reduce((s, t) => s + t.quantity, 0),
    totalCommissionToman: updatedTrades.reduce(
      (s, t) => s + (t.buyerCommission ?? 0) + (t.sellerCommission ?? 0),
      0
    ),
  };

  const auditEntry: AuditEntry = {
    id: nanoid(12),
    actorId: appliedBy,
    actorRole: appliedByRole,
    action: 'SETTLEMENT_APPLIED',
    payload: { settlementId, marketId, settlementDate, rateToman, rateTether },
    timestamp: now,
  };

  return {
    settlement,
    updatedTrades,
    updatedTraders: Array.from(traderMap.values()),
    auditEntry,
    cancelledOrderIds: [],
  };
}
