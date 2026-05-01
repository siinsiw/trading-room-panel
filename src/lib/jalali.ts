import { toFa } from './persian';

export function formatJalaliDate(jalali: string): string {
  return toFa(jalali);
}

export function formatIsoToJalali(iso: string): string {
  const date = new Date(iso);
  const fmt = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'persian',
    numberingSystem: 'latn',
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  return toFa(`${get('year')}/${get('month')}/${get('day')}`);
}

export function formatIsoToTime(iso: string): string {
  const date = new Date(iso);
  return toFa(date.toLocaleTimeString('fa-IR', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }));
}

export function formatIsoFull(iso: string): string {
  return `${formatIsoToJalali(iso)} ${formatIsoToTime(iso)}`;
}
