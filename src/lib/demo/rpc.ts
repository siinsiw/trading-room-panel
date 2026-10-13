// پیاده‌سازی RPCهای دیتابیس برای حالت آفلاین.
//
// هدف «برابری رفتاری» است نه «برابری پیاده‌سازی»: هر تابع باید همان شکل خروجی
// و همان عوارض جانبی روی جدول‌ها را داشته باشد که نسخهٔ SQL دارد، تا صفحه‌های
// پنل دقیقاً مثل حالت واقعی رفتار کنند.

import { table, emit, newId, nowISO, save } from './db';
import type { Row } from './db';
import { getDemoUser } from './auth-state';

type Args = Record<string, unknown>;

const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : d;
};

function findRow(name: Parameters<typeof table>[0], id: string): Row | undefined {
  return table(name).find((r) => r.id === id);
}

// ─── مارجین ──────────────────────────────────────────────────────────────────

/** ودیعهٔ مؤثر: کاربر اعتباری ودیعه‌اش لحظه‌ای از تعداد واحد اعتبار می‌آید */
function effectiveDeposit(p: Row): number {
  if (p.is_credit_user) return num(p.credit_units) * num(p.per_unit_deposit, 500);
  return num(p.deposit_tether);
}

interface Position { units: number; tradeCount: number; floatingToman: number }

/**
 * موقعیت باز کاربر در یک بازار.
 * علامت سود/زیان دقیقاً مثل SQL: خریدار با بالا رفتن قیمت سود می‌کند،
 * فروشنده با پایین آمدن. معاملات حراج‌شده (`liquidated_at`) کنار گذاشته می‌شوند.
 */
function openPosition(userId: string, marketId: string, price: number): Position {
  let units = 0;
  let tradeCount = 0;
  let floatingToman = 0;
  for (const t of table('trades')) {
    if (t.settled) continue;
    if (t.liquidated_at) continue;
    if (marketId && t.market_id !== marketId) continue;
    const q = num(t.quantity);
    const tp = num(t.price_toman);
    if (t.buyer_id === userId) {
      units += q; tradeCount += 1; floatingToman += (price - tp) * q;
    } else if (t.seller_id === userId) {
      units += q; tradeCount += 1; floatingToman += (tp - price) * q;
    }
  }
  return { units, tradeCount, floatingToman };
}

/**
 * برابر با `compute_user_margin` در مایگریشن ۰۰۰۸.
 *
 * نکتهٔ مهم: `percentage` سلامت ودیعه است نه مصرف آن — ۱۰۰ یعنی دست‌نخورده.
 * زیان با `loss_percentage` سنجیده می‌شود و آستانه‌های warn/liq روی همان‌اند.
 */
function marginOf(userId: string, marketId: string, currentPrice: number, tetherRate: number) {
  const p = findRow('profiles', userId);
  const market = findRow('markets', marketId);
  const warn = num(market?.margin_warn_pct, 75);
  const liq = num(market?.margin_liquidate_pct, 85);

  if (!p) {
    return {
      required_tether: 0, available_tether: 0, floating_pnl_tether: 0,
      floating_pnl_toman: 0, loss_percentage: 0, percentage: 100,
      zone: 'safe' as const, warn_pct: warn, liq_pct: liq,
      margin_call_disabled: false, is_credit_user: false, trade_count: 0,
    };
  }

  const { units, tradeCount, floatingToman } = openPosition(userId, marketId, currentPrice);
  const rate = tetherRate > 0 ? tetherRate : 97_000;
  const floatingTether = floatingToman / rate;

  const required = units * num(p.per_unit_deposit);
  const available = effectiveDeposit(p) + floatingTether;
  const lossPct = required === 0 ? 0 : Math.max(0, ((required - available) / required) * 100);

  const disabled = !!p.margin_call_disabled;
  const zone: 'safe' | 'warn' | 'call' =
    lossPct >= liq ? (disabled ? 'warn' : 'call')
    : lossPct >= warn ? 'warn'
    : 'safe';

  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    required_tether: r2(required),
    available_tether: r2(available),
    floating_pnl_tether: r2(floatingTether),
    floating_pnl_toman: Math.round(floatingToman),
    loss_percentage: r2(lossPct),
    percentage: r2(100 - lossPct),
    zone,
    warn_pct: warn,
    liq_pct: liq,
    margin_call_disabled: disabled,
    is_credit_user: !!p.is_credit_user,
    trade_count: tradeCount,
  };
}

// ─── لاگ ممیزی ───────────────────────────────────────────────────────────────

function audit(action: string, payload: unknown): void {
  const rows = table('audit_log');
  const prev = rows[rows.length - 1];
  const user = getDemoUser();
  const profile = user ? findRow('profiles', user.id) : undefined;
  const id = newId('aud');
  rows.push({
    id,
    prev_id: (prev?.id as string) ?? null,
    hash: `${id}${'0'.repeat(64)}`.slice(0, 64),
    actor_id: user?.id ?? 'unknown',
    actor_role: (profile?.role as string) ?? 'admin',
    action,
    payload,
    timestamp: nowISO(),
  });
  emit('audit_log', 'INSERT', rows[rows.length - 1], null);
}

// ─── توابع ───────────────────────────────────────────────────────────────────

const handlers: Record<string, (a: Args) => unknown> = {

  update_mazne(a) {
    const m = findRow('markets', a.p_market_id as string);
    if (!m) throw new Error('بازار پیدا نشد');
    const prev = { ...m };
    m.mazne_current = num(a.p_new_mazne);
    m.updated_at = nowISO();
    emit('markets', 'UPDATE', m, prev);
    audit('update_mazne', { market_id: m.id, from: prev.mazne_current, to: m.mazne_current });
    return null;
  },

  place_order(a) {
    const user = getDemoUser();
    if (!user) throw new Error('ابتدا وارد شوید');
    const market = findRow('markets', a.p_market_id as string);
    if (!market) throw new Error('بازار پیدا نشد');

    const lafz = num(a.p_lafz);
    const qty = num(a.p_quantity);
    const side = a.p_side as 'buy' | 'sell';
    const price = market.lafz_price_mode === 'last3'
      ? Math.round(num(market.mazne_current) / 1_000) * 1_000 + lafz
      : num(market.mazne_current) + lafz * num(market.lafz_scale, 1_000);

    const ttl = num(
      (table('system_settings').find((s) => s.key === 'lafz_ttl_seconds')?.value as number), 60,
    );

    const id = newId('ord');
    const order: Row = {
      id, trader_id: user.id, market_id: market.id, side,
      kind: a.p_settlement_date === null ? 'today' : 'today',
      lafz, price_toman: price, price_kind: 'relative',
      quantity: qty, filled: 0, remaining: qty,
      settlement_date: a.p_settlement_date as string,
      status: 'open', all_or_nothing: false,
      placed_at: nowISO(),
      expires_at: new Date(Date.now() + ttl * 1_000).toISOString(),
      overridden_at: null, override_count: 0, is_porat: false,
      cancelled_at: null, cancel_reason: null, telegram_msg_id: null,
    };
    table('orders').push(order);
    emit('orders', 'INSERT', order, null);
    audit('place_order', { order_id: id, side, lafz, quantity: qty });
    return { order_id: id, trades: [], remaining: qty };
  },

  cancel_order(a) {
    const o = findRow('orders', a.p_order_id as string);
    if (!o) throw new Error('لفظ پیدا نشد');
    if (o.status === 'filled') throw new Error('لفظ پرشده قابل لغو نیست');
    const prev = { ...o };
    o.status = 'cancelled';
    o.cancelled_at = nowISO();
    o.cancel_reason = (a.p_reason as string) ?? 'user_n';
    emit('orders', 'UPDATE', o, prev);
    audit('cancel_order', { order_id: o.id, reason: o.cancel_reason });
    return null;
  },

  compute_user_margin(a) {
    return marginOf(
      a.p_user_id as string, a.p_market_id as string,
      num(a.p_current_price), num(a.p_tether_rate),
    );
  },

  get_settlement_preview(a) {
    const marketId = a.p_market_id as string;
    const date = a.p_settlement_date as string;
    const price = num(a.p_test_price);
    const rate = num(a.p_tether_rate, 97_000);

    const involved = new Set<string>();
    for (const t of table('trades')) {
      if (t.settled) continue;
      if (t.market_id !== marketId) continue;
      if (date && t.settlement_date !== date) continue;
      involved.add(t.buyer_id as string);
      involved.add(t.seller_id as string);
    }

    const warn = num(findRow('markets', marketId)?.margin_warn_pct, 75);
    const liq = num(findRow('markets', marketId)?.margin_liquidate_pct, 85);

    return [...involved].map((uid) => {
      const p = findRow('profiles', uid);

      // فقط معاملات همین تاریخ و همین بازار. مبنای `required` و
      // `commission` تعداد **واحد** است، نه تعداد معامله (باگ مایگریشن
      // ۰۰۱۲: یک معاملهٔ ۱۰ واحدی، ۱ واحد حساب می‌شد).
      let floatingToman = 0;
      let openUnits = 0;
      for (const t of table('trades')) {
        if (t.settled || t.market_id !== marketId) continue;
        if (date && t.settlement_date !== date) continue;
        const q = num(t.quantity);
        const tp = num(t.price_toman);
        if (t.buyer_id === uid) { floatingToman += (price - tp) * q; openUnits += q; }
        else if (t.seller_id === uid) { floatingToman += (tp - price) * q; openUnits += q; }
      }

      const floatingTether = rate > 0 ? floatingToman / rate : 0;
      const deposit = effectiveDeposit(p ?? {});
      const required = openUnits * num(p?.per_unit_deposit);
      const available = deposit + floatingTether;
      const lossPct = required === 0 ? 0 : Math.max(0, ((required - available) / required) * 100);
      const percentage = 100 - lossPct;
      const zone = lossPct >= liq
        ? (p?.margin_call_disabled ? 'warn' : 'call')
        : lossPct >= warn ? 'warn' : 'safe';

      const r2 = (n: number) => Math.round(n * 100) / 100;
      return {
        trader_id: uid,
        full_name: (p?.full_name as string) ?? '—',
        deposit_tether: r2(deposit),
        open_units: openUnits,
        floating_pnl_toman: Math.round(floatingToman),
        floating_pnl_tether: r2(floatingTether),
        // کمیسیون تتری است و دیگر در نرخ تتر ضرب نمی‌شود
        commission_accumulated: r2(openUnits * num(p?.commission_per_unit, 1)),
        required_tether: r2(required),
        available_tether: r2(available),
        percentage: r2(percentage),
        loss_percentage: r2(lossPct),
        zone,
      };
    }).sort((x, y) => x.percentage - y.percentage);
  },

  apply_settlement(a) {
    const marketId = a.p_market_id as string;
    const date = a.p_settlement_date as string;
    const rateToman = num(a.p_rate_toman);
    const rateTether = num(a.p_rate_tether, 97_000);

    const affected = table('trades').filter(
      (t) => !t.settled && t.market_id === marketId && t.settlement_date === date,
    );
    if (affected.length === 0) throw new Error('معاملهٔ تسویه‌نشده‌ای برای این تاریخ نیست');

    const settlementId = newId('stl');
    const snapshot = affected.map((t) => ({ ...t }));
    const traders = new Set<string>();
    let volume = 0;
    let commission = 0;

    for (const t of affected) {
      const prev = { ...t };
      const q = num(t.quantity);
      const pnl = (rateToman - num(t.price_toman)) * q;
      t.settled = true;
      t.settlement_id = settlementId;
      t.buyer_pnl_toman = pnl;
      t.seller_pnl_toman = -pnl;
      traders.add(t.buyer_id as string);
      traders.add(t.seller_id as string);
      volume += q;
      // کمیسیون تتری است — نه در نرخ ضرب می‌شود نه تقسیم
      commission += (num(t.buyer_commission, 1) + num(t.seller_commission, 1)) * q;
      emit('trades', 'UPDATE', t, prev);
    }

    // اعمال سود/زیان روی ودیعهٔ تتری
    for (const uid of traders) {
      const p = findRow('profiles', uid);
      if (!p || p.is_credit_user) continue;
      let deltaToman = 0;
      for (const t of affected) {
        if (t.buyer_id === uid) deltaToman += num(t.buyer_pnl_toman);
        if (t.seller_id === uid) deltaToman += num(t.seller_pnl_toman);
      }
      let commTether = 0;
      for (const t of affected) {
        const q = num(t.quantity);
        if (t.buyer_id === uid)  commTether += num(t.buyer_commission, 1) * q;
        if (t.seller_id === uid) commTether += num(t.seller_commission, 1) * q;
      }
      const prev = { ...p };
      // سود تومانی تبدیل می‌شود، کمیسیون تتری مستقیم کم می‌شود
      p.deposit_tether =
        Math.round((num(p.deposit_tether) + deltaToman / rateTether - commTether) * 100) / 100;
      p.updated_at = nowISO();
      emit('profiles', 'UPDATE', p, prev);
    }

    const row: Row = {
      id: settlementId, market_id: marketId, settlement_date: date,
      rate_toman: rateToman, rate_tether: rateTether,
      applied_at: nowISO(), applied_by: getDemoUser()?.id ?? 'u-admin-1',
      reversed_at: null, reversal_reason: null,
      snapshot_before: snapshot,
      total_trades_count: affected.length,
      total_volume_units: volume,
      total_commission_tether: Math.round(commission * 100) / 100,
    };
    table('settlements').push(row);
    emit('settlements', 'INSERT', row, null);
    audit('apply_settlement', { settlement_id: settlementId, date, rate_toman: rateToman });

    return { settlement_id: settlementId, affected_traders: traders.size };
  },

  apply_emergency_settlement(a) {
    const marketId = a.p_market_id as string;
    const market = findRow('markets', marketId);
    const open = table('trades').filter((t) => !t.settled && t.market_id === marketId);
    if (open.length === 0) throw new Error('معاملهٔ بازی برای تصفیهٔ فوری نیست');
    const date = open[0].settlement_date as string;

    const res = handlers.apply_settlement({
      p_market_id: marketId, p_settlement_date: date,
      p_rate_toman: a.p_rate_toman, p_rate_tether: a.p_rate_tether,
    }) as { settlement_id: string };

    const isParry = market?.mode === 'parry';
    audit('apply_emergency_settlement', { settlement_id: res.settlement_id, reason: a.p_reason });
    return { settlement_id: res.settlement_id, reason: isParry ? 'parry_triggered' : 'manual' };
  },

  reverse_settlement(a) {
    const s = findRow('settlements', a.p_settlement_id as string);
    if (!s) throw new Error('تصفیه پیدا نشد');
    if (s.reversed_at) throw new Error('این تصفیه قبلاً برگشت خورده');

    const limitMin = num(
      table('system_settings').find((x) => x.key === 'settlement_reverse_minutes')?.value as number, 60,
    );
    const ageMin = (Date.now() - new Date(s.applied_at as string).getTime()) / 60_000;
    if (ageMin > limitMin) {
      throw new Error(`پنجرهٔ برگشت تصفیه (${limitMin} دقیقه) گذشته است`);
    }

    for (const t of table('trades')) {
      if (t.settlement_id !== s.id) continue;
      const prev = { ...t };
      t.settled = false;
      t.settlement_id = null;
      t.buyer_pnl_toman = null;
      t.seller_pnl_toman = null;
      emit('trades', 'UPDATE', t, prev);
    }
    const prev = { ...s };
    s.reversed_at = nowISO();
    s.reversal_reason = a.p_reason as string;
    emit('settlements', 'UPDATE', s, prev);
    audit('reverse_settlement', { settlement_id: s.id, reason: a.p_reason });
    return null;
  },

  approve_trader(a) {
    return handlers.approve_user({
      p_user_id: a.p_trader_id,
      p_deposit: a.p_deposit,
      p_per_unit_deposit: a.p_per_unit_deposit,
      p_commission: a.p_commission,
    });
  },

  approve_user(a) {
    const p = findRow('profiles', a.p_user_id as string);
    if (!p) throw new Error('کاربر پیدا نشد');
    const prev = { ...p };
    p.active = true;
    p.approved_by = getDemoUser()?.id ?? 'u-admin-1';
    p.approved_at = nowISO();
    if (a.p_deposit != null) p.deposit_tether = num(a.p_deposit);
    if (a.p_per_unit_deposit != null) p.per_unit_deposit = num(a.p_per_unit_deposit);
    if (a.p_commission != null) p.commission_per_unit = num(a.p_commission);
    p.updated_at = nowISO();
    emit('profiles', 'UPDATE', p, prev);
    audit('approve_user', { user_id: p.id });
    return null;
  },

  create_manual_trade(a) {
    const id = newId('trd');
    const row: Row = {
      id,
      market_id: a.p_market_id as string,
      buyer_id: a.p_buyer_id as string,
      seller_id: a.p_seller_id as string,
      buy_order_id: null, sell_order_id: null,
      quantity: num(a.p_quantity),
      price_toman: num(a.p_price_toman),
      settlement_date: a.p_settlement_date as string,
      kind: (a.p_kind as string) ?? 'today',
      trade_type: (a.p_trade_type as string) ?? 'normal',
      rent_block_value: a.p_rent_block_value != null ? num(a.p_rent_block_value) : null,
      note: (a.p_note as string) ?? null,
      manual: true, source: 'panel',
      created_by: getDemoUser()?.id ?? 'u-admin-1',
      matched_at: nowISO(), settled: false, settlement_id: null, liquidated_at: null,
      buyer_pnl_toman: null, seller_pnl_toman: null,
      buyer_commission: 1, seller_commission: 1,
    };
    if (row.buyer_id === row.seller_id) throw new Error('خریدار و فروشنده نمی‌توانند یکی باشند');
    table('trades').push(row);
    emit('trades', 'INSERT', row, null);
    audit('create_manual_trade', { trade_id: id, type: row.trade_type });
    return id;
  },

  edit_trade(a) {
    const t = findRow('trades', a.p_trade_id as string);
    if (!t) throw new Error('معامله پیدا نشد');
    if (t.settled) throw new Error('معاملهٔ تسویه‌شده قابل ویرایش نیست');
    const prev = { ...t };
    t.quantity = num(a.p_quantity);
    t.price_toman = num(a.p_price_toman);
    if (a.p_note !== undefined) t.note = (a.p_note as string) ?? null;
    emit('trades', 'UPDATE', t, prev);
    audit('edit_trade', { trade_id: t.id });
    return null;
  },

  bulk_update_traders(a) {
    const ids = a.p_user_ids as string[] | null | undefined;
    const groupFilter = a.p_target_group_id as string | null | undefined;

    const targets = table('profiles').filter((p) => {
      if (p.role !== 'trader') return false;
      if (ids?.length) return ids.includes(p.id as string);
      if (groupFilter) return p.member_group_id === groupFilter;
      return false;
    });

    const map: Array<[string, string]> = [
      ['p_per_unit_deposit', 'per_unit_deposit'],
      ['p_commission_per_unit', 'commission_per_unit'],
      ['p_max_open_units', 'max_open_units'],
      ['p_member_group_id', 'member_group_id'],
      ['p_referrer_id', 'referrer_id'],
      ['p_referral_bonus_pct', 'referral_bonus_pct'],
      ['p_active', 'active'],
      ['p_is_credit_user', 'is_credit_user'],
      ['p_credit_units', 'credit_units'],
      ['p_margin_call_disabled', 'margin_call_disabled'],
    ];

    for (const p of targets) {
      const prev = { ...p };
      for (const [arg, col] of map) {
        if (a[arg] !== undefined && a[arg] !== null) p[col] = a[arg];
      }
      p.updated_at = nowISO();
      emit('profiles', 'UPDATE', p, prev);
    }
    audit('bulk_update_traders', { count: targets.length });
    return targets.length;
  },

  update_own_profile(a) {
    const user = getDemoUser();
    if (!user) throw new Error('ابتدا وارد شوید');
    const p = findRow('profiles', user.id);
    if (!p) throw new Error('پروفایل پیدا نشد');
    const prev = { ...p };
    p.full_name = a.p_full_name as string;
    p.phone = a.p_phone as string;
    p.telegram_id = (a.p_telegram_id as string) ?? null;
    p.updated_at = nowISO();
    emit('profiles', 'UPDATE', p, prev);
    return null;
  },

  shift_settlements_for_holiday(a) {
    // تاریخ تعطیل به میلادی می‌آید؛ در دمو فقط شمارش را واقعی نگه می‌داریم:
    // لفظ‌ها و معاملات فردایی به روز کاری بعد منتقل می‌شوند.
    const date = a.p_date as string;
    let orders = 0;
    let trades = 0;
    for (const o of table('orders')) {
      if (o.kind === 'tomorrow' && o.status === 'open') { orders += 1; }
    }
    for (const t of table('trades')) {
      if (!t.settled && t.kind === 'tomorrow') { trades += 1; }
    }
    audit('shift_settlements_for_holiday', { date, orders, trades });
    save();
    return [{ orders_shifted: orders, trades_shifted: trades }];
  },

  is_holiday(a) {
    return table('holidays').some((h) => h.date === a.p_date);
  },

  liquidate_user_position(a) {
    const uid = a.p_user_id as string;
    let closed = 0;
    for (const t of table('trades')) {
      if (t.settled) continue;
      if (t.buyer_id !== uid && t.seller_id !== uid) continue;
      closed += 1;
    }
    audit('liquidate_user_position', { user_id: uid, trades: closed });
    return closed;
  },
  // ─── ثبت‌نام تلگرامی (migration 0011) ───
  // در دنیای واقعی بات صف را برمی‌دارد و حساب می‌سازد. در دمو بات نداریم،
  // پس همان‌جا تمامش می‌کنیم تا رفتار صفحه قابل امتحان باشد.
  queue_registration_decision(a) {
    const id     = String(a.p_request_id ?? '');
    const action = String(a.p_action ?? '');
    const row = table('registration_requests').find((r) => r.id === id) as
      Record<string, unknown> | undefined;
    if (!row) throw new Error('درخواست یافت نشد');
    if (row.status !== 'submitted') throw new Error('این درخواست قبلاً تصمیم‌گیری شده');

    row.status        = action === 'approve' ? 'approved' : 'rejected';
    row.reject_reason = action === 'reject' ? (a.p_reason ?? 'رد شد') : null;
    row.decided_at    = new Date().toISOString();
    row.updated_at    = row.decided_at;
    row.bot_action    = null;
    return null;
  },
};

export function callRpc(name: string, args: Args = {}) {
  const fn = handlers[name];
  if (!fn) {
    return { data: null, error: { message: `تابع «${name}» در حالت آفلاین پیاده نشده است`, code: 'DEMO_404' } };
  }
  try {
    const data = fn(args ?? {});
    save();
    return { data: data ?? null, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : String(err), code: 'DEMO_ERR' },
    };
  }
}
