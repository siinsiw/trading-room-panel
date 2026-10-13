-- ════════════════════════════════════════════════════════════════
--  Migration 0010 — اعلان‌های اتاق، اسم مستعار، override پایدار
--  منبع: تحلیل رفتاری بات «موج تهران» (۲۹ شهریور ۱۴۰۵)
--
--   ۱) profiles.alias            : اسم مستعار — در سند معامله به‌جای نام واقعی
--   ۲) pending_overrides         : پنجرهٔ override مالک، پایدار (تا حالا در حافظه بود)
--   ۳) bot_announcements         : صندوق خروجی — پنل می‌نویسد، بات در گروه پست می‌کند
--   ۴) trigger روی settlements   : تصفیه خودکار در گروه اعلام می‌شود
--   ۵) کلیدهای جدید system_settings
-- ════════════════════════════════════════════════════════════════

-- ─── ۱) اسم مستعار ──────────────────────────────────────────────
alter table public.profiles
  add column if not exists alias text;

comment on column public.profiles.alias is
  'اسم مستعار معامله‌گر — اگر پر باشد در سند معاملهٔ گروه به‌جای full_name نمایش داده می‌شود.';

-- ─── ۱ب) قرارداد قیمتِ لفظ نسبی، per-market ────────────────────
--
--   offset (پیش‌فرض، رفتار فعلی)
--     «۵۰۰ ف» = مزنه + ۵۰۰ × lafz_scale
--
--   last3 (قرارداد «موج تهران»)
--     «۷۲۰ ف» = سه رقم آخرِ نرخ جاری را ۷۲۰ کن و به نزدیک‌ترین
--     عدد ممکن بچسبان. رزولوشن ۱۰ تومانی می‌دهد به‌جای ۱٬۰۰۰ تومانی.
--
-- این قاعده روی ۸۰۶ سند معاملهٔ واقعی آن اتاق بازسازی شد و ۱۰۰٪ خواند.
--
-- تصمیم کارفرما (۲۰۲۶-۰۹-۲۱): بازار دلار → last3 · بازار طلا → offset.
-- پیش‌فرض همین offset می‌ماند و بازار دلار موقع ساخت در پنل روی last3
-- تنظیم می‌شود. به طلا تعمیم داده نشد چون مرجع last3 نرخ زندهٔ بازار
-- است نه مزنهٔ ثابت، و برای طلا قیمت از روی نرخ تتر درمی‌آمد.
alter table public.markets
  add column if not exists lafz_price_mode text not null default 'offset'
    check (lafz_price_mode in ('offset', 'last3'));

comment on column public.markets.lafz_price_mode is
  'offset = مزنه + لفظ×مقیاس (طلا) · last3 = جایگزینی سه رقم آخر نرخ جاری (دلار، مثل موج تهران).';

-- ─── ۲) pending_overrides ───────────────────────────────────────
-- وقتی کاربری روی لفظ منقضی «ب» می‌زند، درخواست اینجا ثبت می‌شود و
-- فقط مالک لفظ می‌تواند در پنجرهٔ زمانی تأییدش کند. قبلاً یک Map در
-- حافظهٔ بات بود که با هر ری‌استارت سرویس پاک می‌شد.
create table if not exists public.pending_overrides (
  id             text primary key default gen_random_uuid()::text,
  order_id       text not null references public.orders(id) on delete cascade,
  requester_id   uuid not null references public.profiles(id),
  requester_tg   bigint not null,
  requested_qty  integer not null check (requested_qty > 0),

  -- سه آی‌دی پیام، چون مالک می‌تواند روی هر کدام «ب» بزند و همه باید
  -- به همان لفظ برسند:
  lafz_msg_id    bigint not null,   -- پیام اصلی لفظ
  baraka_msg_id  bigint,            -- پیام «ب» درخواست‌کننده
  bot_msg_id     bigint,            -- پیام «⏳ تایم» / «🚫 تکمیل» خود بات

  reason         text not null default 'expired'
                 check (reason in ('expired', 'overflow')),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  consumed_at    timestamptz
);

-- فقط یک درخواست فعال برای هر لفظ
create unique index if not exists pending_overrides_open_order
  on public.pending_overrides (order_id)
  where consumed_at is null;

create index if not exists pending_overrides_expiry
  on public.pending_overrides (expires_at)
  where consumed_at is null;

-- برای resolve کردن «ریپلای روی پیام برکت/بات» به لفظ اصلی
create index if not exists pending_overrides_baraka_msg
  on public.pending_overrides (baraka_msg_id)
  where consumed_at is null;

create index if not exists pending_overrides_bot_msg
  on public.pending_overrides (bot_msg_id)
  where consumed_at is null;

comment on table public.pending_overrides is
  'درخواست برکت روی لفظ منقضی — منتظر تأیید مجدد مالک. بات پس از مصرف consumed_at را پر می‌کند.';
comment on column public.pending_overrides.bot_msg_id is
  'مالک معمولاً روی پیام «تایم» بات ریپلای می‌زند، نه روی لفظ. بدون این ستون آن ریپلای به هیچ لفظی resolve نمی‌شود و بات ساکت می‌ماند.';

-- ─── ۳) bot_announcements (صندوق خروجی) ────────────────────────
-- هر ردیف یک پیام است که بات باید در گروه(های) اتاق پست کند.
-- پنل / تریگرها اینجا می‌نویسند؛ بات poll می‌کند و posted_at را پر می‌کند.
create table if not exists public.bot_announcements (
  id         text primary key default gen_random_uuid()::text,
  kind       text not null
             check (kind in ('settlement', 'trade_cancelled', 'notice',
                             'market_open', 'market_close', 'rate')),
  market_id  text references public.markets(id),
  body       text not null,
  chat_ids   bigint[],            -- null = همهٔ گروه‌های اتاق
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  posted_at  timestamptz,
  error      text
);

create index if not exists bot_announcements_pending
  on public.bot_announcements (created_at)
  where posted_at is null;

comment on table public.bot_announcements is
  'صندوق خروجی اعلان‌های گروه. بات هر چند ثانیه ردیف‌های posted_at is null را می‌خواند و پست می‌کند.';

-- ─── ۴) تریگر: تصفیه → اعلان گروه ──────────────────────────────
create or replace function public.announce_settlement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  body text;
begin
  body :=
    E'📣 توجه 📣\n\n' ||
    E'⚜️ اعضای محترم\n\n' ||
    E'ربات در حال انجام تسویهٔ معاملات امروزی می‌باشد.\n' ||
    E'از این لحظه تمامی لفظ‌ها فردایی محسوب می‌شوند.\n\n' ||
    E'➖➖➖➖➖➖➖➖➖➖\n\n' ||
    '💵 عدد تسویه: ' || to_char(new.rate_toman, 'FM999,999,999') || E' تومان\n' ||
    '🔄 نرخ تبدیل: ' || to_char(new.rate_tether, 'FM999,999,999') || E' تومان\n\n' ||
    '🗓 تاریخ: ' || to_char(new.applied_at at time zone 'Asia/Tehran', 'YYYY/MM/DD HH24:MI:SS');

  insert into public.bot_announcements (kind, market_id, body, created_by)
  values ('settlement', new.market_id, body, new.applied_by);

  return new;
end $$;

drop trigger if exists settlements_announce on public.settlements;
create trigger settlements_announce
  after insert on public.settlements
  for each row execute function public.announce_settlement();

-- برگشت تصفیه هم باید اعلام شود
create or replace function public.announce_settlement_reversal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reversed_at is not null and old.reversed_at is null then
    insert into public.bot_announcements (kind, market_id, body)
    values (
      'notice',
      new.market_id,
      E'✅ اعضای محترم\n\n' ||
      E'تسویهٔ انجام‌شده برگشت خورد و معاملات به وضعیت قبل بازگشتند.\n' ||
      coalesce('علت: ' || new.reversal_reason, '')
    );
  end if;
  return new;
end $$;

drop trigger if exists settlements_announce_reversal on public.settlements;
create trigger settlements_announce_reversal
  after update on public.settlements
  for each row execute function public.announce_settlement_reversal();

-- ─── ۵) تنظیمات جدید ────────────────────────────────────────────
insert into public.system_settings (key, value) values
  -- پنجرهٔ تأیید مالک بعد از «تایم» — موج تهران حدود ۷۰-۸۰ ثانیه دارد
  ('override_window_seconds',          '90'),
  -- اعلام نرخ در گروه: حداقل فاصلهٔ زمانی و حداقل تغییر قیمت
  ('rate_broadcast_enabled',           'true'),
  ('rate_broadcast_min_interval_sec',  '120'),
  ('rate_broadcast_min_delta_toman',   '100'),
  -- پیام‌های افتتاحیه/اختتامیهٔ روزانه
  ('daily_open_notice',                'true'),
  ('daily_close_notice',               'true'),
  -- خوش‌آمد خودکار به عضو جدید گروه
  ('welcome_new_members',              'true'),
  -- ثبت‌نام دمو (خاموش تا وقتی کارفرما تأیید کند)
  ('demo_mode_enabled',                'false'),
  ('demo_units_default',               '10'),
  -- آیدی‌های پشتیبانی که در پیام خوش‌آمد می‌آیند
  ('support_handle',                   '""'),
  ('accountant_handle',                '""')
on conflict (key) do nothing;

-- ─── RLS ────────────────────────────────────────────────────────
alter table public.pending_overrides enable row level security;
alter table public.bot_announcements enable row level security;

-- بات با service-role کار می‌کند و RLS را دور می‌زند؛ این سیاست‌ها
-- فقط برای پنل‌اند.
drop policy if exists "pending_overrides: staff read" on public.pending_overrides;
create policy "pending_overrides: staff read"
  on public.pending_overrides for select
  using (public.current_role() in ('admin', 'accountant'));

drop policy if exists "bot_announcements: staff read"   on public.bot_announcements;
drop policy if exists "bot_announcements: admin insert" on public.bot_announcements;

create policy "bot_announcements: staff read"
  on public.bot_announcements for select
  using (public.current_role() in ('admin', 'accountant'));

create policy "bot_announcements: admin insert"
  on public.bot_announcements for insert
  with check (public.current_role() = 'admin');
