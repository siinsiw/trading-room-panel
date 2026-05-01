import { toFa } from './persian';

export function formatPrice(toman: number): string {
  return toFa(toman.toLocaleString('en-US')) + ' تومان';
}

export function formatTetherAmount(usdt: number): string {
  return toFa(usdt.toFixed(4)) + ' USDT';
}

export function formatPnL(toman: number): string {
  const sign = toman >= 0 ? '+' : '';
  return `${sign}${toFa(Math.round(toman).toLocaleString('en-US'))} تومان`;
}

export function formatQuantity(n: number, label = 'واحد'): string {
  return `${toFa(n)} ${label}`;
}

export function formatPercent(p: number, decimals = 1): string {
  return `${toFa(p.toFixed(decimals))}٪`;
}
