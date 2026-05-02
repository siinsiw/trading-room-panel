-- ═══════════════════════════════════════════════════════════════════════════
--  Migration 0002 — Lafz semantics, member groups, rent/block trades, referrals
--  Run after 0001_init.sql in: Supabase Dashboard → SQL Editor
--
--  این migration دامنه‌ی واقعی اتاق معاملات را به مدل می‌رساند:
--    • TTL لفظ + Override + لغو با «ن»
--    • نوع امروزی/فردایی روی orders و trades
--    • نوع معامله: عادی/اجاره/بلوکه + عدد توافقی
--    • گروه‌های کاربری برای کمیسیون پلکانی
--    • سیستم رفرال
--    • RPC ثبت دستی معامله (با bypass matching engine)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Enums (جدید) ────────────────────────────────────────────────────────────
do $$ begin
  create type lafz_kind as enum ('today', 'tomorrow');
exception when duplicate_object then null; end $$;

do $$ begin
  create type trade_type as enum ('normal', 'rent', 'blocked');
exception when duplicate_object then null; end $$;

-- ─── member_groups (گروه‌های کاربری برای کمیسیون پلکانی) ────────────────────
create table if not exists public.member_groups (
  id                  text primary key default gen_random_uuid()::text,
  name                text not null,
  commission_per_unit bigint not null default 0,         -- کمیسیون پایه (تتر — به دلیل integer ذخیره می‌کنیم)
  description         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists member_groups_updated_at on public.member_groups;
create trigger member_groups_updated_at before update on public.member_groups
  for each row execute function update_updated_at();

-- گروه پیش‌فرض
insert into public.member_groups (id, name, commission_per_unit, description)
values
  ('group-default',  'پیش‌فرض', 50000, 'گروه پیش‌فرض همه‌ی کاربران')
on conflict (id) do nothing;

-- ─── profiles: گروه + رفرال + سقف موقعیت ────────────────────────────────────
alter table public.profiles
  add column if not exists member_group_id      text references public.member_groups(id),
  add column if not exists referrer_id          uuid references public.profiles(id),
  add column if not exists max_open_units       integer,                 -- null = unlimited
  add column if not exists referral_bonus_pct   numeric(5,2) default 0;  -- درصد از کمیسیون زیرمجموعه

-- ─── orders: kind + all_or_nothing + expires_at + cancel via «ن» ────────────
alter table public.orders
  add column if not exists kind            lafz_kind not null default 'today',
  add column if not exists all_or_nothing  boolean   not null default false,
  add column if not exists expires_at      timestamptz,
  add column if not exists overridden_at   timestamptz,                  -- مالک با «ب» روی برکت تأیید کرده
  add column if not exists telegram_msg_id bigint;                        -- برای trace به پیام تلگرام

-- ─── trades: kind + type + rent_block_value + note + manual flag ────────────
alter table public.trades
  add column if not exists kind             lafz_kind not null default 'today',
  add column if not exists trade_type       trade_type not null default 'normal',
  add column if not exists rent_block_value bigint,                       -- توافقی، فقط برای rent/blocked
  add column if not exists note             text,                          -- مثلاً «بدون پری»
  add column if not exists manual           boolean not null default false, -- ثبت دستی توسط ادمین؟
  add column if not exists created_by       uuid references public.profiles(id),
  add column if not exists source           text not null default 'bot';   -- 'bot' | 'panel' | 'today_tomorrow_group'

-- معاملات دستی FK سفارش ندارند، nullable می‌کنیم
alter table public.trades
  alter column buy_order_id  drop not null,
  alter column sell_order_id drop not null;

-- ─── system_settings: کلیدهای جدید ─────────────────────────────────────────
insert into public.system_settings (key, value) values
  ('lafz_ttl_seconds',              '60'),
  ('settlement_reverse_minutes',    '30'),
  ('lafz_min',                      '-999'),
  ('lafz_max',                      '999'),
  ('referrer_commission_pct',       '10')
on conflict (key) do nothing;

-- ─── lafz_min/max: گسترش به منفی ─────────────────────────────────────────────
update public.markets set lafz_min = -999 where lafz_min = 1;

-- ═══════════════════════════════════════════════════════════════════════════
--  RPC: create_manual_trade — ثبت دستی معامله (عادی + اجاره + بلوکه)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.create_manual_trade(
  p_market_id        text,
  p_buyer_id         uuid,
  p_seller_id        uuid,
  p_quantity         integer,
  p_price_toman      bigint,
  p_settlement_date  date,
  p_kind             lafz_kind default 'today',
  p_trade_type       trade_type default 'normal',
  p_rent_block_value bigint default null,
  p_note             text default null
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_actor   uuid := auth.uid();
  v_role    text;
  v_trade_id text;
begin
  -- فقط ادمین یا حسابدار می‌توانند ثبت دستی کنند
  select role::text into v_role from public.profiles where id = v_actor;
  if v_role not in ('admin', 'accountant') then
    raise exception 'فقط ادمین یا حسابدار می‌تواند معامله را به‌صورت دستی ثبت کند';
  end if;

  if p_buyer_id = p_seller_id then
    raise exception 'خریدار و فروشنده نمی‌توانند یکی باشند';
  end if;

  if p_quantity <= 0 then
    raise exception 'تعداد باید مثبت باشد';
  end if;

  if p_trade_type in ('rent', 'blocked') and p_rent_block_value is null then
    raise exception 'برای معاملات اجاره/بلوکه، عدد توافقی الزامی است';
  end if;

  insert into public.trades (
    market_id, buyer_id, seller_id, buy_order_id, sell_order_id,
    quantity, price_toman, settlement_date, kind, trade_type,
    rent_block_value, note, manual, created_by, source
  ) values (
    p_market_id, p_buyer_id, p_seller_id, null, null,
    p_quantity, p_price_toman, p_settlement_date, p_kind, p_trade_type,
    p_rent_block_value, p_note, true, v_actor, 'panel'
  ) returning id into v_trade_id;

  perform public.append_audit_log(v_actor, v_role, 'TRADE_MANUAL_CREATED',
    jsonb_build_object(
      'trade_id',         v_trade_id,
      'buyer',            p_buyer_id,
      'seller',           p_seller_id,
      'quantity',         p_quantity,
      'price',            p_price_toman,
      'settlement_date',  p_settlement_date,
      'kind',             p_kind,
      'trade_type',       p_trade_type,
      'rent_block_value', p_rent_block_value,
      'note',             p_note
    ));

  return v_trade_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  RPC: edit_trade — ویرایش یک معامله توسط ادمین
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.edit_trade(
  p_trade_id    text,
  p_quantity    integer,
  p_price_toman bigint,
  p_note        text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_role  text;
  v_old   public.trades;
begin
  select role::text into v_role from public.profiles where id = v_actor;
  if v_role not in ('admin', 'accountant') then
    raise exception 'دسترسی مجاز نیست';
  end if;

  select * into v_old from public.trades where id = p_trade_id;
  if not found then raise exception 'معامله یافت نشد'; end if;

  if v_old.settled then
    raise exception 'معامله‌ی تصفیه‌شده قابل ویرایش نیست — اول تصفیه را برگشت دهید';
  end if;

  update public.trades
     set quantity    = coalesce(p_quantity,    quantity),
         price_toman = coalesce(p_price_toman, price_toman),
         note        = coalesce(p_note, note)
   where id = p_trade_id;

  perform public.append_audit_log(v_actor, v_role, 'TRADE_EDITED',
    jsonb_build_object(
      'trade_id',  p_trade_id,
      'before',    to_jsonb(v_old),
      'after_qty', p_quantity,
      'after_price', p_price_toman,
      'after_note',  p_note
    ));
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  RPC: bulk_update_traders — اعمال گروهی روی چند کاربر
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.bulk_update_traders(
  p_target_group_id    text default null,             -- null = همه‌ی تریدرها
  p_per_unit_deposit   numeric default null,
  p_commission_per_unit bigint default null,
  p_max_open_units     integer default null
) returns integer language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'فقط ادمین می‌تواند اعمال گروهی انجام دهد';
  end if;

  update public.profiles set
    per_unit_deposit    = coalesce(p_per_unit_deposit,    per_unit_deposit),
    commission_per_unit = coalesce(p_commission_per_unit, commission_per_unit),
    max_open_units      = coalesce(p_max_open_units,      max_open_units)
  where role = 'trader'
    and (p_target_group_id is null or member_group_id = p_target_group_id);

  get diagnostics v_count = row_count;

  perform public.append_audit_log(v_actor, 'admin', 'TRADERS_BULK_UPDATED',
    jsonb_build_object(
      'target_group_id', p_target_group_id,
      'per_unit_deposit', p_per_unit_deposit,
      'commission_per_unit', p_commission_per_unit,
      'max_open_units', p_max_open_units,
      'count', v_count
    ));

  return v_count;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  reverse_settlement: استفاده از system_settings برای پنجره
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.reverse_settlement(
  p_settlement_id text,
  p_reason        text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor_id   uuid := auth.uid();
  v_settlement public.settlements;
  v_snap_row   jsonb;
  v_window_min integer;
begin
  if not exists (select 1 from public.profiles where id = v_actor_id and role = 'admin') then
    raise exception 'فقط ادمین می‌تواند تصفیه را برگشت دهد';
  end if;

  select * into v_settlement from public.settlements where id = p_settlement_id;
  if not found then raise exception 'تصفیه یافت نشد'; end if;
  if v_settlement.reversed_at is not null then raise exception 'این تصفیه قبلاً برگشت خورده است'; end if;

  select coalesce((value)::text::integer, 30)
    into v_window_min
    from public.system_settings
   where key = 'settlement_reverse_minutes';

  if now() - v_settlement.applied_at > make_interval(mins => v_window_min) then
    raise exception 'پنجره % دقیقه‌ای برگشت تصفیه منقضی شده است', v_window_min;
  end if;

  for v_snap_row in select * from jsonb_array_elements(v_settlement.snapshot_before)
  loop
    update public.profiles set
      deposit_tether = (v_snap_row->>'deposit_before')::numeric
    where id = (v_snap_row->>'user_id')::uuid;
  end loop;

  update public.trades set
    settled           = false,
    settlement_id     = null,
    buyer_pnl_toman   = null,
    seller_pnl_toman  = null,
    buyer_commission  = null,
    seller_commission = null
  where settlement_id = p_settlement_id;

  update public.settlements set
    reversed_at     = now(),
    reversal_reason = p_reason
  where id = p_settlement_id;

  perform public.append_audit_log(v_actor_id, 'admin', 'SETTLEMENT_REVERSED',
    jsonb_build_object('settlement_id', p_settlement_id, 'reason', p_reason));
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  apply_settlement: استفاده از کمیسیون گروه اعضا (در صورت وجود) + رفرال
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.apply_settlement(
  p_market_id       text,
  p_settlement_date date,
  p_rate_toman      bigint,
  p_rate_tether     bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor_id      uuid := auth.uid();
  v_settlement_id text;
  v_snapshot      jsonb := '[]'::jsonb;
  v_trade         public.trades;
  v_buyer_pnl     bigint;
  v_seller_pnl    bigint;
  v_buyer_comm    bigint;
  v_seller_comm   bigint;
  v_count         integer := 0;
  v_volume        integer := 0;
  v_commission    bigint  := 0;
  v_buyer_referrer  uuid;
  v_seller_referrer uuid;
  v_referrer_pct  numeric;
  v_buyer_bonus   numeric;
  v_seller_bonus  numeric;
begin
  if not exists (select 1 from public.profiles where id = v_actor_id and role = 'admin') then
    raise exception 'فقط ادمین می‌تواند تصفیه انجام دهد';
  end if;

  select coalesce((value)::text::numeric, 10)
    into v_referrer_pct
    from public.system_settings
   where key = 'referrer_commission_pct';

  -- snapshot ودیعه‌ی همه‌ی تریدرها قبل از تصفیه
  select jsonb_agg(jsonb_build_object(
    'user_id', id,
    'deposit_before', coalesce(deposit_tether, 0)
  ))
  into v_snapshot
  from public.profiles where role = 'trader' and active;

  v_settlement_id := gen_random_uuid()::text;

  for v_trade in
    select * from public.trades
     where market_id = p_market_id
       and settlement_date = p_settlement_date
       and settled = false
     for update
  loop
    -- سود/زیان: قیمت تصفیه − قیمت معامله، × تعداد
    v_buyer_pnl  := (p_rate_toman - v_trade.price_toman) * v_trade.quantity;
    v_seller_pnl := -v_buyer_pnl;

    -- کمیسیون: اولویت با member_group، fallback به profile
    select
      coalesce(mg.commission_per_unit, p.commission_per_unit, 0) * v_trade.quantity,
      p.referrer_id
    into v_buyer_comm, v_buyer_referrer
    from public.profiles p
    left join public.member_groups mg on mg.id = p.member_group_id
    where p.id = v_trade.buyer_id;

    select
      coalesce(mg.commission_per_unit, p.commission_per_unit, 0) * v_trade.quantity,
      p.referrer_id
    into v_seller_comm, v_seller_referrer
    from public.profiles p
    left join public.member_groups mg on mg.id = p.member_group_id
    where p.id = v_trade.seller_id;

    update public.trades set
      settled           = true,
      settlement_id     = v_settlement_id,
      buyer_pnl_toman   = v_buyer_pnl,
      seller_pnl_toman  = v_seller_pnl,
      buyer_commission  = v_buyer_comm,
      seller_commission = v_seller_comm
    where id = v_trade.id;

    if p_rate_tether > 0 then
      -- ودیعه‌ی خریدار: + سود/زیان − کمیسیون (تبدیل به تتر)
      update public.profiles set deposit_tether = deposit_tether +
        (v_buyer_pnl - v_buyer_comm)::numeric / p_rate_tether
      where id = v_trade.buyer_id;

      update public.profiles set deposit_tether = deposit_tether +
        (v_seller_pnl - v_seller_comm)::numeric / p_rate_tether
      where id = v_trade.seller_id;

      -- پاداش رفرال: درصد از کمیسیون به معرف
      if v_buyer_referrer is not null and v_referrer_pct > 0 then
        v_buyer_bonus := v_buyer_comm * v_referrer_pct / 100.0 / p_rate_tether;
        update public.profiles set deposit_tether = deposit_tether + v_buyer_bonus
         where id = v_buyer_referrer;
      end if;

      if v_seller_referrer is not null and v_referrer_pct > 0 then
        v_seller_bonus := v_seller_comm * v_referrer_pct / 100.0 / p_rate_tether;
        update public.profiles set deposit_tether = deposit_tether + v_seller_bonus
         where id = v_seller_referrer;
      end if;
    end if;

    v_count      := v_count + 1;
    v_volume     := v_volume + v_trade.quantity;
    v_commission := v_commission + v_buyer_comm + v_seller_comm;
  end loop;

  -- لغو سفارش‌های باز همان روز/بازار
  update public.orders set
    status        = 'cancelled',
    cancelled_at  = now(),
    cancel_reason = 'auto-cancel-settlement'
  where market_id = p_market_id
    and settlement_date = p_settlement_date
    and status in ('open', 'partial');

  insert into public.settlements
    (id, market_id, settlement_date, rate_toman, rate_tether,
     applied_by, snapshot_before, total_trades_count, total_volume_units, total_commission_toman)
  values
    (v_settlement_id, p_market_id, p_settlement_date, p_rate_toman, p_rate_tether,
     v_actor_id, v_snapshot, v_count, v_volume, v_commission);

  perform public.append_audit_log(v_actor_id, 'admin', 'SETTLEMENT_APPLIED',
    jsonb_build_object('settlement_id', v_settlement_id, 'market_id', p_market_id,
                       'date', p_settlement_date, 'rate_toman', p_rate_toman,
                       'count', v_count, 'volume', v_volume));

  return jsonb_build_object('settlement_id', v_settlement_id,
                            'affected_traders', v_count,
                            'total_volume', v_volume,
                            'total_commission', v_commission);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  Realtime + RLS برای جدول جدید
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.member_groups enable row level security;

drop policy if exists "groups: all read"     on public.member_groups;
drop policy if exists "groups: admin write"  on public.member_groups;
drop policy if exists "groups: admin update" on public.member_groups;

create policy "groups: all read"
  on public.member_groups for select using (true);

create policy "groups: admin write"
  on public.member_groups for insert with check (public.current_role() = 'admin');

create policy "groups: admin update"
  on public.member_groups for update using (public.current_role() = 'admin');

do $$ begin
  alter publication supabase_realtime add table public.member_groups;
exception when duplicate_object then null; end $$;
