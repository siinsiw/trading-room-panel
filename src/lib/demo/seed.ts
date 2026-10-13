// دادهٔ نمونهٔ حالت آفلاین — دقیقاً به شکل ردیف‌های دیتابیس (snake_case).
//
// چرا اینجا و نه `src/data/seed/sample-data.ts`؟ آن فایل تایپ‌های دامنه‌ای
// (camelCase) می‌سازد که یک لایه بالاتر از دیتابیس‌اند. کلاینت جعلی باید عیناً
// همان چیزی را بدهد که PostgREST می‌دهد، وگرنه آداپتورها موقع تبدیل می‌شکنند.
//
// اعداد pseudo-random با LCG ثابت تولید می‌شوند تا هر بار لود، داده یکسان باشد
// و شات‌های مقایسه‌ای بین دو تم/عرض قابل اتکا بمانند.

import type {
  Profile, Market, Order, Trade, Settlement, AuditEntry, Notification,
} from '@/lib/database.types';

// ─── تاریخ و ساعت تهران ──────────────────────────────────────────────────────

function tehranParts(offsetDays = 0): { jalali: string; iso: string } {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  const jf = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
    calendar: 'persian', numberingSystem: 'latn',
  });
  const isoF = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const p = jf.formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { jalali: `${get('year')}/${get('month')}/${get('day')}`, iso: isoF.format(d) };
}

export const TODAY     = tehranParts(0);
export const TOMORROW  = tehranParts(1);
export const YESTERDAY = tehranParts(-1);
const DAY_M2 = tehranParts(-2);
const DAY_M3 = tehranParts(-3);

/** ISO timestamp، n دقیقه پیش */
function minsAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

// ─── تصادفی‌سازِ قطعی ────────────────────────────────────────────────────────

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 0x1_0000_0000;
  };
}
const rng = makeRng(20_260_921);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

// ─── بازارها ─────────────────────────────────────────────────────────────────

const GOLD_MAZNE = 188_500_000;   // تومان، هر واحد ۱۰۰ گرم
const USD_RATE   = 214_700;       // تومان، هر دلار
const COIN_MAZNE = 1_412_000_000; // تومان، هر واحد ۱۰ عدد

export const MARKET_GOLD = 'market-gold';
export const MARKET_USD  = 'market-usd';
export const MARKET_COIN = 'market-coin';

export function seedMarkets(): Market[] {
  return [
    {
      id: MARKET_GOLD, name: 'طلای آب‌شده', symbol: 'GOLD',
      unit_weight: 100, unit_label: 'گرم',
      lafz_min: -999, lafz_max: 999, lafz_scale: 1_000,
      mazne_current: GOLD_MAZNE, active: true,
      created_at: daysAgo(120), updated_at: minsAgo(18),
      mode: 'margin', parry_threshold: null,
      margin_warn_pct: 75, margin_liquidate_pct: 85,
      tether_rate_today: 97_400, tether_rate_tomorrow: 97_900,
      lafz_price_mode: 'offset',
      liquidation_tolerance_toman: 200, parry_settlement_price: null,
      min_qty: 1, max_qty: 30,
    },
    {
      id: MARKET_USD, name: 'دلار', symbol: 'USD',
      unit_weight: 10_000, unit_label: 'دلار',
      lafz_min: 0, lafz_max: 999, lafz_scale: 10,
      mazne_current: USD_RATE, active: true,
      created_at: daysAgo(96), updated_at: minsAgo(4),
      mode: 'margin', parry_threshold: null,
      margin_warn_pct: 75, margin_liquidate_pct: 85,
      tether_rate_today: USD_RATE, tether_rate_tomorrow: 215_300,
      // قرارداد «سه رقم آخر» — همان که روی ۸۰۶ سند موج تهران اعتبارسنجی شد
      lafz_price_mode: 'last3',
      liquidation_tolerance_toman: 150, parry_settlement_price: null,
      min_qty: 1, max_qty: 30,
    },
    {
      id: MARKET_COIN, name: 'سکهٔ امامی', symbol: 'COIN',
      unit_weight: 10, unit_label: 'عدد',
      lafz_min: -999, lafz_max: 999, lafz_scale: 1_000_000,
      mazne_current: COIN_MAZNE, active: true,
      created_at: daysAgo(54), updated_at: minsAgo(140),
      // این بازار روی مدل پری کار می‌کند تا هر دو حالت اتاق در دمو دیده شود
      mode: 'parry', parry_threshold: 5_000_000,
      margin_warn_pct: 75, margin_liquidate_pct: 85,
      tether_rate_today: 97_400, tether_rate_tomorrow: 97_900,
      lafz_price_mode: 'offset',
      liquidation_tolerance_toman: 300, parry_settlement_price: null,
      min_qty: 1, max_qty: 20,
    },
  ];
}

// ─── گروه‌های عضویت ──────────────────────────────────────────────────────────

export interface MemberGroupRow {
  id: string; name: string; commission_per_unit: number;
  description: string | null; created_at: string; updated_at: string;
}

export function seedMemberGroups(): MemberGroupRow[] {
  const t = daysAgo(120);
  return [
    { id: 'grp-normal', name: 'عادی',  commission_per_unit: 1, description: 'کمیسیون استاندارد — ۱ تتر هر واحد هر لگ', created_at: t, updated_at: t },
    { id: 'grp-vip',    name: 'ویژه',  commission_per_unit: 1, description: 'معامله‌گران پرحجم', created_at: t, updated_at: t },
    { id: 'grp-intro',  name: 'معرف', commission_per_unit: 2, description: 'حساب‌های معرفی‌شده — رفرال فعال', created_at: t, updated_at: t },
  ];
}

// ─── کاربران ─────────────────────────────────────────────────────────────────

export const DEMO_ADMIN_ID      = 'u-admin-1';
export const DEMO_ACCOUNTANT_ID = 'u-acct-1';
export const DEMO_TRADER_ID     = 'u-trader-1';

interface TraderSpec {
  id: string; name: string; alias?: string; deposit: number;
  perUnit: number; group: string; credit?: number;
  noMarginCall?: boolean; active?: boolean; referrer?: string;
}

const TRADER_SPECS: TraderSpec[] = [
  { id: DEMO_TRADER_ID, name: 'رضا کریمی',    alias: 'ابوالفضل', deposit: 14_500, perUnit: 500, group: 'grp-vip' },
  { id: 'u-trader-2',  name: 'مریم حسینی',                      deposit:  8_200, perUnit: 500, group: 'grp-normal' },
  { id: 'u-trader-3',  name: 'امیر صوری',     alias: 'حاج امیر', deposit: 21_000, perUnit: 450, group: 'grp-vip', noMarginCall: true },
  { id: 'u-trader-4',  name: 'فاطمه محمدی',                     deposit:  3_400, perUnit: 500, group: 'grp-normal' },
  { id: 'u-trader-5',  name: 'علی رضایی',                       deposit:  6_750, perUnit: 500, group: 'grp-intro', referrer: DEMO_TRADER_ID },
  { id: 'u-trader-6',  name: 'زهرا نوری',                       deposit: 11_900, perUnit: 500, group: 'grp-normal' },
  // کاربر اعتباری — ودیعهٔ مؤثر لحظه‌ای از credit_units × per_unit_deposit
  { id: 'u-trader-7',  name: 'حسن قاسمی',     alias: 'حسن آقا',  deposit: 0,      perUnit: 500, group: 'grp-vip', credit: 40 },
  { id: 'u-trader-8',  name: 'نیلوفر احمدی',                     deposit:  5_100, perUnit: 500, group: 'grp-intro', referrer: DEMO_TRADER_ID },
  { id: 'u-trader-9',  name: 'مهدی سلطانی',                      deposit:  1_200, perUnit: 500, group: 'grp-normal' },
  { id: 'u-trader-10', name: 'سارا افشار',                       deposit:  9_600, perUnit: 500, group: 'grp-normal', active: false },
];

function baseProfile(over: Partial<Profile> & Pick<Profile, 'id' | 'full_name'>): Profile {
  return {
    phone: '09120000000', telegram_id: null, role: 'trader', active: true,
    deposit_tether: null, per_unit_deposit: null, commission_per_unit: null,
    member_group_id: null, referrer_id: null, referral_bonus_pct: null,
    max_open_units: null, approved_by: null, approved_at: null,
    is_credit_user: false, credit_units: null, margin_call_disabled: false,
    alias: null, created_at: daysAgo(90), updated_at: daysAgo(2),
    ...over,
  } as Profile;
}

export function seedProfiles(): Profile[] {
  const staff: Profile[] = [
    baseProfile({
      id: DEMO_ADMIN_ID, full_name: 'سینا مدیر', phone: '09121110001',
      telegram_id: '112233445', role: 'admin', created_at: daysAgo(120),
    }),
    baseProfile({
      id: 'u-admin-2', full_name: 'ناظر اتاق', phone: '09121110002',
      role: 'admin', created_at: daysAgo(110),
    }),
    baseProfile({
      id: DEMO_ACCOUNTANT_ID, full_name: 'آرش حسابدار', phone: '09121110010',
      telegram_id: '998877665', role: 'accountant', created_at: daysAgo(118),
    }),
  ];

  const traders: Profile[] = TRADER_SPECS.map((s, i) =>
    baseProfile({
      id: s.id,
      full_name: s.name,
      alias: s.alias ?? null,
      phone: `0911${String(1_000_000 + i * 4_321).slice(0, 7)}`,
      telegram_id: String(500_000_000 + i * 137),
      role: 'trader',
      active: s.active ?? true,
      deposit_tether: s.credit ? 0 : s.deposit,
      per_unit_deposit: s.perUnit,
      commission_per_unit: s.group === 'grp-intro' ? 2 : 1,
      member_group_id: s.group,
      referrer_id: s.referrer ?? null,
      referral_bonus_pct: s.referrer ? 10 : null,
      max_open_units: s.group === 'grp-vip' ? 80 : 40,
      approved_by: DEMO_ADMIN_ID,
      approved_at: daysAgo(80 - i),
      is_credit_user: !!s.credit,
      credit_units: s.credit ?? null,
      margin_call_disabled: !!s.noMarginCall,
      created_at: daysAgo(85 - i),
    }),
  );

  // دو کاربر منتظر تأیید — تا صفحهٔ «تأیید کاربران» خالی نباشد
  const pending: Profile[] = [
    baseProfile({
      id: 'u-pending-1', full_name: 'بهرام کاظمی', phone: '09190000041',
      telegram_id: '610000041', role: 'trader', active: false,
      created_at: minsAgo(220), updated_at: minsAgo(220),
    }),
    baseProfile({
      id: 'u-pending-2', full_name: 'نگار شریفی', phone: '09190000042',
      telegram_id: '610000042', role: 'trader', active: false,
      created_at: minsAgo(65), updated_at: minsAgo(65),
    }),
  ];

  return [...staff, ...traders, ...pending];
}

// ─── لفظ‌ها ──────────────────────────────────────────────────────────────────

export function seedOrders(profiles: Profile[]): Order[] {
  const traders = profiles.filter((p) => p.role === 'trader' && p.active);
  const out: Order[] = [];
  let n = 0;

  const push = (o: Partial<Order> & Pick<Order, 'id' | 'trader_id' | 'side' | 'status'>) => {
    out.push({
      market_id: MARKET_GOLD, kind: 'today', lafz: 0, price_toman: 0,
      price_kind: 'relative', quantity: 10, filled: 0, remaining: 10,
      settlement_date: TODAY.jalali, all_or_nothing: false,
      placed_at: minsAgo(between(1, 300)), expires_at: null,
      overridden_at: null, override_count: 0, is_porat: false,
      cancelled_at: null, cancel_reason: null, telegram_msg_id: 4_000 + n,
      ...o,
    } as Order);
  };

  // لفظ‌های باز/نیمه‌پرشدهٔ امروز روی طلا
  for (let i = 0; i < 9; i++) {
    n++;
    const t = traders[i % traders.length];
    const side = i % 2 === 0 ? 'buy' : 'sell';
    const lafz = between(-40, 60) * 10;
    const qty = pick([5, 10, 10, 20, 25, 50]);
    const filled = i % 3 === 0 ? Math.floor(qty / 2) : 0;
    const placedMin = between(1, 55);
    push({
      id: `ord-g-${n}`, trader_id: t.id, side, lafz,
      price_toman: GOLD_MAZNE + lafz * 1_000,
      quantity: qty, filled, remaining: qty - filled,
      status: filled > 0 ? 'partial' : 'open',
      placed_at: minsAgo(placedMin),
      expires_at: new Date(Date.now() - placedMin * 60_000 + 60_000).toISOString(),
      all_or_nothing: i === 4,
    });
  }

  // لفظ‌های دلار با قرارداد سه‌رقم‌آخر
  for (let i = 0; i < 5; i++) {
    n++;
    const t = traders[(i + 3) % traders.length];
    const side = i % 2 === 0 ? 'sell' : 'buy';
    const last3 = between(0, 99) * 10;
    push({
      id: `ord-u-${n}`, trader_id: t.id, market_id: MARKET_USD, side,
      lafz: last3, price_toman: Math.round(USD_RATE / 1_000) * 1_000 + last3,
      quantity: pick([1, 2, 3, 5]), remaining: 0,
      status: 'open', placed_at: minsAgo(between(1, 40)),
      expires_at: new Date(Date.now() + 40_000).toISOString(),
    });
  }
  // remaining را برای دلاری‌ها درست کن
  for (const o of out) if (o.market_id === MARKET_USD) o.remaining = o.quantity - o.filled;

  // لفظ فردایی
  for (let i = 0; i < 4; i++) {
    n++;
    const t = traders[(i + 5) % traders.length];
    const lafz = between(-30, 80) * 10;
    push({
      id: `ord-t-${n}`, trader_id: t.id, side: i % 2 === 0 ? 'buy' : 'sell',
      kind: 'tomorrow', settlement_date: TOMORROW.jalali,
      lafz, price_toman: GOLD_MAZNE + lafz * 1_000,
      quantity: pick([10, 20, 30]), status: 'open',
      placed_at: minsAgo(between(5, 90)),
    });
  }

  // لفظ‌های بسته‌شده — پرشده / لغوشده / منقضی / پرت
  const closed: Array<[Order['status'], string | null]> = [
    ['filled', null], ['filled', null],
    ['cancelled', 'user_n'], ['cancelled', 'admin_porat'],
    ['cancelled', 'owner_n_after_expiry'], ['expired', null],
  ];
  closed.forEach(([status, reason], i) => {
    n++;
    const t = traders[(i + 2) % traders.length];
    const lafz = between(-50, 70) * 10;
    const qty = pick([10, 20, 25]);
    const mins = between(60, 260);
    push({
      id: `ord-c-${n}`, trader_id: t.id, side: i % 2 === 0 ? 'sell' : 'buy',
      lafz, price_toman: GOLD_MAZNE + lafz * 1_000,
      quantity: qty,
      filled: status === 'filled' ? qty : 0,
      remaining: status === 'filled' ? 0 : qty,
      status,
      is_porat: reason === 'admin_porat',
      cancelled_at: status === 'cancelled' ? minsAgo(mins - 2) : null,
      cancel_reason: reason,
      placed_at: minsAgo(mins),
      expires_at: new Date(Date.now() - (mins - 1) * 60_000).toISOString(),
      // یکی از پرشده‌ها با override مالک بعد از «تایم» بسته شده
      overridden_at: i === 1 ? minsAgo(mins - 3) : null,
      override_count: i === 1 ? 1 : 0,
    });
  });

  return out;
}

// ─── معاملات ─────────────────────────────────────────────────────────────────

export function seedTrades(profiles: Profile[]): Trade[] {
  const traders = profiles.filter((p) => p.role === 'trader' && p.active);
  const out: Trade[] = [];
  let n = 0;

  const mk = (o: Partial<Trade> & Pick<Trade, 'id' | 'buyer_id' | 'seller_id'>): Trade => ({
    market_id: MARKET_GOLD, buy_order_id: null, sell_order_id: null,
    quantity: 10, price_toman: GOLD_MAZNE, settlement_date: TODAY.jalali,
    kind: 'today', trade_type: 'normal', rent_block_value: null, note: null,
    manual: false, source: 'bot', created_by: null, liquidated_at: null,
    matched_at: minsAgo(between(2, 300)), settled: false, settlement_id: null,
    buyer_pnl_toman: null, seller_pnl_toman: null,
    buyer_commission: 1, seller_commission: 1,
    ...o,
  } as Trade);

  // معاملات امروز — تسویه‌نشده
  for (let i = 0; i < 14; i++) {
    n++;
    const b = traders[i % traders.length];
    let s = traders[(i * 3 + 1) % traders.length];
    if (s.id === b.id) s = traders[(i + 2) % traders.length];
    const lafz = between(-40, 70) * 10;
    out.push(mk({
      id: `trd-${n}`, buyer_id: b.id, seller_id: s.id,
      quantity: pick([5, 10, 10, 20, 25]),
      price_toman: GOLD_MAZNE + lafz * 1_000,
      matched_at: minsAgo(between(3, 290)),
    }));
  }

  // معاملات دلار
  for (let i = 0; i < 6; i++) {
    n++;
    const b = traders[(i + 4) % traders.length];
    const s = traders[(i * 2 + 3) % traders.length];
    if (s.id === b.id) continue;
    out.push(mk({
      id: `trd-${n}`, buyer_id: b.id, seller_id: s.id, market_id: MARKET_USD,
      quantity: pick([1, 2, 3, 5]),
      price_toman: Math.round(USD_RATE / 1_000) * 1_000 + between(0, 99) * 10,
      matched_at: minsAgo(between(2, 200)),
    }));
  }

  // فردایی
  for (let i = 0; i < 5; i++) {
    n++;
    const b = traders[(i + 1) % traders.length];
    const s = traders[(i * 4 + 2) % traders.length];
    if (s.id === b.id) continue;
    out.push(mk({
      id: `trd-${n}`, buyer_id: b.id, seller_id: s.id,
      kind: 'tomorrow', settlement_date: TOMORROW.jalali,
      quantity: pick([10, 20, 30]),
      price_toman: GOLD_MAZNE + between(-20, 90) * 1_000,
      matched_at: minsAgo(between(10, 180)),
    }));
  }

  // اجاره و بلوکه — ثبت دستی ادمین در «گروه امروز فردا»
  n++;
  out.push(mk({
    id: `trd-${n}`, buyer_id: traders[0].id, seller_id: traders[2].id,
    trade_type: 'rent', rent_block_value: 3_200_000, quantity: 20,
    kind: 'tomorrow', settlement_date: TOMORROW.jalali,
    price_toman: GOLD_MAZNE + 40_000, manual: true, source: 'panel',
    created_by: DEMO_ADMIN_ID, note: 'اجارهٔ توافقی — گروه امروز فردا',
    matched_at: minsAgo(150),
  }));
  n++;
  out.push(mk({
    id: `trd-${n}`, buyer_id: traders[4].id, seller_id: traders[1].id,
    trade_type: 'blocked', rent_block_value: 5_800_000, quantity: 25,
    kind: 'tomorrow', settlement_date: TOMORROW.jalali,
    price_toman: GOLD_MAZNE - 15_000, manual: true, source: 'panel',
    created_by: DEMO_ADMIN_ID, note: 'بلوکه تا تصفیهٔ بعد',
    matched_at: minsAgo(95),
  }));

  // ── تریدرهای پرریسک ──
  // زیان از «موقعیت بزرگ نسبت به ودیعه» می‌آید، نه از جهش قیمت: مهدی سلطانی با
  // ۲٬۳۰۰ تتر ودیعه روی ۲۰ واحد (بیعانهٔ لازم ۱۰٬۰۰۰ تتر) و فاطمه محمدی با
  // ۳٬۴۰۰ تتر روی ۳۰ واحد. همین باعث می‌شود ناحیهٔ warn و call در پنل دیده شود.
  // هر دو بازار پوشش داده می‌شوند چون صفحهٔ داشبورد ریسک را فقط برای بازار
  // انتخاب‌شده حساب می‌کند و بازار پیش‌فرض اولین مورد فهرست است.
  const stress: Array<[string, number]> = [
    ['u-trader-9', 20],  // ودیعه ۲٬۳۰۰ تتر ← بیعانهٔ لازم ۱۰٬۰۰۰ ← مارجین کال
    ['u-trader-4', 30],  // ودیعه ۳٬۴۰۰ تتر ← بیعانهٔ لازم ۱۵٬۰۰۰ ← هشدار
  ];
  const counterparty = traders.find((t) => t.id === 'u-trader-3')!; // حساب پرحجم
  for (const [uid, qty] of stress) {
    n++;
    out.push(mk({
      id: `trd-${n}`, buyer_id: uid, seller_id: counterparty.id,
      quantity: qty, price_toman: GOLD_MAZNE + between(10, 60) * 1_000,
      matched_at: minsAgo(between(20, 120)),
    }));
    n++;
    out.push(mk({
      id: `trd-${n}`, buyer_id: uid, seller_id: counterparty.id,
      market_id: MARKET_USD, quantity: qty,
      price_toman: Math.round(USD_RATE / 1_000) * 1_000 + between(0, 99) * 10,
      matched_at: minsAgo(between(20, 120)),
    }));
  }

  // معاملات تسویه‌شدهٔ روزهای قبل
  const past: Array<{ d: string; sid: string; rate: number }> = [
    { d: YESTERDAY.jalali, sid: 'stl-1', rate: GOLD_MAZNE - 1_200_000 },
    { d: DAY_M2.jalali,    sid: 'stl-2', rate: GOLD_MAZNE - 2_600_000 },
    { d: DAY_M3.jalali,    sid: 'stl-3', rate: GOLD_MAZNE - 900_000 },
  ];
  past.forEach((p, di) => {
    for (let i = 0; i < 8; i++) {
      n++;
      const b = traders[(i + di) % traders.length];
      const s = traders[(i * 5 + di + 1) % traders.length];
      if (s.id === b.id) continue;
      const price = p.rate + between(-60, 60) * 1_000;
      const qty = pick([5, 10, 20, 25]);
      const pnl = (p.rate - price) * qty;
      out.push(mk({
        id: `trd-${n}`, buyer_id: b.id, seller_id: s.id,
        quantity: qty, price_toman: price, settlement_date: p.d,
        matched_at: daysAgo(di + 1),
        settled: true, settlement_id: p.sid,
        buyer_pnl_toman: pnl, seller_pnl_toman: -pnl,
      }));
    }
  });

  return out;
}

// ─── تصفیه‌ها ────────────────────────────────────────────────────────────────

export function seedSettlements(): Settlement[] {
  const mk = (
    id: string, date: string, rate: number, tether: number,
    dayOffset: number, extra: Partial<Settlement> = {},
  ): Settlement => ({
    id, market_id: MARKET_GOLD, settlement_date: date,
    rate_toman: rate, rate_tether: tether,
    applied_at: daysAgo(dayOffset), applied_by: DEMO_ADMIN_ID,
    reversed_at: null, reversal_reason: null,
    snapshot_before: [],
    total_trades_count: between(6, 9),
    total_volume_units: between(80, 240),
    total_commission_tether: between(18, 46),
    ...extra,
  } as Settlement);

  return [
    mk('stl-1', YESTERDAY.jalali, GOLD_MAZNE - 1_200_000, 97_100, 1),
    mk('stl-2', DAY_M2.jalali,    GOLD_MAZNE - 2_600_000, 96_800, 2),
    mk('stl-3', DAY_M3.jalali,    GOLD_MAZNE -   900_000, 96_400, 3),
    // یک تصفیهٔ برگشت‌خورده تا مسیر «برگشت تصفیه» در پنل دیده شود
    mk('stl-4', DAY_M3.jalali, GOLD_MAZNE - 700_000, 96_400, 3, {
      reversed_at: daysAgo(2.9),
      reversal_reason: 'نرخ اشتباه وارد شده بود — با هماهنگی حسابداری برگشت خورد',
    }),
  ];
}

// ─── تنظیمات سیستم ───────────────────────────────────────────────────────────

export interface SettingRow { key: string; value: unknown; updated_at: string }

export function seedSettings(): SettingRow[] {
  const t = daysAgo(5);
  const v: Record<string, unknown> = {
    lafz_ttl_seconds: 60,
    override_window_seconds: 90,
    absolute_price_threshold: 50_000,
    rate_broadcast_enabled: true,
    rate_broadcast_min_interval_sec: 120,
    rate_broadcast_min_delta_toman: 100,
    daily_open_notice: true,
    daily_close_notice: true,
    trading_open_hour: 9,
    trading_open_min: 0,
    trading_lock_hour: 13,
    trading_lock_min: 30,
    welcome_new_members: true,
    demo_mode_enabled: false,
    demo_units_default: 10,
    support_handle: '@shams_support',
    accountant_handle: '@shams_hesab',
    settlement_reverse_minutes: 60,
    referrer_commission_pct: 10,
    room_mode: 'margin',
    parry_threshold_toman: 5_000_000,
    margin_warn_pct: 75,
    margin_liquidate_pct: 85,
    tether_rate_today: 97_400,
    tether_rate_tomorrow: 97_900,
  };
  return Object.entries(v).map(([key, value]) => ({ key, value, updated_at: t }));
}

// ─── اعلان‌های بات ───────────────────────────────────────────────────────────

export interface AnnouncementRow {
  id: string; kind: string; body: string;
  created_at: string; posted_at: string | null; error: string | null;
}

export function seedAnnouncements(): AnnouncementRow[] {
  const rows: Array<[string, string, number, boolean]> = [
    ['market_open',     'بنام خدا 🌸\nشروع معاملات', 400, true],
    ['rate',            'نرخ طلای آب‌شده: ۱۸۸٬۵۴۰', 260, true],
    ['settlement',      'تصفیهٔ روز گذشته اعمال شد — نرخ ۱۸۷٬۳۰۰ · تتر ۹۷٬۱۰۰', 180, true],
    ['rate',            'نرخ دلار: ۲۱۴٬۷۰۰', 96, true],
    ['notice',          'همکاران گرامی، از ساعت ۱۳:۳۰ فقط لفظ فردایی پذیرفته می‌شود.', 60, true],
    ['trade_cancelled', 'معاملهٔ شمارهٔ ۱۴ به‌درخواست طرفین لغو شد', 32, true],
    ['rate',            'نرخ طلای آب‌شده: ۱۸۸٬۶۱۰', 12, false],
  ];
  return rows.map(([kind, body, mins, posted], i) => ({
    id: `ann-${i + 1}`, kind, body,
    created_at: minsAgo(mins),
    posted_at: posted ? minsAgo(mins - 1) : null,
    error: !posted && i === rows.length - 1 ? null : null,
  }));
}

// ─── تعطیلات ─────────────────────────────────────────────────────────────────

export interface HolidayRow {
  date: string; description: string;
  created_at: string; created_by: string | null;
}

export function seedHolidays(): HolidayRow[] {
  const plus = (n: number) => tehranParts(n).iso;
  return [
    { date: plus(6),  description: 'تعطیل رسمی',           created_at: daysAgo(30), created_by: DEMO_ADMIN_ID },
    { date: plus(13), description: 'تعطیلی بازار — مناسبت', created_at: daysAgo(30), created_by: DEMO_ADMIN_ID },
    { date: plus(27), description: 'تعطیل رسمی',           created_at: daysAgo(12), created_by: DEMO_ADMIN_ID },
  ];
}

// ─── اعلان‌های کاربر ─────────────────────────────────────────────────────────

export function seedNotifications(): Notification[] {
  const rows: Array<[string, string, string, string, number, boolean]> = [
    [DEMO_ADMIN_ID, 'approval', 'کاربر جدید منتظر تأیید', 'نگار شریفی درخواست عضویت داد', 65, false],
    [DEMO_ADMIN_ID, 'margin',   'هشدار مارجین', 'فاطمه محمدی به ۷۸٪ ودیعه رسید', 48, false],
    [DEMO_ADMIN_ID, 'approval', 'کاربر جدید منتظر تأیید', 'بهرام کاظمی درخواست عضویت داد', 220, true],
    [DEMO_ADMIN_ID, 'settle',   'تصفیهٔ دیروز اعمال شد', 'نرخ ۱۸۷٬۳۰۰ · ۸ معامله', 1_400, true],
    [DEMO_ACCOUNTANT_ID, 'settle', 'تصفیهٔ دیروز اعمال شد', 'گزارش برای بررسی آماده است', 1_400, false],
    [DEMO_TRADER_ID, 'trade',  'معاملهٔ شما ثبت شد', '۲۰ واحد فروش به ۱۸۸٬۵۴۰', 22, false],
    [DEMO_TRADER_ID, 'margin', 'وضعیت ودیعه', 'ودیعهٔ شما در ناحیهٔ امن است', 300, true],
  ];
  return rows.map(([user_id, type, title, body, mins, read], i) => ({
    id: `ntf-${i + 1}`, user_id, type, title, body, read,
    created_at: minsAgo(mins),
  }));
}

// ─── لاگ ممیزی ───────────────────────────────────────────────────────────────

export function seedAudit(): AuditEntry[] {
  const rows: Array<[string, string, Record<string, unknown>, number]> = [
    ['update_mazne',       'admin', { market: 'طلای آب‌شده', from: 188_400_000, to: GOLD_MAZNE }, 18],
    ['approve_trader',     'admin', { trader: 'زهرا نوری', deposit: 11_900 }, 140],
    ['apply_settlement',   'admin', { date: YESTERDAY.jalali, rate: GOLD_MAZNE - 1_200_000 }, 1_400],
    ['reverse_settlement', 'admin', { settlement_id: 'stl-4', reason: 'نرخ اشتباه' }, 4_100],
    ['bulk_update',        'admin', { count: 6, field: 'per_unit_deposit' }, 2_600],
    ['create_manual_trade','admin', { type: 'rent', quantity: 20 }, 150],
    ['edit_trade',         'accountant', { trade_id: 'trd-9', field: 'quantity' }, 90],
  ];
  let prev: string | null = null;
  return rows.map(([action, role, payload, mins], i) => {
    const id = `aud-${i + 1}`;
    const entry = {
      id, prev_id: prev,
      hash: `${(0xa1b2c3 + i * 7919).toString(16)}${'0'.repeat(50)}`.slice(0, 64),
      actor_id: role === 'admin' ? DEMO_ADMIN_ID : DEMO_ACCOUNTANT_ID,
      actor_role: role, action, payload,
      timestamp: minsAgo(mins),
    } as unknown as AuditEntry;
    prev = id;
    return entry;
  });
}

// ─── درخواست‌های عضویت از تلگرام (migration 0011) ────────────────────────────

export interface RegistrationRow {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  alias: string | null;
  full_name: string | null;
  referrer_id: string | null;
  status: string;
  reject_reason: string | null;
  profile_id: string | null;
  admin_msgs: unknown[];
  bot_action: string | null;
  bot_action_by: string | null;
  bot_action_error: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * سه حالت را عمداً پوشش می‌دهد تا هر سه تبِ صفحه پر باشد و در sweep
 * دیده شود: منتظر تصمیم، نیمه‌کاره، و تصمیم‌گرفته‌شده.
 */
export function seedRegistrations(): RegistrationRow[] {
  const base = (over: Partial<RegistrationRow>): RegistrationRow => ({
    id: 'reg-0', telegram_id: 0, telegram_username: null,
    phone: null, first_name: null, last_name: null, alias: null, full_name: null,
    referrer_id: null, status: 'submitted', reject_reason: null, profile_id: null,
    admin_msgs: [], bot_action: null, bot_action_by: null, bot_action_error: null,
    decided_by: null, decided_at: null,
    created_at: minsAgo(30), updated_at: minsAgo(30),
    ...over,
  });

  return [
    base({
      id: 'reg-1', telegram_id: 615_340_221, telegram_username: 'sina_z',
      phone: '09121234567', first_name: 'سینا', last_name: 'صفرزاده',
      alias: 'سین', full_name: 'سینا صفرزاده',
      created_at: minsAgo(12), updated_at: minsAgo(12),
    }),
    base({
      id: 'reg-2', telegram_id: 740_118_903, telegram_username: 'n_sharifi',
      phone: '09359988776', first_name: 'نگار', last_name: 'شریفی',
      alias: 'نگار', full_name: 'نگار شریفی',
      referrer_id: DEMO_TRADER_ID,
      created_at: minsAgo(48), updated_at: minsAgo(48),
    }),
    base({
      id: 'reg-3', telegram_id: 233_907_554, telegram_username: 'kazemi_b',
      phone: '09190001122', first_name: 'بهرام', last_name: null, alias: null,
      full_name: null, status: 'awaiting_last_name',
      created_at: minsAgo(6), updated_at: minsAgo(4),
    }),
    base({
      id: 'reg-4', telegram_id: 901_226_477, telegram_username: null,
      status: 'awaiting_phone',
      created_at: minsAgo(2), updated_at: minsAgo(2),
    }),
    base({
      id: 'reg-5', telegram_id: 118_552_003, telegram_username: 'm_rahimi',
      phone: '09121110099', first_name: 'مریم', last_name: 'رحیمی',
      alias: 'مری', full_name: 'مریم رحیمی',
      status: 'approved', profile_id: DEMO_TRADER_ID,
      decided_by: DEMO_ADMIN_ID, decided_at: daysAgo(3),
      created_at: daysAgo(3), updated_at: daysAgo(3),
    }),
    base({
      id: 'reg-6', telegram_id: 664_310_882, telegram_username: 'unknown_x',
      phone: '09339990011', first_name: 'کاربر', last_name: 'ناشناس',
      alias: 'ایکس', full_name: 'کاربر ناشناس',
      status: 'rejected', reject_reason: 'هویت تأیید نشد',
      decided_by: DEMO_ADMIN_ID, decided_at: daysAgo(5),
      created_at: daysAgo(5), updated_at: daysAgo(5),
    }),
  ];
}
