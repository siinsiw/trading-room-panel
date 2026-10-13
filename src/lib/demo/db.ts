// انبار درون‌حافظه‌ای حالت آفلاین + ماندگاری در localStorage.
//
// هر جدول یک آرایهٔ ساده از ردیف‌هاست. نوشتن‌ها فوراً در localStorage ذخیره
// می‌شوند تا رفرش صفحه تغییرات را نگه دارد، و همزمان به مشترک‌های realtime
// اطلاع می‌دهند تا رفتار Supabase Realtime بازتولید شود.

import {
  seedMarkets, seedProfiles, seedOrders, seedTrades, seedSettlements,
  seedSettings, seedAnnouncements, seedHolidays, seedNotifications, seedRegistrations,
  seedAudit, seedMemberGroups,
} from './seed';

export const STORAGE_KEY = 'shams.demo.v2';

export type Row = Record<string, unknown>;
export type TableName =
  | 'profiles' | 'member_groups' | 'markets' | 'orders' | 'trades'
  | 'settlements' | 'audit_log' | 'notifications' | 'system_settings'
  | 'holidays' | 'bot_announcements' | 'registration_requests';

export type Tables = Record<TableName, Row[]>;

function build(): Tables {
  const profiles = seedProfiles();
  return {
    profiles: profiles as unknown as Row[],
    member_groups: seedMemberGroups() as unknown as Row[],
    markets: seedMarkets() as unknown as Row[],
    orders: seedOrders(profiles) as unknown as Row[],
    trades: seedTrades(profiles) as unknown as Row[],
    settlements: seedSettlements() as unknown as Row[],
    audit_log: seedAudit() as unknown as Row[],
    notifications: seedNotifications() as unknown as Row[],
    system_settings: seedSettings() as unknown as Row[],
    holidays: seedHolidays() as unknown as Row[],
    bot_announcements: seedAnnouncements() as unknown as Row[],
    registration_requests: seedRegistrations() as unknown as Row[],
  };
}

// ─── بارگذاری ────────────────────────────────────────────────────────────────

function load(): Tables {
  // تاریخ‌های نسبی («۲ دقیقه پیش») داخل seed محاسبه می‌شوند، پس اگر نسخهٔ
  // ذخیره‌شده مال دیروز باشد داده‌ها کهنه به‌نظر می‌رسند. برای همین کنار داده
  // روزِ ساخت را هم نگه می‌داریم و اگر عوض شده بود از نو seed می‌کنیم.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { day?: string; tables?: Tables };
      if (parsed?.tables && parsed.day === todayStamp()) return parsed.tables;
    }
  } catch {
    // localStorage غیرقابل‌دسترس یا JSON خراب — از seed تازه شروع می‌کنیم
  }
  const fresh = build();
  persist(fresh);
  return fresh;
}

function todayStamp(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

let _tables: Tables | null = null;

export function tables(): Tables {
  if (!_tables) _tables = load();
  return _tables;
}

export function table(name: TableName): Row[] {
  const t = tables();
  if (!t[name]) t[name] = [];
  return t[name];
}

function persist(t: Tables): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ day: todayStamp(), tables: t }));
  } catch {
    // سهمیهٔ localStorage پر است یا حالت خصوصی — حافظه کافی است
  }
}

export function save(): void {
  if (_tables) persist(_tables);
}

/** پاک‌کردن کامل و برگشت به دادهٔ اولیه */
export function resetDemo(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  _tables = build();
  persist(_tables);
}

// ─── Realtime ────────────────────────────────────────────────────────────────

export type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';
export interface ChangePayload {
  eventType: ChangeEvent;
  new: Row | null;
  old: Row | null;
  schema: 'public';
  table: TableName;
}

type Listener = (p: ChangePayload) => void;
const listeners = new Map<symbol, { table: TableName | '*'; events: Set<string>; fn: Listener }>();

export function onChange(
  tableName: TableName | '*',
  event: string,
  fn: Listener,
): () => void {
  const key = Symbol('listener');
  const events = new Set(event === '*' ? ['INSERT', 'UPDATE', 'DELETE'] : [event]);
  listeners.set(key, { table: tableName, events, fn });
  return () => { listeners.delete(key); };
}

export function emit(tableName: TableName, eventType: ChangeEvent, next: Row | null, prev: Row | null): void {
  save();
  const payload: ChangePayload = {
    eventType, new: next, old: prev, schema: 'public', table: tableName,
  };
  for (const l of listeners.values()) {
    if (l.table !== '*' && l.table !== tableName) continue;
    if (!l.events.has(eventType)) continue;
    // مثل Supabase، callback خارج از استک فراخوان اجرا می‌شود
    setTimeout(() => l.fn(payload), 0);
  }
}

// ─── کمکی‌ها ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
export function newId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${_idCounter.toString(36)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}
