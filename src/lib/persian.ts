const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];

export function toFa(n: number | string): string {
  return String(n).replace(/\d/g, d => FA_DIGITS[Number(d)]);
}

export function toEn(n: string): string {
  return n
    .replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632));
}

export function formatTomans(n: number): string {
  return toFa(n.toLocaleString('en-US')) + ' تومان';
}

export function formatTether(n: number, decimals = 4): string {
  return toFa(n.toFixed(decimals)) + ' USDT';
}

export function formatLafz(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${toFa(n)}`;
}
