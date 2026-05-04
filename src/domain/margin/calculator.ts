import type { User, Trade, MarginResult, Toman } from '../types';

/**
 * مدل دو-آستانه‌ای (مهدی، 2026-05-03):
 *   lossPercentage = درصد ضرر نسبت به ودیعهٔ مورد نیاز (0-100)
 *   safe → loss < warnPct
 *   warn → warnPct ≤ loss < liqPct
 *   call → loss ≥ liqPct  (حراج خودکار)
 */
export function computeMargin(
  trader: User,
  openTrades: Trade[],
  currentPrice: Toman,
  currentTetherRate: Toman,
  warnPct = 75,
  liqPct = 85,
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

  // درصد ضرر = چقدر از ودیعه مورد نیاز در ضرر است
  const lossPercentage = requiredTether === 0
    ? 0
    : Math.max(0, ((requiredTether - availableTether) / requiredTether) * 100);

  const zone: MarginResult['zone'] =
    lossPercentage >= liqPct ? 'call'
    : lossPercentage >= warnPct ? 'warn'
    : 'safe';

  return { requiredTether, availableTether, floatingPnLTether, lossPercentage, zone };
}
