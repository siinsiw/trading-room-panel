import type { User, Trade, MarginResult, Toman } from '../types';

export function computeMargin(
  trader: User,
  openTrades: Trade[],
  currentPrice: Toman,
  currentTetherRate: Toman,
): MarginResult {
  const openUnits = openTrades.reduce((s, t) => {
    if (t.buyerId === trader.id || t.sellerId === trader.id) return s + t.quantity;
    return s;
  }, 0);

  const requiredTether = openUnits * (trader.perUnitDeposit ?? 0);

  const floatingPnLToman = openTrades.reduce((sum, t) => {
    if (t.buyerId === trader.id)
      return sum + (currentPrice - t.priceToman) * t.quantity;
    if (t.sellerId === trader.id)
      return sum + (t.priceToman - currentPrice) * t.quantity;
    return sum;
  }, 0);

  const floatingPnLTether = currentTetherRate > 0
    ? floatingPnLToman / currentTetherRate
    : 0;

  const availableTether = (trader.depositTether ?? 0) + floatingPnLTether;

  const percentage = requiredTether === 0
    ? 100
    : (availableTether / requiredTether) * 100;

  const zone: MarginResult['zone'] =
    percentage >= 85 ? 'safe'
    : percentage >= 70 ? 'warn'
    : percentage >= 50 ? 'risk'
    : 'call';

  return { requiredTether, availableTether, floatingPnLTether, percentage, zone };
}
