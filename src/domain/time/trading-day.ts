import type { JalaliDate } from '../types';

const TRADING_OPEN_HOUR  = 9;
const TRADING_OPEN_MIN   = 0;
const LOCK_HOUR          = 13;
const LOCK_MIN           = 30;

function getTehranParts(): { h: number; m: number; s: number; jalali: string } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'persian',
    hour12: false,
    numberingSystem: 'latn',
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0';
  return {
    h: parseInt(get('hour'), 10),
    m: parseInt(get('minute'), 10),
    s: parseInt(get('second'), 10),
    jalali: `${get('year')}/${get('month')}/${get('day')}`,
  };
}

export function getCurrentTradingDate(): JalaliDate {
  return getTehranParts().jalali;
}

export function isTradingOpen(): boolean {
  const { h, m } = getTehranParts();
  const minutes = h * 60 + m;
  return minutes >= TRADING_OPEN_HOUR * 60 + TRADING_OPEN_MIN
      && minutes <  LOCK_HOUR * 60 + LOCK_MIN;
}

export function isTodayBookLocked(): boolean {
  const { h, m } = getTehranParts();
  return h * 60 + m >= LOCK_HOUR * 60 + LOCK_MIN;
}

export function getLockCountdown(): number {
  const { h, m, s } = getTehranParts();
  const nowSec  = h * 3600 + m * 60 + s;
  const lockSec = LOCK_HOUR * 3600 + LOCK_MIN * 60;
  return Math.max(0, lockSec - nowSec);
}

export function getNextSettlementDate(orderType: 'today' | 'tomorrow'): JalaliDate {
  const today = getCurrentTradingDate();
  if (orderType === 'today') return today;

  // increment day in jalali (simple — assumes same month)
  const [y, mo, d] = today.split('/').map(Number);
  const nextDay = d + 1;
  // month lengths in jalali: first 6 months = 31, next 5 = 30, last = 29/30
  const daysInMonth = mo <= 6 ? 31 : mo <= 11 ? 30 : 29;
  if (nextDay > daysInMonth) {
    const nextMo = mo + 1 > 12 ? 1 : mo + 1;
    const nextYear = mo + 1 > 12 ? y + 1 : y;
    return `${nextYear}/${String(nextMo).padStart(2, '0')}/01`;
  }
  return `${y}/${String(mo).padStart(2, '0')}/${String(nextDay).padStart(2, '0')}`;
}
