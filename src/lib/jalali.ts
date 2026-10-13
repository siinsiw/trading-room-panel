import { toFa } from './persian';

export function formatJalaliDate(jalali: string): string {
  return toFa(jalali);
}

export function formatIsoToJalali(iso: string): string {
  const date = new Date(iso);
  // Intl روی Invalid Date استثنا می‌دهد و چون این تابع مستقیم داخل render
  // صدا زده می‌شود، یک ستون تاریخِ خالی کل صفحه را سفید می‌کرد.
  if (Number.isNaN(date.getTime())) return '—';
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
  if (Number.isNaN(date.getTime())) return '—';
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

// ─── تاریخ و ساعت برای پوستهٔ پنل (۲۰۲۶-۱۰-۱۳) ─────────────────────────────

const MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export function jalaliParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran', calendar: 'persian', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const p = fmt.formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** «۱۴۰۵/۰۷/۲۱» با رقم لاتین — کلید تاریخ در دیتابیس */
export function todayJalaliKey(): string {
  const { y, m, d } = jalaliParts();
  return `${y}/${m}/${d}`;
}

/** «سه‌شنبه ۲۱ مهر ۱۴۰۵» */
export function longJalaliDate(date = new Date()): string {
  const { y, m, d } = jalaliParts(date);
  const weekday = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long' }).format(date);
  return `${weekday} ${toFa(Number(d))} ${MONTHS[Number(m) - 1] ?? ''} ${toFa(y)}`;
}

/** ثانیه → «۱:۴۲:۱۰» یا «۴۲:۱۰» */
export function clockFromSeconds(total: number): string {
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return toFa(h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`);
}

/** دقیقه از نیمه‌شب به وقت تهران — محور زمان نمودار قیمت */
export function tehranMinute(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}
