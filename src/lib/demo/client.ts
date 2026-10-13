// کلاینت جعلی Supabase برای حالت آفلاین.
//
// همان سطحی را می‌سازد که پنل واقعاً استفاده می‌کند: `.from()` با زنجیرهٔ
// PostgREST، `.rpc()`، `.auth` و `.channel()`. چون تمام کد پنل از همین یک
// ماژول (`@/lib/supabase`) کلاینت می‌گیرد، هیچ صفحه‌ای لازم نیست عوض شود.
//
// قرارداد خروجی عیناً PostgREST است: `{ data, error }` و نه throw. هر جا
// آداپتورها `error.message` را می‌خوانند، اینجا هم همان شکل برمی‌گردد.

import {
  table, emit, newId, nowISO, onChange, resetDemo,
} from './db';
import type { Row, TableName } from './db';
import { callRpc } from './rpc';
import {
  getDemoSession, getDemoUser, setDemoSession, makeSession,
  findProfileByEmail, addAuthListener, emitAuth, emailFor,
} from './auth-state';
import type { DemoSession } from './auth-state';

// ─── کمکی‌ها ─────────────────────────────────────────────────────────────────

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

interface PgError { message: string; details: string; hint: string; code: string }
const pgError = (message: string, code = 'DEMO'): PgError =>
  ({ message, details: '', hint: '', code });

type Filter = (r: Row) => boolean;

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'fa');
}

/** مقدار رشته‌ایِ فیلتر PostgREST را به مقدار واقعی تبدیل می‌کند */
function coerce(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

// ─── سازندهٔ کوئری ───────────────────────────────────────────────────────────

type Op = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

interface Result<T = unknown> {
  data: T; error: PgError | null; count: number | null;
  status: number; statusText: string;
}

class QueryBuilder implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private sorts: Array<{ col: string; asc: boolean }> = [];
  private op: Op = 'select';
  private payload: Row[] = [];
  private patch: Row = {};
  private onConflict = 'id';
  private returning = false;
  private limitN: number | null = null;
  private wantCount = false;
  private headOnly = false;
  private rowMode: 'many' | 'single' | 'maybe' = 'many';

  private readonly name: TableName;
  constructor(name: TableName) { this.name = name; }

  // ── فیلترها ──
  eq(col: string, val: unknown)  { this.filters.push((r) => looseEq(r[col], val)); return this; }
  neq(col: string, val: unknown) { this.filters.push((r) => !looseEq(r[col], val)); return this; }
  gt(col: string, val: unknown)  { this.filters.push((r) => cmp(r[col], val) > 0);  return this; }
  gte(col: string, val: unknown) { this.filters.push((r) => cmp(r[col], val) >= 0); return this; }
  lt(col: string, val: unknown)  { this.filters.push((r) => cmp(r[col], val) < 0);  return this; }
  lte(col: string, val: unknown) { this.filters.push((r) => cmp(r[col], val) <= 0); return this; }
  is(col: string, val: unknown)  { this.filters.push((r) => r[col] === val); return this; }

  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.some((v) => looseEq(r[col], v)));
    return this;
  }

  like(col: string, pattern: string)  { return this.ilike(col, pattern); }
  ilike(col: string, pattern: string) {
    const rx = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`, 'i');
    this.filters.push((r) => rx.test(String(r[col] ?? '')));
    return this;
  }

  /** `col.op.value,col2.op.value` — همان قالبی که trades.listMine می‌فرستد */
  or(expr: string) {
    const parts = expr.split(',').map((s) => s.trim()).filter(Boolean);
    this.filters.push((r) => parts.some((p) => {
      const [col, op, ...rest] = p.split('.');
      const val = coerce(rest.join('.'));
      switch (op) {
        case 'eq':  return looseEq(r[col], val);
        case 'neq': return !looseEq(r[col], val);
        case 'gt':  return cmp(r[col], val) > 0;
        case 'gte': return cmp(r[col], val) >= 0;
        case 'lt':  return cmp(r[col], val) < 0;
        case 'lte': return cmp(r[col], val) <= 0;
        case 'is':  return r[col] === val;
        default:    return false;
      }
    }));
    return this;
  }

  match(obj: Row) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }

  // ── ترتیب و برش ──
  order(col: string, opts?: { ascending?: boolean }) {
    this.sorts.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) {
    this.filters.push(() => true);
    this.limitN = to - from + 1;
    return this;
  }

  // ── عملیات ──
  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      this.wantCount = !!opts?.count;
      this.headOnly = !!opts?.head;
    }
    this.returning = true;
    return this;
  }

  insert(rows: Row | Row[]) {
    this.op = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.returning = false;
    return this;
  }

  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.onConflict = opts?.onConflict ?? 'id';
    this.returning = false;
    return this;
  }

  update(patch: Row) {
    this.op = 'update';
    this.patch = patch;
    this.returning = false;
    return this;
  }

  delete() {
    this.op = 'delete';
    this.returning = false;
    return this;
  }

  single()      { this.rowMode = 'single'; this.returning = true; return this; }
  maybeSingle() { this.rowMode = 'maybe';  this.returning = true; return this; }

  // ── اجرا ──
  private matching(): Row[] {
    return table(this.name).filter((r) => this.filters.every((f) => f(r)));
  }

  private sorted(rows: Row[]): Row[] {
    if (!this.sorts.length) return rows;
    const out = [...rows];
    out.sort((a, b) => {
      for (const s of this.sorts) {
        const d = cmp(a[s.col], b[s.col]);
        if (d !== 0) return s.asc ? d : -d;
      }
      return 0;
    });
    return out;
  }

  private ok<T>(data: T, count: number | null = null): Result<T> {
    return { data, error: null, count, status: 200, statusText: 'OK' };
  }
  private fail(msg: string, code = 'DEMO'): Result<null> {
    return { data: null, error: pgError(msg, code), count: null, status: 400, statusText: 'Bad Request' };
  }

  private shape(rows: Row[]): Result {
    if (this.rowMode === 'single') {
      if (rows.length !== 1) {
        return this.fail(
          rows.length === 0
            ? 'ردیفی پیدا نشد (JSON object requested, multiple (or no) rows returned)'
            : 'بیش از یک ردیف برگشت',
          'PGRST116',
        );
      }
      return this.ok(clone(rows[0]));
    }
    if (this.rowMode === 'maybe') {
      if (rows.length > 1) return this.fail('بیش از یک ردیف برگشت', 'PGRST116');
      return this.ok(rows.length ? clone(rows[0]) : null);
    }
    return this.ok(clone(rows));
  }

  private run(): Result {
    const rows = table(this.name);

    switch (this.op) {
      case 'select': {
        const found = this.sorted(this.matching());
        const sliced = this.limitN != null ? found.slice(0, this.limitN) : found;
        if (this.headOnly) {
          return { data: null, error: null, count: found.length, status: 200, statusText: 'OK' };
        }
        const res = this.shape(sliced);
        if (this.wantCount) res.count = found.length;
        return res;
      }

      case 'insert': {
        const created: Row[] = [];
        for (const raw of this.payload) {
          const row = clone(raw);
          const hasIdCol = rows.length === 0 || 'id' in rows[0];
          if (hasIdCol && row.id == null) row.id = newId(this.name.slice(0, 3));
          if ('created_at' in (rows[0] ?? {}) && row.created_at == null) row.created_at = nowISO();
          if ('updated_at' in (rows[0] ?? {}) && row.updated_at == null) row.updated_at = nowISO();
          rows.push(row);
          created.push(row);
          emit(this.name, 'INSERT', row, null);
        }
        return this.returning ? this.shape(created) : this.ok(null);
      }

      case 'upsert': {
        const touched: Row[] = [];
        const keys = this.onConflict.split(',').map((k) => k.trim());
        for (const raw of this.payload) {
          const incoming = clone(raw);
          const existing = rows.find((r) => keys.every((k) => looseEq(r[k], incoming[k])));
          if (existing) {
            const prev = clone(existing);
            Object.assign(existing, incoming);
            if ('updated_at' in existing) existing.updated_at = nowISO();
            touched.push(existing);
            emit(this.name, 'UPDATE', existing, prev);
          } else {
            if (incoming.id == null && rows.length && 'id' in rows[0]) {
              incoming.id = newId(this.name.slice(0, 3));
            }
            rows.push(incoming);
            touched.push(incoming);
            emit(this.name, 'INSERT', incoming, null);
          }
        }
        return this.returning ? this.shape(touched) : this.ok(null);
      }

      case 'update': {
        const targets = this.matching();
        const updated: Row[] = [];
        for (const r of targets) {
          const prev = clone(r);
          Object.assign(r, clone(this.patch));
          if ('updated_at' in r) r.updated_at = nowISO();
          updated.push(r);
          emit(this.name, 'UPDATE', r, prev);
        }
        return this.returning ? this.shape(updated) : this.ok(null);
      }

      case 'delete': {
        const targets = this.matching();
        const removed: Row[] = [];
        for (const r of targets) {
          const i = rows.indexOf(r);
          if (i >= 0) {
            rows.splice(i, 1);
            removed.push(clone(r));
            emit(this.name, 'DELETE', null, r);
          }
        }
        return this.returning ? this.shape(removed) : this.ok(null);
      }
    }
  }

  then<TR1 = Result, TR2 = never>(
    onFulfilled?: ((v: Result) => TR1 | PromiseLike<TR1>) | null,
    onRejected?: ((reason: unknown) => TR2 | PromiseLike<TR2>) | null,
  ): PromiseLike<TR1 | TR2> {
    let out: Result;
    try {
      out = this.run();
    } catch (err) {
      out = {
        data: null, count: null, status: 500, statusText: 'Error',
        error: pgError(err instanceof Error ? err.message : String(err)),
      };
    }
    // تأخیر یک تیک تا رفتار async واقعی بازتولید شود (هوک‌های React روی
    // فرض «داده بعداً می‌رسد» نوشته شده‌اند)
    return new Promise<Result>((resolve) => setTimeout(() => resolve(out), 0))
      .then(onFulfilled, onRejected);
  }
}

// ─── کانال Realtime ──────────────────────────────────────────────────────────

class DemoChannel {
  private offs: Array<() => void> = [];
  readonly topic: string;
  constructor(topic: string) { this.topic = topic; }

  on(
    _type: string,
    cfg: { event?: string; schema?: string; table?: string; filter?: string },
    cb: (payload: unknown) => void,
  ) {
    const tableName = (cfg.table ?? '*') as TableName | '*';
    const event = cfg.event ?? '*';

    // `filter` به شکل `col=eq.value` می‌آید
    let pass: (r: Row | null) => boolean = () => true;
    if (cfg.filter) {
      const m = /^(\w+)=eq\.(.*)$/.exec(cfg.filter);
      if (m) {
        const [, col, val] = m;
        pass = (r) => !!r && looseEq(r[col], coerce(val));
      }
    }

    this.offs.push(onChange(tableName, event, (p) => {
      const rec = p.new ?? p.old;
      if (!pass(rec)) return;
      cb({
        eventType: p.eventType, new: p.new ?? {}, old: p.old ?? {},
        schema: p.schema, table: p.table, commit_timestamp: nowISO(), errors: null,
      });
    }));
    return this;
  }

  subscribe(cb?: (status: string) => void) {
    if (cb) setTimeout(() => cb('SUBSCRIBED'), 0);
    return this;
  }

  unsubscribe() {
    for (const off of this.offs) off();
    this.offs = [];
    return Promise.resolve('ok');
  }
}

// ─── احراز هویت ──────────────────────────────────────────────────────────────

const authApi = {
  async getSession() {
    return { data: { session: getDemoSession() }, error: null };
  },

  async getUser() {
    const user = getDemoUser();
    return { data: { user }, error: user ? null : pgError('نشستی وجود ندارد', 'no_session') };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const p = findProfileByEmail(email ?? '');
    if (!p) {
      return { data: { user: null, session: null }, error: pgError('ایمیل یا رمز عبور اشتباه است', 'invalid_credentials') };
    }
    if (!password || password.length < 4) {
      return { data: { user: null, session: null }, error: pgError('رمز عبور کوتاه است', 'invalid_credentials') };
    }
    if (p.active === false) {
      // مسیر «منتظر تأیید» هم باید در دمو قابل دیدن باشد
      const s = makeSession(p);
      setDemoSession(s);
      emitAuth('SIGNED_IN', s);
      return { data: { user: s.user, session: s }, error: null };
    }
    const s = makeSession(p);
    setDemoSession(s);
    emitAuth('SIGNED_IN', s);
    return { data: { user: s.user, session: s }, error: null };
  },

  async signUp({ email, password, options }: {
    email: string; password: string;
    options?: { data?: Record<string, unknown> };
  }) {
    if (findProfileByEmail(email ?? '')) {
      return { data: { user: null, session: null }, error: pgError('این ایمیل قبلاً ثبت شده است', 'user_exists') };
    }
    if (!password || password.length < 6) {
      return { data: { user: null, session: null }, error: pgError('رمز عبور باید حداقل ۶ کاراکتر باشد', 'weak_password') };
    }
    const meta = options?.data ?? {};
    const id = newId('u-new');
    const profile: Row = {
      id, full_name: (meta.full_name as string) ?? 'کاربر جدید',
      phone: (meta.phone as string) ?? '', telegram_id: (meta.telegram_id as string) ?? null,
      role: 'trader', active: false,
      deposit_tether: null, per_unit_deposit: null, commission_per_unit: null,
      member_group_id: null, referrer_id: null, referral_bonus_pct: null,
      max_open_units: null, approved_by: null, approved_at: null,
      is_credit_user: false, credit_units: null, margin_call_disabled: false,
      alias: null, created_at: nowISO(), updated_at: nowISO(),
    };
    table('profiles').push(profile);
    emit('profiles', 'INSERT', profile, null);

    const s = makeSession(profile);
    setDemoSession(s);
    emitAuth('SIGNED_IN', s);
    return { data: { user: s.user, session: s }, error: null };
  },

  async signOut() {
    setDemoSession(null);
    emitAuth('SIGNED_OUT', null);
    return { error: null };
  },

  async setSession(s: Partial<DemoSession>) {
    const current = getDemoSession();
    if (!current) return { data: { user: null, session: null }, error: pgError('نشستی برای بازیابی نیست') };
    const merged = { ...current, ...s } as DemoSession;
    setDemoSession(merged);
    return { data: { user: merged.user, session: merged }, error: null };
  },

  async updateUser(attrs: { password?: string; email?: string; data?: Record<string, unknown> }) {
    const s = getDemoSession();
    if (!s) return { data: { user: null }, error: pgError('ابتدا وارد شوید') };
    if (attrs.email) s.user.email = attrs.email;
    if (attrs.data) s.user.user_metadata = { ...s.user.user_metadata, ...attrs.data };
    setDemoSession(s);
    emitAuth('USER_UPDATED', s);
    return { data: { user: s.user }, error: null };
  },

  async resetPasswordForEmail() {
    // در دمو ایمیلی ارسال نمی‌شود؛ مسیر موفق را برمی‌گردانیم تا UI کامل دیده شود
    return { data: {}, error: null };
  },

  async resend() {
    return { data: {}, error: null };
  },

  onAuthStateChange(cb: (event: string, session: DemoSession | null) => void) {
    const off = addAuthListener(cb);
    // مثل supabase-js، رویداد اولیه بلافاصله پس از ثبت فرستاده می‌شود
    setTimeout(() => cb('INITIAL_SESSION', getDemoSession()), 0);
    return { data: { subscription: { id: 'demo-sub', callback: cb, unsubscribe: off } } };
  },
};

// ─── کلاینت ──────────────────────────────────────────────────────────────────

export function createDemoClient() {
  const channels = new Map<string, DemoChannel>();

  return {
    __demo: true,

    from(name: TableName) { return new QueryBuilder(name); },

    rpc(name: string, args?: Record<string, unknown>) {
      const res = callRpc(name, args ?? {});
      return new Promise((resolve) => setTimeout(() => resolve(res), 0));
    },

    auth: authApi,

    channel(topic: string) {
      const ch = new DemoChannel(topic);
      channels.set(topic, ch);
      return ch;
    },

    removeChannel(ch: DemoChannel) {
      if (!ch) return Promise.resolve('ok');
      channels.delete(ch.topic);
      return ch.unsubscribe();
    },

    removeAllChannels() {
      const all = [...channels.values()];
      channels.clear();
      return Promise.all(all.map((c) => c.unsubscribe()));
    },

    getChannels() { return [...channels.values()]; },

    // سطح‌هایی که پنل فعلاً استفاده نمی‌کند ولی نبودشان خطای runtime می‌دهد
    storage: {
      from() {
        return {
          getPublicUrl: (path: string) => ({ data: { publicUrl: `/demo-asset/${path}` } }),
          upload: async () => ({ data: null, error: pgError('آپلود در حالت آفلاین ممکن نیست') }),
          download: async () => ({ data: null, error: pgError('دانلود در حالت آفلاین ممکن نیست') }),
          remove: async () => ({ data: null, error: null }),
        };
      },
    },

    functions: {
      invoke: async (fn: string) => ({
        data: null, error: pgError(`Edge Function «${fn}» در حالت آفلاین در دسترس نیست`),
      }),
    },
  };
}

export { resetDemo, emailFor };
