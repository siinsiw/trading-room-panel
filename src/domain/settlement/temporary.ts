import type { User, Trade, TempSettlementRow, Toman, Tether } from '../types';
import { computeMargin } from '../margin/calculator';

export function computeTemporarySettlement(
  traders: User[],
  openTrades: Trade[],
  testPriceToman: Toman,
  tetherRate: Toman,
): TempSettlementRow[] {
  return traders
    .filter(t => t.role === 'trader')
    .map(trader => {
      const myTrades = openTrades.filter(
        t => t.buyerId === trader.id || t.sellerId === trader.id
      );

      const floatingPnLToman: Toman = myTrades.reduce((sum, t) => {
        if (t.buyerId === trader.id)
          return sum + (testPriceToman - t.priceToman) * t.quantity;
        return sum + (t.priceToman - testPriceToman) * t.quantity;
      }, 0);

      const floatingPnLTether: Tether = tetherRate > 0
        ? floatingPnLToman / tetherRate
        : 0;

      const commissionAccumulated: Toman = myTrades.reduce(
        (sum, _t) => sum + (trader.commissionPerUnit ?? 0),
        0
      );

      const margin = computeMargin(trader, myTrades, testPriceToman, tetherRate);

      return { trader, floatingPnLToman, floatingPnLTether, commissionAccumulated, margin };
    });
}
