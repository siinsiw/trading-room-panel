// Margin zone classification helpers — extracted from ZoneBadge so
// fast-refresh keeps working there.
import type { MarginZone } from '../types';

export type { MarginZone };

/**
 * Classify a loss percentage into a margin zone using room thresholds.
 * @param lossPct درصد ضرر (0-100)
 * @param warnPct آستانهٔ هشدار (default 75)
 * @param liqPct آستانهٔ حراج (default 85)
 */
export function classifyZone(
  lossPct: number,
  warnPct = 75,
  liqPct = 85,
): MarginZone {
  if (lossPct >= liqPct) return 'call';
  if (lossPct >= warnPct) return 'warn';
  return 'safe';
}
