// وضعیت احراز هویت حالت آفلاین.
//
// جدا از client.ts نگه داشته شده چون rpc.ts هم به کاربر جاری نیاز دارد و
// نباید به کلاینت وابسته شود (وگرنه import حلقه‌ای می‌شود).

import { table, save } from './db';
import type { Row } from './db';

export interface DemoUser {
  id: string;
  email: string;
  phone: string;
  role: 'authenticated';
  aud: 'authenticated';
  created_at: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
}

export interface DemoSession {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
  expires_at: number;
  user: DemoUser;
}

const SESSION_KEY = 'shams.demo.session.v1';

/** ایمیل ساختگی هر پروفایل — ورود با همین‌ها انجام می‌شود */
export function emailFor(profileId: string): string {
  return `${profileId}@demo.local`;
}

function profileToUser(p: Row): DemoUser {
  return {
    id: p.id as string,
    email: emailFor(p.id as string),
    phone: (p.phone as string) ?? '',
    role: 'authenticated',
    aud: 'authenticated',
    created_at: (p.created_at as string) ?? new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: p.full_name, phone: p.phone },
  };
}

export function makeSession(p: Row): DemoSession {
  return {
    access_token: `demo.${p.id}.${Date.now().toString(36)}`,
    refresh_token: `demo-refresh.${p.id}`,
    token_type: 'bearer',
    expires_in: 3_600,
    expires_at: Math.floor(Date.now() / 1_000) + 3_600,
    user: profileToUser(p),
  };
}

let _session: DemoSession | null | undefined;

export function getDemoSession(): DemoSession | null {
  if (_session === undefined) {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      _session = raw ? (JSON.parse(raw) as DemoSession) : null;
    } catch {
      _session = null;
    }
  }
  return _session ?? null;
}

export function getDemoUser(): DemoUser | null {
  return getDemoSession()?.user ?? null;
}

export function setDemoSession(s: DemoSession | null): void {
  _session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // حالت خصوصی مرورگر — نشست فقط در حافظه می‌ماند
  }
  save();
}

/** ورود بدون رمز — برای پارامتر `?as=` و دکمه‌های میان‌بر دمو */
export function signInAs(profileId: string): DemoSession | null {
  const p = table('profiles').find((x) => x.id === profileId);
  if (!p) return null;
  const s = makeSession(p);
  setDemoSession(s);
  return s;
}

/** یافتن پروفایل با ایمیل ساختگی یا نام/شناسه */
export function findProfileByEmail(email: string): Row | undefined {
  const norm = email.trim().toLowerCase();
  const rows = table('profiles');
  const byEmail = rows.find((p) => emailFor(p.id as string).toLowerCase() === norm);
  if (byEmail) return byEmail;
  // میان‌برهای راحت: admin@demo.local / accountant@demo.local / trader@demo.local
  const alias: Record<string, string> = {
    'admin@demo.local': 'u-admin-1',
    'accountant@demo.local': 'u-acct-1',
    'trader@demo.local': 'u-trader-1',
  };
  const id = alias[norm];
  return id ? rows.find((p) => p.id === id) : undefined;
}

// ─── مشترک‌های onAuthStateChange ─────────────────────────────────────────────

export type AuthEvent =
  | 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY';

type AuthListener = (event: AuthEvent, session: DemoSession | null) => void;
const authListeners = new Set<AuthListener>();

export function addAuthListener(fn: AuthListener): () => void {
  authListeners.add(fn);
  return () => { authListeners.delete(fn); };
}

export function emitAuth(event: AuthEvent, session: DemoSession | null): void {
  for (const fn of authListeners) {
    setTimeout(() => fn(event, session), 0);
  }
}
