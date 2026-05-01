import { nanoid } from 'nanoid';
import type { Settlement, Trade, User, AuditEntry, ID } from '../types';

const REVERSAL_WINDOW_MS = 30 * 60 * 1000;

export interface ReversalInput {
  settlement: Settlement;
  allTrades: Trade[];
  allTraders: User[];
  actorId: ID;
  actorRole: AuditEntry['actorRole'];
  reason: string;
}

export interface ReversalResult {
  updatedSettlement: Settlement;
  restoredTrades: Trade[];
  restoredTraders: User[];
  auditEntry: AuditEntry;
}

export function reverseSettlement(input: ReversalInput): ReversalResult {
  const { settlement } = input;

  if (settlement.reversedAt) {
    throw new Error('این تصفیه قبلاً برگشت خورده است.');
  }

  const elapsed = Date.now() - new Date(settlement.appliedAt).getTime();
  if (elapsed > REVERSAL_WINDOW_MS) {
    throw new Error('پنجره ۳۰ دقیقه‌ای برگشت تصفیه به پایان رسیده است.');
  }

  const snapshot: Array<{
    userId: ID;
    depositBefore: number;
    depositAfter: number;
    pnL: number;
    commission: number;
  }> = JSON.parse(settlement.snapshotBefore);

  const traderMap = new Map(input.allTraders.map(u => [u.id, { ...u }]));
  for (const snap of snapshot) {
    const trader = traderMap.get(snap.userId);
    if (trader) {
      trader.depositTether = snap.depositBefore;
    }
  }

  const restoredTrades = input.allTrades.map(t =>
    t.settled && t.settlementDate === settlement.settlementDate && t.marketId === settlement.marketId
      ? { ...t, settled: false, buyerPnLToman: undefined, sellerPnLToman: undefined, buyerCommission: undefined, sellerCommission: undefined }
      : t
  );

  const now = new Date().toISOString();

  const updatedSettlement: Settlement = {
    ...settlement,
    reversedAt: now,
    reversalReason: input.reason,
  };

  const auditEntry: AuditEntry = {
    id: nanoid(12),
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: 'SETTLEMENT_REVERSED',
    payload: { settlementId: settlement.id, reason: input.reason },
    timestamp: now,
  };

  return {
    updatedSettlement,
    restoredTrades,
    restoredTraders: Array.from(traderMap.values()),
    auditEntry,
  };
}
