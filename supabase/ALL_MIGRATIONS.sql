-- ============================================================
-- 0001_init.sql
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  اتاق معاملات — Migration 0001: Full Schema
--  Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensions ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type user_role  as enum ('admin', 'accountant', 'trader');
  create type order_side as enum ('buy', 'sell');
  create type order_status as enum ('open', 'partial', 'filled', 'cancelled');
  create type margin_zone as enum ('safe', 'warn', 'risk', 'call');
exception when duplicate_object then null;
end $$;

-- ─── Helper: updated_at trigger ─────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── profiles ───────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text not null,
  phone               text not null default '',
  telegram_id         text,
  role                user_role not null default 'trader',
  active              boolean not null default false,
  deposit_tether      numeric(18,6) default 0,
  per_unit_deposit    numeric(18,6) default 500,
  commission_per_unit bigint default 50000,
  approved_by         uuid references public.profiles(id),
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function update_updated_at();

-- ─── markets ────────────────────────────────────────────────────────────────
create table if not exists public.markets (
  id            text primary key default gen_random_uuid()::text,
  name          text not null,
  symbol        text not null unique,
  unit_weight   numeric not null default 100,
  unit_label    text not null default 'گرم',
  lafz_min      integer not null default 1,
  lafz_max      integer not null default 999,
  lafz_scale    bigint not null default 1000,
  mazne_current bigint not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists markets_updated_at on public.markets;
create trigger markets_updated_at before update on public.markets
  for each row execute function update_updated_at();

-- ─── orders ─────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id              text primary key default gen_random_uuid()::text,
  trader_id       uuid not null references public.profiles(id),
  market_id       text not null references public.markets(id),
  side            order_side not null,
  lafz            integer not null,
  price_toman     bigint not null,
  quantity        integer not null check (quantity > 0),
  filled          integer not null default 0 check (filled >= 0),
  remaining       integer not null check (remaining >= 0),
  settlement_date date not null,
  status          order_status not null default 'open',
  placed_at       timestamptz not null default now(),
  cancelled_at    timestamptz,
  cancel_reason   text,
  constraint orders_filled_lte_qty check (filled <= quantity),
  constraint orders_remaining_correct check (remaining = quantity - filled)
);

create index if not exists idx_orders_book
  on public.orders(market_id, settlement_date, status, side, price_toman, placed_at);
create index if not exists idx_orders_trader
  on public.orders(trader_id, status);

-- ─── trades ─────────────────────────────────────────────────────────────────
create table if not exists public.trades (
  id                text primary key default gen_random_uuid()::text,
  market_id         text not null references public.markets(id),
  buyer_id          uuid not null references public.profiles(id),
  seller_id         uuid not null references public.profiles(id),
  buy_order_id      text not null references public.orders(id),
  sell_order_id     text not null references public.orders(id),
  quantity          integer not null check (quantity > 0),
  price_toman       bigint not null,
  settlement_date   date not null,
  matched_at        timestamptz not null default now(),
  settled           boolean not null default false,
  settlement_id     text,
  buyer_pnl_toman   bigint,
  seller_pnl_toman  bigint,
  buyer_commission  bigint,
  seller_commission bigint
);

create index if not exists idx_trades_buyer   on public.trades(buyer_id, settled);
create index if not exists idx_trades_seller  on public.trades(seller_id, settled);
create index if not exists idx_trades_settle  on public.trades(market_id, settlement_date, settled);

-- ─── settlements ────────────────────────────────────────────────────────────
create table if not exists public.settlements (
  id                     text primary key default gen_random_uuid()::text,
  market_id              text not null references public.markets(id),
  settlement_date        date not null,
  rate_toman             bigint not null,
  rate_tether            bigint not null,
  applied_at             timestamptz not null default now(),
  applied_by             uuid not null references public.profiles(id),
  reversed_at            timestamptz,
  reversal_reason        text,
  snapshot_before        jsonb not null default '[]',
  total_trades_count     integer not null default 0,
  total_volume_units     integer not null default 0,
  total_commission_toman bigint not null default 0
);

-- ─── audit_log ──────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id          text primary key,
  prev_id     text references public.audit_log(id),
  hash        text not null,
  actor_id    uuid not null,
  actor_role  text not null,
  action      text not null,
  payload     jsonb not null default '{}',
  timestamp   timestamptz not null default now()
);

create index if not exists idx_audit_ts on public.audit_log(timestamp desc);

-- ─── notifications ──────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         text primary key default gen_random_uuid()::text,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null default 'info',
  title      text not null,
  body       text not null default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notif_user on public.notifications(user_id, read, created_at desc);

-- ─── system_settings ────────────────────────────────────────────────────────
create table if not exists public.system_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
--  TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Handle new auth user → create profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_full_name text;
  v_phone     text;
  v_telegram  text;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  v_phone     := coalesce(new.raw_user_meta_data->>'phone', '');
  v_telegram  := new.raw_user_meta_data->>'telegram_id';

  insert into public.profiles (id, full_name, phone, telegram_id, role, active)
  values (new.id, v_full_name, v_phone, v_telegram, 'trader', false)
  on conflict (id) do nothing;

  -- Notify all admins
  insert into public.notifications (user_id, type, title, body)
  select p.id, 'new_trader', 'تریدر جدید', 'کاربر ' || v_full_name || ' ثبت‌نام کرده است'
  from public.profiles p
  where p.role = 'admin' and p.active = true;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Audit log append (append-only hash chain) ──────────────────────────────
create or replace function public.append_audit_log(
  p_actor_id   uuid,
  p_actor_role text,
  p_action     text,
  p_payload    jsonb
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_prev_id   text;
  v_prev_hash text;
  v_new_id    text;
  v_hash      text;
  v_ts        timestamptz := now();
begin
  select id, hash into v_prev_id, v_prev_hash
  from public.audit_log order by timestamp desc limit 1;

  v_prev_hash := coalesce(v_prev_hash, 'genesis');

  v_hash := encode(
    digest(v_prev_hash || p_payload::text || v_ts::text, 'sha256'),
    'hex'
  );
  v_new_id := encode(digest(v_hash || random()::text, 'sha256'), 'hex');

  insert into public.audit_log (id, prev_id, hash, actor_id, actor_role, action, payload, timestamp)
  values (v_new_id, v_prev_id, v_hash, p_actor_id, p_actor_role, p_action, p_payload, v_ts);

  return v_new_id;
end;
$$;

-- Trigger audit on key tables
create or replace function public.audit_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor    uuid;
  v_role     text;
  v_action   text;
  v_payload  jsonb;
begin
  v_actor := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  begin select role::text into v_role from public.profiles where id = v_actor; exception when others then v_role := 'system'; end;

  v_action  := tg_table_name || '_' || tg_op;
  v_payload := case tg_op
    when 'DELETE' then jsonb_build_object('old', to_jsonb(old))
    when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
    else jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
  end;

  perform public.append_audit_log(v_actor, coalesce(v_role, 'system'), upper(v_action), v_payload);
  return coalesce(new, old);
end;
$$;

-- Attach audit trigger to key tables
drop trigger if exists audit_markets     on public.markets;
drop trigger if exists audit_profiles    on public.profiles;
drop trigger if exists audit_settlements on public.settlements;

create trigger audit_markets
  after insert or update or delete on public.markets
  for each row execute function public.audit_changes();

create trigger audit_profiles
  after update on public.profiles
  for each row execute function public.audit_changes();

create trigger audit_settlements
  after insert or update on public.settlements
  for each row execute function public.audit_changes();

-- ═══════════════════════════════════════════════════════════════════════════
--  RPC FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── place_order ────────────────────────────────────────────────────────────
create or replace function public.place_order(
  p_market_id       text,
  p_side            order_side,
  p_lafz            integer,
  p_quantity        integer,
  p_settlement_date date
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trader_id    uuid := auth.uid();
  v_market       public.markets;
  v_price_toman  bigint;
  v_order_id     text;
  v_new_order    public.orders;
  v_candidate    public.orders;
  v_remaining    integer;
  v_match_qty    integer;
  v_match_price  bigint;
  v_trade_id     text;
  v_trades       jsonb := '[]'::jsonb;
begin
  -- Validate trader
  if not exists (select 1 from public.profiles where id = v_trader_id and role = 'trader' and active) then
    raise exception 'دسترسی مجاز نیست';
  end if;

  -- Load market
  select * into v_market from public.markets where id = p_market_id and active;
  if not found then raise exception 'بازار یافت نشد'; end if;

  -- Validate lafz
  if p_lafz < v_market.lafz_min or p_lafz > v_market.lafz_max then
    raise exception 'لفظ باید بین % و % باشد', v_market.lafz_min, v_market.lafz_max;
  end if;

  -- Compute price
  v_price_toman := v_market.mazne_current + (p_lafz::bigint * v_market.lafz_scale);

  -- Insert new order
  insert into public.orders
    (trader_id, market_id, side, lafz, price_toman, quantity, filled, remaining, settlement_date, status)
  values
    (v_trader_id, p_market_id, p_side, p_lafz, v_price_toman, p_quantity, 0, p_quantity, p_settlement_date, 'open')
  returning * into v_new_order;

  v_order_id  := v_new_order.id;
  v_remaining := p_quantity;

  -- Matching engine (SKIP LOCKED for concurrency safety)
  for v_candidate in
    select * from public.orders
    where market_id       = p_market_id
      and settlement_date = p_settlement_date
      and status          in ('open', 'partial')
      and trader_id       != v_trader_id
      and (
        case when p_side = 'buy'
          then side = 'sell' and price_toman <= v_price_toman
          else side = 'buy'  and price_toman >= v_price_toman
        end
      )
    order by price_toman asc, placed_at asc
    for update skip locked
  loop
    exit when v_remaining = 0;

    v_match_qty   := least(v_remaining, v_candidate.remaining);
    v_match_price := least(v_new_order.price_toman, v_candidate.price_toman);

    -- Create trade
    insert into public.trades
      (market_id, buyer_id, seller_id, buy_order_id, sell_order_id,
       quantity, price_toman, settlement_date)
    values (
      p_market_id,
      case when p_side = 'buy' then v_trader_id else v_candidate.trader_id end,
      case when p_side = 'sell' then v_trader_id else v_candidate.trader_id end,
      case when p_side = 'buy' then v_order_id else v_candidate.id end,
      case when p_side = 'sell' then v_order_id else v_candidate.id end,
      v_match_qty, v_match_price, p_settlement_date
    ) returning id into v_trade_id;

    v_trades := v_trades || jsonb_build_object(
      'trade_id', v_trade_id,
      'quantity', v_match_qty,
      'price', v_match_price
    );

    -- Update candidate order
    update public.orders set
      filled    = filled + v_match_qty,
      remaining = remaining - v_match_qty,
      status    = case when remaining - v_match_qty = 0 then 'filled' else 'partial' end
    where id = v_candidate.id;

    v_remaining := v_remaining - v_match_qty;
  end loop;

  -- Update new order status
  update public.orders set
    filled    = p_quantity - v_remaining,
    remaining = v_remaining,
    status    = case
      when v_remaining = 0             then 'filled'
      when p_quantity - v_remaining > 0 then 'partial'
      else 'open'
    end
  where id = v_order_id;

  return jsonb_build_object('order_id', v_order_id, 'trades', v_trades, 'remaining', v_remaining);
end;
$$;

-- ─── cancel_order ────────────────────────────────────────────────────────────
create or replace function public.cancel_order(
  p_order_id text,
  p_reason   text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_trader_id uuid := auth.uid();
begin
  update public.orders set
    status       = 'cancelled',
    cancelled_at = now(),
    cancel_reason = p_reason
  where id = p_order_id
    and trader_id = v_trader_id
    and status = 'open';

  if not found then
    raise exception 'سفارش یافت نشد یا قابل لغو نیست';
  end if;
end;
$$;

-- ─── compute_user_margin ─────────────────────────────────────────────────────
create or replace function public.compute_user_margin(
  p_user_id      uuid,
  p_market_id    text,
  p_current_price bigint,
  p_tether_rate  bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile        public.profiles;
  v_open_units     integer := 0;
  v_floating_toman bigint  := 0;
  v_floating_tether numeric;
  v_required       numeric;
  v_available      numeric;
  v_pct            numeric;
  v_zone           text;
begin
  select * into v_profile from public.profiles where id = p_user_id;

  -- Sum open positions
  select
    coalesce(sum(t.quantity), 0),
    coalesce(sum(
      case
        when t.buyer_id = p_user_id  then (p_current_price - t.price_toman) * t.quantity
        when t.seller_id = p_user_id then (t.price_toman - p_current_price) * t.quantity
        else 0
      end
    ), 0)
  into v_open_units, v_floating_toman
  from public.trades t
  where t.market_id = p_market_id
    and t.settled = false
    and (t.buyer_id = p_user_id or t.seller_id = p_user_id);

  v_required       := v_open_units * coalesce(v_profile.per_unit_deposit, 0);
  v_floating_tether := case when p_tether_rate > 0 then v_floating_toman::numeric / p_tether_rate else 0 end;
  v_available      := coalesce(v_profile.deposit_tether, 0) + v_floating_tether;
  v_pct            := case when v_required = 0 then 100 else (v_available / v_required) * 100 end;
  v_zone           := case
    when v_pct >= 85 then 'safe'
    when v_pct >= 70 then 'warn'
    when v_pct >= 50 then 'risk'
    else 'call'
  end;

  return jsonb_build_object(
    'required_tether',    v_required,
    'available_tether',   v_available,
    'floating_pnl_tether', v_floating_tether,
    'percentage',          round(v_pct, 2),
    'zone',                v_zone
  );
end;
$$;

-- ─── get_settlement_preview ──────────────────────────────────────────────────
create or replace function public.get_settlement_preview(
  p_market_id       text,
  p_settlement_date date,
  p_test_price      bigint,
  p_tether_rate     bigint
) returns table (
  trader_id             uuid,
  full_name             text,
  deposit_tether        numeric,
  floating_pnl_toman    bigint,
  floating_pnl_tether   numeric,
  commission_accumulated bigint,
  required_tether       numeric,
  available_tether      numeric,
  percentage            numeric,
  zone                  text
) language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    p.id,
    p.full_name,
    coalesce(p.deposit_tether, 0),
    coalesce(sum(
      case
        when t.buyer_id  = p.id then (p_test_price - t.price_toman) * t.quantity
        when t.seller_id = p.id then (t.price_toman - p_test_price) * t.quantity
        else 0
      end
    ), 0)::bigint,
    case when p_tether_rate > 0 then coalesce(sum(
      case
        when t.buyer_id  = p.id then (p_test_price - t.price_toman) * t.quantity
        when t.seller_id = p.id then (t.price_toman - p_test_price) * t.quantity
        else 0
      end
    ), 0)::numeric / p_tether_rate else 0 end,
    coalesce(count(t.id)::bigint * coalesce(p.commission_per_unit, 0), 0),
    coalesce(count(t.id)::bigint, 0) * coalesce(p.per_unit_deposit, 0),
    coalesce(p.deposit_tether, 0) + (
      case when p_tether_rate > 0 then coalesce(sum(
        case
          when t.buyer_id  = p.id then (p_test_price - t.price_toman) * t.quantity::numeric
          when t.seller_id = p.id then (t.price_toman - p_test_price) * t.quantity::numeric
          else 0
        end
      ), 0) / p_tether_rate else 0 end
    ),
    case
      when (coalesce(count(t.id)::bigint, 0) * coalesce(p.per_unit_deposit, 0)) = 0 then 100
      else round(
        (coalesce(p.deposit_tether, 0) + (
          case when p_tether_rate > 0 then coalesce(sum(
            case
              when t.buyer_id  = p.id then (p_test_price - t.price_toman) * t.quantity::numeric
              when t.seller_id = p.id then (t.price_toman - p_test_price) * t.quantity::numeric
              else 0
            end
          ), 0) / p_tether_rate else 0 end
        )) / (coalesce(count(t.id)::bigint, 0) * coalesce(p.per_unit_deposit, 0)) * 100,
        2
      )
    end,
    case
      when (coalesce(count(t.id)::bigint, 0) * coalesce(p.per_unit_deposit, 0)) = 0 then 'safe'
      when (
        (coalesce(p.deposit_tether, 0)) / (coalesce(count(t.id)::bigint, 0) * coalesce(p.per_unit_deposit, 0)) * 100
      ) >= 85 then 'safe'
      when (
        (coalesce(p.deposit_tether, 0)) / (coalesce(count(t.id)::bigint, 0) * coalesce(p.per_unit_deposit, 0)) * 100
      ) >= 70 then 'warn'
      when (
        (coalesce(p.deposit_tether, 0)) / (coalesce(count(t.id)::bigint, 0) * coalesce(p.per_unit_deposit, 0)) * 100
      ) >= 50 then 'risk'
      else 'call'
    end
  from public.profiles p
  left join public.trades t on
    t.market_id = p_market_id
    and t.settlement_date = p_settlement_date
    and t.settled = false
    and (t.buyer_id = p.id or t.seller_id = p.id)
  where p.role = 'trader' and p.active = true
  group by p.id, p.full_name, p.deposit_tether, p.per_unit_deposit, p.commission_per_unit;
end;
$$;

-- ─── apply_settlement ────────────────────────────────────────────────────────
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
begin
  -- Only admins
  if not exists (select 1 from public.profiles where id = v_actor_id and role = 'admin') then
    raise exception 'فقط ادمین می‌تواند تصفیه انجام دهد';
  end if;

  -- Snapshot deposits
  select jsonb_agg(jsonb_build_object(
    'user_id', id,
    'deposit_before', coalesce(deposit_tether, 0)
  ))
  into v_snapshot
  from public.profiles where role = 'trader' and active;

  v_settlement_id := gen_random_uuid()::text;

  -- Process each unsettled trade
  for v_trade in
    select * from public.trades
    where market_id = p_market_id
      and settlement_date = p_settlement_date
      and settled = false
    for update
  loop
    v_buyer_pnl  := (p_rate_toman - v_trade.price_toman) * v_trade.quantity;
    v_seller_pnl := -v_buyer_pnl;

    select coalesce(commission_per_unit, 0) * v_trade.quantity into v_buyer_comm
    from public.profiles where id = v_trade.buyer_id;
    select coalesce(commission_per_unit, 0) * v_trade.quantity into v_seller_comm
    from public.profiles where id = v_trade.seller_id;

    -- Update trade
    update public.trades set
      settled           = true,
      settlement_id     = v_settlement_id,
      buyer_pnl_toman   = v_buyer_pnl,
      seller_pnl_toman  = v_seller_pnl,
      buyer_commission  = v_buyer_comm,
      seller_commission = v_seller_comm
    where id = v_trade.id;

    -- Update buyer deposit
    if p_rate_tether > 0 then
      update public.profiles set deposit_tether = deposit_tether +
        (v_buyer_pnl - v_buyer_comm)::numeric / p_rate_tether
      where id = v_trade.buyer_id;

      update public.profiles set deposit_tether = deposit_tether +
        (v_seller_pnl - v_seller_comm)::numeric / p_rate_tether
      where id = v_trade.seller_id;
    end if;

    v_count      := v_count + 1;
    v_volume     := v_volume + v_trade.quantity;
    v_commission := v_commission + v_buyer_comm + v_seller_comm;
  end loop;

  -- Cancel remaining open orders for this date
  update public.orders set
    status       = 'cancelled',
    cancelled_at = now(),
    cancel_reason = 'auto-cancel-settlement'
  where market_id = p_market_id
    and settlement_date = p_settlement_date
    and status in ('open', 'partial');

  -- Create settlement record
  insert into public.settlements
    (id, market_id, settlement_date, rate_toman, rate_tether,
     applied_by, snapshot_before, total_trades_count, total_volume_units, total_commission_toman)
  values
    (v_settlement_id, p_market_id, p_settlement_date, p_rate_toman, p_rate_tether,
     v_actor_id, v_snapshot, v_count, v_volume, v_commission);

  perform public.append_audit_log(v_actor_id, 'admin', 'SETTLEMENT_APPLIED',
    jsonb_build_object('settlement_id', v_settlement_id, 'market_id', p_market_id,
                       'date', p_settlement_date, 'rate_toman', p_rate_toman));

  return jsonb_build_object('settlement_id', v_settlement_id, 'affected_traders', v_count);
end;
$$;

-- ─── reverse_settlement ──────────────────────────────────────────────────────
create or replace function public.reverse_settlement(
  p_settlement_id text,
  p_reason        text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor_id   uuid := auth.uid();
  v_settlement public.settlements;
  v_snap_row   jsonb;
begin
  if not exists (select 1 from public.profiles where id = v_actor_id and role = 'admin') then
    raise exception 'فقط ادمین می‌تواند تصفیه را برگشت دهد';
  end if;

  select * into v_settlement from public.settlements where id = p_settlement_id;
  if not found then raise exception 'تصفیه یافت نشد'; end if;
  if v_settlement.reversed_at is not null then raise exception 'این تصفیه قبلاً برگشت خورده است'; end if;
  if now() - v_settlement.applied_at > interval '30 minutes' then
    raise exception 'پنجره ۳۰ دقیقه‌ای برگشت تصفیه منقضی شده است';
  end if;

  -- Restore deposits from snapshot
  for v_snap_row in select * from jsonb_array_elements(v_settlement.snapshot_before)
  loop
    update public.profiles set
      deposit_tether = (v_snap_row->>'deposit_before')::numeric
    where id = (v_snap_row->>'user_id')::uuid;
  end loop;

  -- Unsettle trades
  update public.trades set
    settled           = false,
    settlement_id     = null,
    buyer_pnl_toman   = null,
    seller_pnl_toman  = null,
    buyer_commission  = null,
    seller_commission = null
  where settlement_id = p_settlement_id;

  -- Mark reversed
  update public.settlements set
    reversed_at    = now(),
    reversal_reason = p_reason
  where id = p_settlement_id;

  perform public.append_audit_log(v_actor_id, 'admin', 'SETTLEMENT_REVERSED',
    jsonb_build_object('settlement_id', p_settlement_id, 'reason', p_reason));
end;
$$;

-- ─── update_mazne ────────────────────────────────────────────────────────────
create or replace function public.update_mazne(
  p_market_id text,
  p_new_mazne bigint
) returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid();
begin
  if not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'فقط ادمین می‌تواند مزنه را تغییر دهد';
  end if;

  update public.markets set mazne_current = p_new_mazne where id = p_market_id;

  perform public.append_audit_log(v_actor, 'admin', 'MAZNE_UPDATED',
    jsonb_build_object('market_id', p_market_id, 'new_mazne', p_new_mazne));
end;
$$;

-- ─── approve_trader ──────────────────────────────────────────────────────────
create or replace function public.approve_trader(
  p_trader_id       uuid,
  p_deposit         numeric,
  p_per_unit_deposit numeric,
  p_commission      bigint
) returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid();
begin
  if not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'فقط ادمین می‌تواند تریدر را تأیید کند';
  end if;

  update public.profiles set
    active            = true,
    deposit_tether    = p_deposit,
    per_unit_deposit  = p_per_unit_deposit,
    commission_per_unit = p_commission,
    approved_by       = v_actor,
    approved_at       = now()
  where id = p_trader_id and role = 'trader';

  -- Notify trader
  insert into public.notifications (user_id, type, title, body)
  values (p_trader_id, 'account_approved', 'حساب شما تأیید شد', 'حساب معاملاتی شما توسط ادمین فعال شد. می‌توانید وارد اتاق معاملات شوید.');

  perform public.append_audit_log(v_actor, 'admin', 'TRADER_APPROVED',
    jsonb_build_object('trader_id', p_trader_id, 'deposit', p_deposit));
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles     enable row level security;
alter table public.markets      enable row level security;
alter table public.orders       enable row level security;
alter table public.trades       enable row level security;
alter table public.settlements  enable row level security;
alter table public.audit_log    enable row level security;
alter table public.notifications enable row level security;
alter table public.system_settings enable row level security;

-- Helper to get current user role
create or replace function public.current_role()
returns text language sql security definer set search_path = public as $$
  select role::text from public.profiles where id = auth.uid();
$$;

-- ─── profiles RLS ────────────────────────────────────────────────────────────
drop policy if exists "profiles: own read"          on public.profiles;
drop policy if exists "profiles: admin read all"    on public.profiles;
drop policy if exists "profiles: accountant read all" on public.profiles;
drop policy if exists "profiles: trader see names"  on public.profiles;
drop policy if exists "profiles: admin write all"   on public.profiles;
drop policy if exists "profiles: own update"        on public.profiles;

create policy "profiles: own read"
  on public.profiles for select using (id = auth.uid());

create policy "profiles: admin read all"
  on public.profiles for select using (public.current_role() = 'admin');

create policy "profiles: accountant read all"
  on public.profiles for select using (public.current_role() = 'accountant');

create policy "profiles: trader see names"
  on public.profiles for select using (public.current_role() = 'trader');

create policy "profiles: admin write all"
  on public.profiles for update using (public.current_role() = 'admin');

create policy "profiles: own update"
  on public.profiles for update using (id = auth.uid());

-- ─── markets RLS ─────────────────────────────────────────────────────────────
drop policy if exists "markets: all read"    on public.markets;
drop policy if exists "markets: admin write" on public.markets;
drop policy if exists "markets: admin update" on public.markets;

create policy "markets: all read"
  on public.markets for select using (true);

create policy "markets: admin write"
  on public.markets for insert with check (public.current_role() = 'admin');

create policy "markets: admin update"
  on public.markets for update using (public.current_role() = 'admin');

-- ─── orders RLS ──────────────────────────────────────────────────────────────
drop policy if exists "orders: all read open"      on public.orders;
drop policy if exists "orders: trader insert own"  on public.orders;
drop policy if exists "orders: update via rpc"     on public.orders;

create policy "orders: all read open"
  on public.orders for select using (
    status in ('open', 'partial')
    or trader_id = auth.uid()
    or public.current_role() in ('admin', 'accountant')
  );

create policy "orders: trader insert own"
  on public.orders for insert with check (trader_id = auth.uid());

create policy "orders: update via rpc"
  on public.orders for update using (true);

-- ─── trades RLS ──────────────────────────────────────────────────────────────
drop policy if exists "trades: all read"       on public.trades;
drop policy if exists "trades: insert via rpc" on public.trades;
drop policy if exists "trades: update via rpc" on public.trades;

create policy "trades: all read"
  on public.trades for select using (
    buyer_id = auth.uid()
    or seller_id = auth.uid()
    or public.current_role() in ('admin', 'accountant')
  );

create policy "trades: insert via rpc"
  on public.trades for insert with check (true);

create policy "trades: update via rpc"
  on public.trades for update using (true);

-- ─── settlements RLS ─────────────────────────────────────────────────────────
drop policy if exists "settlements: admin accountant read" on public.settlements;
drop policy if exists "settlements: insert via rpc"        on public.settlements;
drop policy if exists "settlements: update via rpc"        on public.settlements;

create policy "settlements: admin accountant read"
  on public.settlements for select using (public.current_role() in ('admin', 'accountant'));

create policy "settlements: insert via rpc"
  on public.settlements for insert with check (true);

create policy "settlements: update via rpc"
  on public.settlements for update using (true);

-- ─── audit_log RLS ───────────────────────────────────────────────────────────
drop policy if exists "audit: admin accountant read" on public.audit_log;

create policy "audit: admin accountant read"
  on public.audit_log for select using (public.current_role() in ('admin', 'accountant'));

-- ─── notifications RLS ───────────────────────────────────────────────────────
drop policy if exists "notif: own read"          on public.notifications;
drop policy if exists "notif: own update"        on public.notifications;
drop policy if exists "notif: insert via trigger" on public.notifications;

create policy "notif: own read"
  on public.notifications for select using (user_id = auth.uid());

create policy "notif: own update"
  on public.notifications for update using (user_id = auth.uid());

create policy "notif: insert via trigger"
  on public.notifications for insert with check (true);

-- ─── system_settings RLS ─────────────────────────────────────────────────────
drop policy if exists "settings: all read"    on public.system_settings;
drop policy if exists "settings: admin write" on public.system_settings;
drop policy if exists "settings: admin update" on public.system_settings;

create policy "settings: all read"
  on public.system_settings for select using (true);

create policy "settings: admin write"
  on public.system_settings for insert with check (public.current_role() = 'admin');

create policy "settings: admin update"
  on public.system_settings for update using (public.current_role() = 'admin');

-- ═══════════════════════════════════════════════════════════════════════════
--  REALTIME
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.trades;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.markets;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.settlements;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- Initial market: طلای آب‌شده
insert into public.markets (id, name, symbol, unit_weight, unit_label, lafz_min, lafz_max, lafz_scale, mazne_current, active)
values ('market-gold', 'طلای آب‌شده', 'GOLD', 100, 'گرم', 1, 999, 1000, 88300000, true)
on conflict (id) do nothing;

-- System settings
insert into public.system_settings (key, value) values
  ('margin_zone_safe',  '85'),
  ('margin_zone_warn',  '70'),
  ('margin_zone_risk',  '50'),
  ('trading_open_hour',  '9'),
  ('trading_open_min',   '0'),
  ('trading_lock_hour',  '13'),
  ('trading_lock_min',   '30'),
  ('default_tether_rate', '97000')
on conflict (key) do nothing;

-- ─── Create first admin ──────────────────────────────────────────────────────
-- NOTE: You cannot insert directly into auth.users via SQL.
-- Create the admin account via Supabase Dashboard → Authentication → Users → Add User
-- Then run this UPDATE to set their role:
--
--   UPDATE public.profiles
--   SET role = 'admin', active = true
--   WHERE id = '<YOUR_USER_UUID>';
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ============================================================
-- 0002_lafz_semantics_and_groups.sql
-- ============================================================

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

-- ============================================================
-- 0003_user_roles_and_super_admin.sql
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  Migration 0003 — اصلاح تعیین نقش هنگام ثبت‌نام + سوپر‌ادمین
--  - trigger handle_new_user حالا role را از metadata می‌خواند (نه ثابت 'trader')
--  - فیلد is_super_admin روی profile (فقط سوپرادمین می‌تواند ادمین‌های دیگر را تأیید کند)
--  - admin/accountant جدید به‌صورت active=false ساخته می‌شوند تا ادمین تأیید کند
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

-- ─── handle_new_user — read role from raw_user_meta_data ────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_full_name text;
  v_phone     text;
  v_telegram  text;
  v_role      user_role;
  v_active    boolean;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  v_phone     := coalesce(new.raw_user_meta_data->>'phone', '');
  v_telegram  := new.raw_user_meta_data->>'telegram_id';

  -- نقش از metadata (اگر معتبر) وگرنه پیش‌فرض trader
  begin
    v_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'trader'::user_role);
  exception when others then
    v_role := 'trader'::user_role;
  end;

  -- همه‌ی نقش‌ها موقع ساخت غیرفعال‌اند تا ادمین/سوپرادمین تأیید کند
  v_active := false;

  insert into public.profiles (id, full_name, phone, telegram_id, role, active)
  values (new.id, v_full_name, v_phone, v_telegram, v_role, v_active)
  on conflict (id) do nothing;

  -- اعلام به ادمین‌های فعال
  insert into public.notifications (user_id, type, title, body)
  select p.id, 'new_user', 'کاربر جدید',
         'کاربر ' || v_full_name || ' (' || v_role::text || ') ثبت‌نام کرده — نیاز به تأیید'
  from public.profiles p
  where p.role = 'admin' and p.active = true;

  return new;
end;
$$;

-- ─── First-admin bootstrap: اگر هنوز سوپرادمینی نیست، اولین admin فعال = سوپرادمین ─
create or replace function public.bootstrap_super_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'admin' and new.active = true and not exists (
    select 1 from public.profiles where is_super_admin = true
  ) then
    update public.profiles set is_super_admin = true where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_bootstrap_super_admin on public.profiles;
create trigger profiles_bootstrap_super_admin
  after update on public.profiles
  for each row
  when (new.active = true and new.role = 'admin')
  execute function public.bootstrap_super_admin();

-- ─── approve_user — جایگزین approve_trader، برای همه نقش‌ها ────────────────
create or replace function public.approve_user(
  p_user_id            uuid,
  p_deposit            numeric default null,
  p_per_unit_deposit   numeric default null,
  p_commission         bigint  default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role user_role;
  v_target_role user_role;
  v_actor_super boolean;
begin
  select role, is_super_admin into v_actor_role, v_actor_super
  from public.profiles where id = v_actor;

  if v_actor_role <> 'admin' then
    raise exception 'فقط ادمین می‌تواند کاربر را تأیید کند';
  end if;

  select role into v_target_role from public.profiles where id = p_user_id;
  if v_target_role is null then raise exception 'کاربر یافت نشد'; end if;

  -- ادمین جدید را فقط سوپرادمین می‌تواند تأیید کند
  if v_target_role = 'admin' and not coalesce(v_actor_super, false) then
    raise exception 'فقط سوپرادمین می‌تواند ادمین جدید را تأیید کند';
  end if;

  update public.profiles set
    active              = true,
    deposit_tether      = case when v_target_role = 'trader' then coalesce(p_deposit, 0) else deposit_tether end,
    per_unit_deposit    = case when v_target_role = 'trader' then coalesce(p_per_unit_deposit, 500) else per_unit_deposit end,
    commission_per_unit = case when v_target_role = 'trader' then coalesce(p_commission, 50000) else commission_per_unit end,
    approved_by         = v_actor,
    approved_at         = now()
  where id = p_user_id;

  insert into public.notifications (user_id, type, title, body)
  values (p_user_id, 'account_approved', 'حساب شما تأیید شد',
          'حساب ' || v_target_role::text || ' شما توسط ادمین تأیید شد.');

  perform public.append_audit_log(v_actor, 'admin', 'USER_APPROVED',
    jsonb_build_object('user_id', p_user_id, 'role', v_target_role::text));
end;
$$;

-- approve_trader را به‌عنوان wrapper نگه می‌داریم تا کد قدیمی نشکند
create or replace function public.approve_trader(
  p_trader_id        uuid,
  p_deposit          numeric,
  p_per_unit_deposit numeric,
  p_commission       bigint
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.approve_user(p_trader_id, p_deposit, p_per_unit_deposit, p_commission);
end;
$$;

-- ─── update_own_profile — هر کاربر می‌تواند فیلدهای امن خودش را عوض کند ────
create or replace function public.update_own_profile(
  p_full_name   text default null,
  p_phone       text default null,
  p_telegram_id text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'دسترسی مجاز نیست'; end if;

  update public.profiles set
    full_name   = coalesce(p_full_name, full_name),
    phone       = coalesce(p_phone, phone),
    telegram_id = coalesce(p_telegram_id, telegram_id)
  where id = v_actor;

  perform public.append_audit_log(v_actor, 'self', 'PROFILE_SELF_UPDATED',
    jsonb_build_object('full_name', p_full_name, 'phone', p_phone, 'telegram_id', p_telegram_id));
end;
$$;

-- ============================================================
-- 0004_fix_place_order_casts.sql
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  Migration 0004 — رفع خطای "You will need to rewrite or cast the expression"
--  در RPC place_order که از CASE WHEN p_side = 'buy' THEN ... استفاده می‌کرد.
--  این الگو وقتی enum با literal مقایسه می‌شود گاهی Postgres نمی‌تواند operator
--  مناسب پیدا کند. به‌جایش OR ساده با cast صریح می‌گذاریم.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.place_order(
  p_market_id       text,
  p_side            order_side,
  p_lafz            integer,
  p_quantity        integer,
  p_settlement_date date
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trader_id    uuid := auth.uid();
  v_market       public.markets;
  v_price_toman  bigint;
  v_order_id     text;
  v_new_order    public.orders;
  v_candidate    public.orders;
  v_remaining    integer;
  v_match_qty    integer;
  v_match_price  bigint;
  v_trade_id     text;
  v_trades       jsonb := '[]'::jsonb;
begin
  -- اعتبارسنجی تریدر
  if not exists (select 1 from public.profiles where id = v_trader_id and role = 'trader' and active) then
    raise exception 'دسترسی مجاز نیست';
  end if;

  -- بازار
  select * into v_market from public.markets where id = p_market_id and active;
  if not found then raise exception 'بازار یافت نشد'; end if;

  -- محدوده‌ی لفظ
  if p_lafz < v_market.lafz_min or p_lafz > v_market.lafz_max then
    raise exception 'لفظ باید بین % و % باشد', v_market.lafz_min, v_market.lafz_max;
  end if;

  -- محاسبه‌ی قیمت
  v_price_toman := v_market.mazne_current + (p_lafz::bigint * v_market.lafz_scale);

  -- ثبت سفارش (kind از روی side تعیین می‌شود — اگر امروزی باشد و بعد از قفل ۱۳:۳۰ باشد بعداً تبدیل می‌شود)
  insert into public.orders
    (trader_id, market_id, side, lafz, price_toman, quantity, filled, remaining, settlement_date, status)
  values
    (v_trader_id, p_market_id, p_side, p_lafz, v_price_toman, p_quantity, 0, p_quantity, p_settlement_date, 'open'::order_status)
  returning * into v_new_order;

  v_order_id  := v_new_order.id;
  v_remaining := p_quantity;

  -- تطبیق: کاندیداها سفارش‌های طرف مقابل با قیمت مناسب — با OR صریح به‌جای CASE
  for v_candidate in
    select * from public.orders
    where market_id       = p_market_id
      and settlement_date = p_settlement_date
      and status          in ('open'::order_status, 'partial'::order_status)
      and trader_id       <> v_trader_id
      and (
        (p_side = 'buy'::order_side  and side = 'sell'::order_side and price_toman <= v_price_toman)
        or
        (p_side = 'sell'::order_side and side = 'buy'::order_side  and price_toman >= v_price_toman)
      )
    order by price_toman asc, placed_at asc
    for update skip locked
  loop
    exit when v_remaining = 0;

    v_match_qty   := least(v_remaining, v_candidate.remaining);
    v_match_price := least(v_new_order.price_toman, v_candidate.price_toman);

    -- ثبت معامله
    insert into public.trades
      (market_id, buyer_id, seller_id, buy_order_id, sell_order_id,
       quantity, price_toman, settlement_date)
    values (
      p_market_id,
      case when p_side = 'buy'::order_side  then v_trader_id    else v_candidate.trader_id end,
      case when p_side = 'sell'::order_side then v_trader_id    else v_candidate.trader_id end,
      case when p_side = 'buy'::order_side  then v_order_id     else v_candidate.id        end,
      case when p_side = 'sell'::order_side then v_order_id     else v_candidate.id        end,
      v_match_qty, v_match_price, p_settlement_date
    ) returning id into v_trade_id;

    v_trades := v_trades || jsonb_build_object(
      'trade_id', v_trade_id,
      'quantity', v_match_qty,
      'price',    v_match_price
    );

    -- به‌روزرسانی سفارش طرف مقابل
    update public.orders set
      filled    = filled + v_match_qty,
      remaining = remaining - v_match_qty,
      status    = case
        when remaining - v_match_qty = 0 then 'filled'::order_status
        else 'partial'::order_status
      end
    where id = v_candidate.id;

    v_remaining := v_remaining - v_match_qty;
  end loop;

  -- به‌روزرسانی سفارش جدید
  update public.orders set
    filled    = p_quantity - v_remaining,
    remaining = v_remaining,
    status    = case
      when v_remaining = 0              then 'filled'::order_status
      when p_quantity - v_remaining > 0 then 'partial'::order_status
      else 'open'::order_status
    end
  where id = v_order_id;

  return jsonb_build_object('order_id', v_order_id, 'trades', v_trades, 'remaining', v_remaining);
end;
$$;

-- ============================================================
-- 0005_room_mode_dynamic_rates.sql
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  Migration 0005 — Room mode (parry/margin), dynamic tether rate, owner override
--  Implements clarifications from آقا مهدی (2026-05-03):
--    1. Room can operate in 'parry' or 'margin' mode (per-market)
--    2. Margin mode uses two configurable thresholds: warn% / liquidate%
--    3. Tether rate is dynamic (updated by bot from latest trade)
--    4. Owner override on expired/oversold lafz (not auto-cancel)
--    5. Admin can cancel "لفظ پرت" (off-market) lafz
--    6. Lafz can be absolute price OR relative to mazne
--
--  NOTE: orders.id and markets.id are TEXT (not uuid) — see 0001_init.sql.
--  All foreign-key columns and RPC params reflect that.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Drop any stale overloads from earlier migration attempts ─────────────
-- (Without this, re-running with a different param signature leaves multiple
--  overloads in pg_proc and CREATE OR REPLACE fails with "name is not unique".)
do $$
declare
  r record;
begin
  for r in
    select 'drop function public.' || proname || '(' || pg_get_function_identity_arguments(oid) || ');' as cmd
    from pg_proc
    where proname in (
      'cancel_porat_lafz',
      'owner_override_baraka',
      'update_tether_rate',
      'apply_emergency_settlement'
    )
    and pg_function_is_visible(oid)
  loop
    execute r.cmd;
  end loop;
end $$;

-- ─── New enums ───────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'room_mode') then
    create type room_mode as enum ('parry', 'margin');
  end if;
end $$;

-- ─── markets: add room_mode + parry threshold ───────────────────────────────
alter table public.markets
  add column if not exists mode               room_mode  not null default 'margin',
  add column if not exists parry_threshold    integer    null,
  add column if not exists margin_warn_pct    integer    not null default 75,
  add column if not exists margin_liquidate_pct integer  not null default 85,
  add column if not exists tether_rate_today  numeric    null,
  add column if not exists tether_rate_tomorrow numeric  null;

comment on column public.markets.mode is
  'Operating mode: parry (circuit breaker at threshold) or margin (floating with warn/liq)';
comment on column public.markets.parry_threshold is
  'Toman delta from settlement price that triggers emergency settlement (parry mode only)';
comment on column public.markets.margin_warn_pct is
  'Warning threshold: when X% of deposit is in loss, bot warns trader (margin mode)';
comment on column public.markets.margin_liquidate_pct is
  'Liquidation threshold: when X% of deposit is in loss, bot force-closes (margin mode)';
comment on column public.markets.tether_rate_today is
  'Latest today-trade tether rate (toman per USDT); updated by bot on each today trade';
comment on column public.markets.tether_rate_tomorrow is
  'Latest tomorrow-trade tether rate; updated by bot on each tomorrow trade';

-- ─── orders: add fields for owner override + price kind + porat cancel ─────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'price_kind') then
    create type price_kind as enum ('relative', 'absolute');
  end if;
end $$;

alter table public.orders
  add column if not exists price_kind         price_kind   not null default 'relative',
  add column if not exists overridden_at      timestamptz  null,
  add column if not exists override_count     integer      not null default 0,
  add column if not exists is_porat           boolean      not null default false;

comment on column public.orders.price_kind is
  'relative: lafz is delta from mazne (in lafz_scale units). absolute: lafz is full toman price';
comment on column public.orders.overridden_at is
  'Set when owner accepts a باركت after TTL expiry or volume exhaustion (override flow)';
comment on column public.orders.is_porat is
  'Marked true when admin cancels as لفظ پرت (off-market price)';

-- ─── system_settings: clean up + add new keys ──────────────────────────────
delete from public.system_settings where key in (
  'margin_zone_safe',
  'margin_zone_warn',
  'margin_zone_risk',
  'default_tether_rate'
);

insert into public.system_settings (key, value) values
  ('absolute_price_threshold', '50000'),
  ('default_room_mode',        '"margin"'),
  ('default_parry_threshold',  '5000'),
  ('default_margin_warn_pct',  '75'),
  ('default_margin_liquidate_pct', '85')
on conflict (key) do nothing;

-- bump settlement_reverse_minutes 30 → 60 (per گودرزی, موقت تا تأیید نهایی مهدی)
update public.system_settings
   set value = '60', updated_at = now()
 where key = 'settlement_reverse_minutes' and value::text = '30';

-- ─── RPC: cancel_porat_lafz (admin can cancel off-market lafz) ─────────────
create or replace function public.cancel_porat_lafz(
  p_order_id text,
  p_reason   text default 'admin_porat'
)
returns json
language plpgsql
security definer
as $$
declare
  v_caller_role text;
  v_order public.orders%rowtype;
begin
  v_caller_role := public.current_role();
  if v_caller_role not in ('admin', 'accountant') then
    raise exception 'فقط ادمین یا حسابدار می‌تواند لفظ پرت را لغو کند';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'لفظ یافت نشد';
  end if;

  if v_order.status not in ('open', 'partial') then
    raise exception 'این لفظ در حالت قابل‌لغو نیست (status=%)', v_order.status;
  end if;

  update public.orders
     set status        = 'cancelled',
         is_porat      = true,
         cancelled_at  = now(),
         cancel_reason = p_reason
   where id = p_order_id;

  return json_build_object('ok', true, 'order_id', p_order_id);
end $$;

comment on function public.cancel_porat_lafz is
  'Admin/accountant cancel of an off-market (پرت) lafz with reason tracking';

-- ─── RPC: owner_override_baraka ────────────────────────────────────────────
create or replace function public.owner_override_baraka(
  p_order_id     text,
  p_buyer_id     uuid,
  p_seller_id    uuid,
  p_quantity     integer,
  p_price_toman  bigint,
  p_market_id    text
)
returns json
language plpgsql
security definer
as $$
declare
  v_order public.orders%rowtype;
  v_trade_id text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'لفظ یافت نشد';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'این لفظ لغو شده — override ممکن نیست';
  end if;

  update public.orders
     set overridden_at  = now(),
         override_count = override_count + 1,
         filled         = filled + p_quantity,
         remaining      = greatest(remaining - p_quantity, 0),
         status         = case
                            when remaining - p_quantity <= 0 then 'filled'
                            else 'partial'
                          end
   where id = p_order_id;

  insert into public.trades (
    market_id, buyer_id, seller_id,
    buy_order_id, sell_order_id,
    quantity, price_toman,
    settlement_date, kind, trade_type,
    manual, source, created_by, matched_at
  ) values (
    p_market_id, p_buyer_id, p_seller_id,
    case when v_order.side = 'buy'  then v_order.id else null end,
    case when v_order.side = 'sell' then v_order.id else null end,
    p_quantity, p_price_toman,
    v_order.settlement_date, v_order.kind, 'normal',
    false, 'bot', null, now()
  ) returning id into v_trade_id;

  return json_build_object('ok', true, 'trade_id', v_trade_id, 'override', true);
end $$;

comment on function public.owner_override_baraka is
  'Owner-initiated trade after lafz TTL expiry or volume exhaustion (مدل override مالک)';

-- ─── RPC: update_tether_rate (called by bot on each trade) ─────────────────
create or replace function public.update_tether_rate(
  p_market_id text,
  p_kind      text,
  p_rate      numeric
)
returns void
language plpgsql
security definer
as $$
begin
  if p_kind = 'today' then
    update public.markets set tether_rate_today = p_rate where id = p_market_id;
  elsif p_kind = 'tomorrow' then
    update public.markets set tether_rate_tomorrow = p_rate where id = p_market_id;
  else
    raise exception 'kind must be today or tomorrow';
  end if;
end $$;

comment on function public.update_tether_rate is
  'Bot writes the latest trade price as the dynamic tether rate (per kind)';

-- ─── RPC: apply_emergency_settlement (manual or parry-triggered) ───────────
-- Wraps apply_settlement(text,date,bigint,bigint) with audit + reason flag.
create or replace function public.apply_emergency_settlement(
  p_market_id      text,
  p_rate_toman     bigint,
  p_rate_tether    bigint,
  p_reason         text default 'manual'    -- 'manual' | 'parry_triggered'
)
returns json
language plpgsql
security definer
as $$
declare
  v_caller_role text;
  v_result      jsonb;
  v_settlement_id text;
  v_today date := current_date;
begin
  v_caller_role := public.current_role();
  if p_reason = 'manual' and v_caller_role <> 'admin' then
    raise exception 'فقط ادمین می‌تواند تصفیهٔ فوری دستی بزند';
  end if;

  -- apply_settlement signature: (text, date, bigint, bigint) returns jsonb
  v_result := public.apply_settlement(p_market_id, v_today, p_rate_toman, p_rate_tether);
  v_settlement_id := v_result->>'settlement_id';

  insert into public.audit_log (actor_id, actor_role, action, payload)
  values (
    auth.uid(),
    v_caller_role,
    'EMERGENCY_SETTLEMENT',
    json_build_object(
      'market_id',    p_market_id,
      'rate_toman',   p_rate_toman,
      'rate_tether',  p_rate_tether,
      'reason',       p_reason,
      'settlement_id', v_settlement_id
    )
  );

  return json_build_object('ok', true, 'settlement_id', v_settlement_id, 'reason', p_reason);
end $$;

comment on function public.apply_emergency_settlement is
  'Emergency settlement (manual by admin or auto-triggered by parry threshold breach)';

-- ─── Indexes for new fields ────────────────────────────────────────────────
create index if not exists idx_orders_overridden on public.orders(overridden_at) where overridden_at is not null;
create index if not exists idx_orders_porat      on public.orders(is_porat) where is_porat = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- END migration 0005
-- ═══════════════════════════════════════════════════════════════════════════

-- ============================================================
-- 0006_counter_offers_and_liquidation.sql
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  Migration 0006 — Counter-offer + Liquidation + Parry-breach helper
--    1. Counter-offer columns on orders (parent_order_id, proposed_by_user, …)
--    2. RPC liquidate_user_position — flag positions as liquidated
--    3. RPC check_parry_breach — returns true if last trade breached parry
--    4. compute_user_margin → switch to 2-threshold model (loss_percentage)
--
--  NOTE: orders.id and markets.id are TEXT (not uuid) — see 0001_init.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Drop any stale overloads from earlier migration attempts ─────────────
do $$
declare
  r record;
begin
  for r in
    select 'drop function public.' || proname || '(' || pg_get_function_identity_arguments(oid) || ');' as cmd
    from pg_proc
    where proname in (
      'liquidate_user_position',
      'check_parry_breach'
    )
    and pg_function_is_visible(oid)
  loop
    execute r.cmd;
  end loop;
end $$;

-- ─── Counter-offer columns ───────────────────────────────────────────────
alter table public.orders
  add column if not exists parent_order_id   text          null references public.orders(id),
  add column if not exists proposed_by_user  uuid          null references public.profiles(id),
  add column if not exists is_counter_offer  boolean       not null default false;

create index if not exists idx_orders_parent on public.orders(parent_order_id) where parent_order_id is not null;

comment on column public.orders.parent_order_id is
  'When set, this order is a counter-offer (چونه) on parent_order_id';
comment on column public.orders.proposed_by_user is
  'For counter-offers: the user who proposed the alternative price';

-- ─── trades: liquidation columns ─────────────────────────────────────────
alter table public.trades
  add column if not exists liquidated_at    timestamptz null,
  add column if not exists liquidate_reason text        null;

create index if not exists idx_trades_liquidated on public.trades(liquidated_at) where liquidated_at is not null;

-- ─── RPC: liquidate_user_position ────────────────────────────────────────
-- Flags every open trade of a user in a market as liquidated. Does NOT auto-close
-- (since this is a P2P verbal market — actual closing requires admin intervention).
create or replace function public.liquidate_user_position(
  p_user_id   uuid,
  p_market_id text,
  p_reason    text default 'auto_margin_call'
)
returns json
language plpgsql
security definer
as $$
declare
  v_count integer := 0;
begin
  update public.trades
     set liquidated_at  = now(),
         liquidate_reason = p_reason
   where market_id = p_market_id
     and settled = false
     and liquidated_at is null
     and (buyer_id = p_user_id or seller_id = p_user_id);
  get diagnostics v_count = row_count;

  insert into public.audit_log (actor_id, actor_role, action, payload)
  values (
    coalesce(auth.uid(), p_user_id),
    'admin',
    'AUTO_LIQUIDATE',
    json_build_object('user_id', p_user_id, 'market_id', p_market_id, 'reason', p_reason, 'trades_flagged', v_count)
  );

  return json_build_object('ok', true, 'trades_flagged', v_count);
end $$;

-- ─── RPC: check_parry_breach ─────────────────────────────────────────────
create or replace function public.check_parry_breach(
  p_market_id   text,
  p_trade_price numeric
)
returns json
language plpgsql
security definer
as $$
declare
  v_market         public.markets;
  v_last_settle    public.settlements;
  v_threshold      numeric;
  v_breach         boolean := false;
  v_breach_side    text    := null;
begin
  select * into v_market from public.markets where id = p_market_id;
  if not found or v_market.mode <> 'parry' then
    return json_build_object('breach', false, 'reason', 'not_parry_mode');
  end if;

  v_threshold := coalesce(v_market.parry_threshold, 0);
  if v_threshold <= 0 then
    return json_build_object('breach', false, 'reason', 'no_threshold');
  end if;

  select * into v_last_settle
    from public.settlements
   where market_id = p_market_id
     and reversed_at is null
   order by applied_at desc
   limit 1;

  if not found then
    return json_build_object('breach', false, 'reason', 'no_settlement');
  end if;

  if p_trade_price >= v_last_settle.rate_toman + v_threshold then
    v_breach := true;
    v_breach_side := 'up';
  elsif p_trade_price <= v_last_settle.rate_toman - v_threshold then
    v_breach := true;
    v_breach_side := 'down';
  end if;

  return json_build_object(
    'breach',          v_breach,
    'side',            v_breach_side,
    'settlement_rate', v_last_settle.rate_toman,
    'threshold',       v_threshold,
    'trade_price',     p_trade_price
  );
end $$;

-- ─── compute_user_margin: switch to 2-threshold model (loss-based) ───────
-- Old: zone in (safe/warn/risk/call) based on `available/required` percentage.
-- New: zone in (safe/warn/call) based on loss percentage with per-market thresholds.
create or replace function public.compute_user_margin(
  p_user_id       uuid,
  p_market_id     text,
  p_current_price bigint,
  p_tether_rate   bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile        public.profiles;
  v_market         public.markets;
  v_open_units     integer := 0;
  v_floating_toman bigint  := 0;
  v_floating_tether numeric;
  v_required       numeric;
  v_available      numeric;
  v_loss_pct       numeric;
  v_zone           text;
  v_warn_pct       integer;
  v_liq_pct        integer;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  select * into v_market  from public.markets  where id = p_market_id;

  v_warn_pct := coalesce(v_market.margin_warn_pct, 75);
  v_liq_pct  := coalesce(v_market.margin_liquidate_pct, 85);

  -- Sum open positions (exclude already liquidated)
  select
    coalesce(sum(t.quantity), 0),
    coalesce(sum(
      case
        when t.buyer_id = p_user_id  then (p_current_price - t.price_toman) * t.quantity
        when t.seller_id = p_user_id then (t.price_toman - p_current_price) * t.quantity
        else 0
      end
    ), 0)
  into v_open_units, v_floating_toman
  from public.trades t
  where t.market_id = p_market_id
    and t.settled = false
    and t.liquidated_at is null
    and (t.buyer_id = p_user_id or t.seller_id = p_user_id);

  v_required       := v_open_units * coalesce(v_profile.per_unit_deposit, 0);
  v_floating_tether := case when p_tether_rate > 0 then v_floating_toman::numeric / p_tether_rate else 0 end;
  v_available      := coalesce(v_profile.deposit_tether, 0) + v_floating_tether;

  v_loss_pct := case
    when v_required = 0 then 0
    else greatest(0, ((v_required - v_available) / v_required) * 100)
  end;

  v_zone := case
    when v_loss_pct >= v_liq_pct  then 'call'
    when v_loss_pct >= v_warn_pct then 'warn'
    else 'safe'
  end;

  return jsonb_build_object(
    'required_tether',     v_required,
    'available_tether',    v_available,
    'floating_pnl_tether', v_floating_tether,
    'loss_percentage',     round(v_loss_pct, 2),
    'percentage',          round(100 - v_loss_pct, 2),  -- legacy compat
    'zone',                v_zone,
    'warn_pct',            v_warn_pct,
    'liq_pct',             v_liq_pct
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- END migration 0006
-- ═══════════════════════════════════════════════════════════════════════════

-- ============================================================
-- 0007_holidays_and_liquidation_tolerance.sql
-- ============================================================

-- ════════════════════════════════════════════════════════════════
--  Migration 0007 — Holiday calendar + liquidation tolerance
--  Source: گودرزی dor 2 (2026-05-05)
--   - holidays table: مدیر تعطیلات را در پنل ست می‌کند
--   - next_business_day(date) → اولین روز کاری بعدی (skip جمعه + holidays)
--   - markets.liquidation_tolerance_toman: تلرانس قیمت حراج بات
--   - markets.parry_settlement_price: عدد تصفیهٔ آخر برای محاسبهٔ پری
-- ════════════════════════════════════════════════════════════════

-- ─── Drop stale overloads (idempotency) ─────────────────────────
do $$
declare r record;
begin
  for r in
    select 'drop function public.' || proname || '(' || pg_get_function_identity_arguments(oid) || ');' as cmd
    from pg_proc
    where proname in ('next_business_day', 'is_holiday', 'shift_settlements_for_holiday')
    and pg_function_is_visible(oid)
  loop execute r.cmd; end loop;
end $$;

-- ─── Holidays table ─────────────────────────────────────────────
create table if not exists public.holidays (
  date          date primary key,
  description   text not null default '',
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id)
);

comment on table public.holidays is
  'تاریخ‌هایی که بازار تعطیل است. جمعه‌ها به‌صورت پیش‌فرض تعطیل (در next_business_day چک می‌شود)، و این جدول برای تعطیلات اضافی است.';

alter table public.holidays enable row level security;

drop policy if exists holidays_admin_all on public.holidays;
create policy holidays_admin_all on public.holidays
  for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── is_holiday(date) ───────────────────────────────────────────
create or replace function public.is_holiday(p_date date)
returns boolean
language sql
stable
as $$
  -- جمعه = ۶ در iso (1=monday, 7=sunday) — ولی postgres extract(dow) می‌دهد 0=یکشنبه..6=شنبه
  -- در ایران جمعه = 5 از extract(dow). ولی برای اطمینان از calendar دستی استفاده می‌کنیم.
  select extract(dow from p_date) = 5
      or exists(select 1 from public.holidays where date = p_date);
$$;

-- ─── next_business_day(date) ────────────────────────────────────
create or replace function public.next_business_day(p_date date)
returns date
language plpgsql
stable
as $$
declare
  d date := p_date;
begin
  loop
    d := d + 1;
    if not public.is_holiday(d) then
      return d;
    end if;
    -- safety: اگر بیش از ۳۰ روز پیدا نکرد (کل ماه تعطیل!) خارج شو
    if d > p_date + 30 then return d; end if;
  end loop;
end;
$$;

-- ─── shift_settlements_for_holiday ──────────────────────────────
-- وقتی روزی به holidays اضافه شود، تمام orders/trades که settlement_date آنها
-- روی آن روز است را به روز کاری بعدی منتقل کن.
create or replace function public.shift_settlements_for_holiday(p_date date)
returns table(orders_shifted int, trades_shifted int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next date := next_business_day(p_date);
  v_orders int;
  v_trades int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'فقط ادمین می‌تواند تاریخ‌های تصفیه را شیفت دهد';
  end if;

  update public.orders set settlement_date = v_next where settlement_date = p_date;
  get diagnostics v_orders = row_count;

  update public.trades set settlement_date = v_next where settlement_date = p_date;
  get diagnostics v_trades = row_count;

  return query select v_orders, v_trades;
end;
$$;

grant execute on function public.shift_settlements_for_holiday(date) to authenticated;
grant execute on function public.is_holiday(date) to authenticated;
grant execute on function public.next_business_day(date) to authenticated;

-- ─── Markets: liquidation tolerance + parry settlement price ────
alter table public.markets
  add column if not exists liquidation_tolerance_toman bigint not null default 200,
  add column if not exists parry_settlement_price bigint;

comment on column public.markets.liquidation_tolerance_toman is
  'تلرانس قیمت حراج بات (تومن). وقتی کاربر مارجین می‌شود، بات سفارش حراج را با این مقدار آفست از قیمت محاسبه‌شده می‌گذارد تا سریع پر شود.';

comment on column public.markets.parry_settlement_price is
  'عدد تصفیهٔ آخر اتاق برای محاسبهٔ پری. هر بار تصفیهٔ روزانه/فوری اعمال شود این به‌روز می‌شود. اگر null، آستانهٔ پری از mazne_current حساب می‌شود (legacy).';

-- ============================================================
-- 0008_credit_user_and_margin_disable.sql
-- ============================================================

-- ════════════════════════════════════════════════════════════════
--  Migration 0008 — Credit user + margin-call disable per profile
--  Source: گودرزی dor 3 (2026-05-07)
--   - profiles.is_credit_user      : کاربر بدون واریز فیزیکی
--   - profiles.credit_units        : تعداد واحد اعتبار (وقتی credit user است)
--   - profiles.margin_call_disabled: مدیر می‌تواند حراج خودکار را برای فرد خاص خاموش کند
--   - compute_user_margin: تطبیق با کاربر اعتباری (deposit = credit_units × per_unit_deposit)
-- ════════════════════════════════════════════════════════════════

-- ─── Drop stale overloads (idempotency) ─────────────────────────
do $$
declare r record;
begin
  for r in
    select 'drop function public.' || proname || '(' || pg_get_function_identity_arguments(oid) || ');' as cmd
    from pg_proc
    where proname in ('compute_user_margin')
    and pg_function_is_visible(oid)
  loop execute r.cmd; end loop;
end $$;

-- ─── Add new profile columns ────────────────────────────────────
alter table public.profiles
  add column if not exists is_credit_user        boolean not null default false,
  add column if not exists credit_units          integer null,
  add column if not exists margin_call_disabled  boolean not null default false;

comment on column public.profiles.is_credit_user is
  'کاربر اعتباری — بدون واریز فیزیکی، اعتبارش از credit_units × per_unit_deposit حساب می‌شود.';
comment on column public.profiles.credit_units is
  'تعداد واحد اعتبار. فقط وقتی is_credit_user=true معتبر است.';
comment on column public.profiles.margin_call_disabled is
  'اگر true باشد، بات روی این کاربر حراج خودکار نمی‌زند (با اعتبارسنجی مدیر).';

-- ─── Updated compute_user_margin with credit-user support ───────
create or replace function public.compute_user_margin(
  p_user_id       uuid,
  p_market_id     text,
  p_current_price bigint,
  p_tether_rate   bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile         public.profiles;
  v_market          public.markets;
  v_open_units      integer := 0;
  v_floating_toman  bigint  := 0;
  v_floating_tether numeric;
  v_deposit_base    numeric;
  v_required        numeric;
  v_available       numeric;
  v_loss_pct        numeric;
  v_zone            text;
  v_warn_pct        integer;
  v_liq_pct         integer;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  select * into v_market  from public.markets  where id = p_market_id;

  v_warn_pct := coalesce(v_market.margin_warn_pct, 75);
  v_liq_pct  := coalesce(v_market.margin_liquidate_pct, 85);

  -- Sum open positions (exclude already liquidated)
  select
    coalesce(sum(t.quantity), 0),
    coalesce(sum(
      case
        when t.buyer_id = p_user_id  then (p_current_price - t.price_toman) * t.quantity
        when t.seller_id = p_user_id then (t.price_toman - p_current_price) * t.quantity
        else 0
      end
    ), 0)
  into v_open_units, v_floating_toman
  from public.trades t
  where t.market_id = p_market_id
    and t.settled = false
    and t.liquidated_at is null
    and (t.buyer_id = p_user_id or t.seller_id = p_user_id);

  v_required        := v_open_units * coalesce(v_profile.per_unit_deposit, 0);
  v_floating_tether := case when p_tether_rate > 0 then v_floating_toman::numeric / p_tether_rate else 0 end;

  -- محاسبهٔ ودیعه پایه: کاربر اعتباری → credit_units × per_unit_deposit؛ وگرنه deposit_tether.
  if v_profile.is_credit_user then
    v_deposit_base := coalesce(v_profile.credit_units, 0) * coalesce(v_profile.per_unit_deposit, 0);
  else
    v_deposit_base := coalesce(v_profile.deposit_tether, 0);
  end if;

  v_available := v_deposit_base + v_floating_tether;

  v_loss_pct := case
    when v_required = 0 then 0
    else greatest(0, ((v_required - v_available) / v_required) * 100)
  end;

  -- اگر margin_call_disabled است، zone را به 'call' نمی‌رسانیم تا بات حراج نزند.
  -- ولی هشدار warn همچنان داده می‌شود تا مدیر اطلاع داشته باشد.
  v_zone := case
    when v_loss_pct >= v_liq_pct  then case when v_profile.margin_call_disabled then 'warn' else 'call' end
    when v_loss_pct >= v_warn_pct then 'warn'
    else 'safe'
  end;

  return jsonb_build_object(
    'required_tether',      v_required,
    'available_tether',     v_available,
    'floating_pnl_tether',  v_floating_tether,
    'loss_percentage',      round(v_loss_pct, 2),
    'percentage',           round(100 - v_loss_pct, 2),  -- legacy compat
    'zone',                 v_zone,
    'warn_pct',             v_warn_pct,
    'liq_pct',              v_liq_pct,
    'margin_call_disabled', coalesce(v_profile.margin_call_disabled, false),
    'is_credit_user',       coalesce(v_profile.is_credit_user, false)
  );
end;
$$;

grant execute on function public.compute_user_margin(uuid, text, bigint, bigint) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- END migration 0008
-- ════════════════════════════════════════════════════════════════

-- ============================================================
-- 0009_bulk_update_all_fields.sql
-- ============================================================

-- ════════════════════════════════════════════════════════════════
--  Migration 0009 — Extend bulk_update_traders to all profile fields
--  Source: مهدی dor 4 (2026-05-07): «ویرایش تکی و گروهی برای همه چیز»
--   - افزودن همهٔ فیلدهای قابل ویرایش گروهی (نه balance، نه identity)
--   - پشتیبانی از انتخاب per-id (لیست user_ids) به‌جای فقط group_id
-- ════════════════════════════════════════════════════════════════

do $$
declare r record;
begin
  for r in
    select 'drop function public.' || proname || '(' || pg_get_function_identity_arguments(oid) || ');' as cmd
    from pg_proc
    where proname in ('bulk_update_traders')
    and pg_function_is_visible(oid)
  loop execute r.cmd; end loop;
end $$;

create or replace function public.bulk_update_traders(
  p_user_ids               uuid[]   default null,   -- اولویت با این. null یعنی از target_group_id استفاده شود
  p_target_group_id        text     default null,   -- اگر user_ids=null و این هم null → همهٔ تریدرها
  p_per_unit_deposit       numeric  default null,
  p_commission_per_unit    bigint   default null,
  p_max_open_units         integer  default null,
  p_member_group_id        text     default null,
  p_referrer_id            uuid     default null,
  p_referral_bonus_pct     numeric  default null,
  p_active                 boolean  default null,
  p_is_credit_user         boolean  default null,
  p_credit_units           integer  default null,
  p_margin_call_disabled   boolean  default null
) returns integer language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'فقط ادمین می‌تواند اعمال گروهی انجام دهد';
  end if;

  update public.profiles set
    per_unit_deposit       = coalesce(p_per_unit_deposit,     per_unit_deposit),
    commission_per_unit    = coalesce(p_commission_per_unit,  commission_per_unit),
    max_open_units         = coalesce(p_max_open_units,       max_open_units),
    member_group_id        = coalesce(p_member_group_id,      member_group_id),
    referrer_id            = coalesce(p_referrer_id,          referrer_id),
    referral_bonus_pct     = coalesce(p_referral_bonus_pct,   referral_bonus_pct),
    active                 = coalesce(p_active,               active),
    is_credit_user         = coalesce(p_is_credit_user,       is_credit_user),
    credit_units           = coalesce(p_credit_units,         credit_units),
    margin_call_disabled   = coalesce(p_margin_call_disabled, margin_call_disabled)
  where role = 'trader'
    and (
      (p_user_ids is not null and id = any(p_user_ids))
      or (p_user_ids is null and (p_target_group_id is null or member_group_id = p_target_group_id))
    );

  get diagnostics v_count = row_count;

  perform public.append_audit_log(v_actor, 'admin', 'TRADERS_BULK_UPDATED',
    jsonb_build_object(
      'user_ids',             p_user_ids,
      'target_group_id',      p_target_group_id,
      'per_unit_deposit',     p_per_unit_deposit,
      'commission_per_unit',  p_commission_per_unit,
      'max_open_units',       p_max_open_units,
      'member_group_id',      p_member_group_id,
      'referrer_id',          p_referrer_id,
      'referral_bonus_pct',   p_referral_bonus_pct,
      'active',               p_active,
      'is_credit_user',       p_is_credit_user,
      'credit_units',         p_credit_units,
      'margin_call_disabled', p_margin_call_disabled,
      'count',                v_count
    ));

  return v_count;
end;
$$;

grant execute on function public.bulk_update_traders(
  uuid[], text, numeric, bigint, integer, text, uuid, numeric, boolean, boolean, integer, boolean
) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- END migration 0009
-- ════════════════════════════════════════════════════════════════

-- ============================================================
-- 0010_room_announcements_and_aliases.sql
-- ============================================================

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

-- ============================================================
-- 0011_telegram_registration.sql
-- ============================================================

-- ════════════════════════════════════════════════════════════════
--  Migration 0011 — ثبت‌نام از تلگرام
--
--  تصمیم کارفرما (۲۰۲۶-۰۹-۲۲): کاربر عادی هرگز وارد سایت نمی‌شود.
--  ثبت‌نام کامل در بات تلگرام انجام می‌شود و پنل فقط داشبورد مدیریتی
--  می‌ماند.
--
--  ترتیب مراحل عیناً از بات «موج تهران» برداشته شده (رونوشت گفت‌وگوی
--  واقعی، ۱۲ شهریور ۱۴۰۵):
--    قوانین + دکمهٔ «ارسال شماره» → نام کوچک → نام خانوادگی → نام مستعار
--  فرستادن شماره یعنی «قوانین را پذیرفتم» — دکمهٔ جدا برای پذیرش ندارد.
--
--  گلوگاه فنی: profiles.id به auth.users گره خورده، پس بات نمی‌تواند
--  مستقیم profile بسازد. راه‌حل: بات با service-role و Admin API یک
--  auth user با ایمیل ساختگی (tg<telegram_id>@telegram.local) می‌سازد،
--  تریگر handle_new_user پروفایل غیرفعال را درست می‌کند، و بعد
--  approve_registration آن را فعال می‌کند. رمز تصادفی است و به کسی
--  داده نمی‌شود چون قرار نیست وارد سایت شود.
--
--  چرا auth user فقط سر تأیید ساخته می‌شود و نه سر /start: وگرنه هر
--  رهگذری که بات را استارت کند یک ردیف در auth.users می‌سازد و فهرست
--  کاربران پنل پر از آشغال می‌شود.
--
--   ۱) profiles.member_code — «کد» عضویت که در پیام تأیید می‌آید
--   ۲) registration_requests — صندوق ورودی درخواست‌ها
--   ۳) approve_registration / reject_registration
--   ۴) کلیدهای جدید system_settings
-- ════════════════════════════════════════════════════════════════

-- ─── ۱) کد عضویت ────────────────────────────────────────────────
-- موج تهران در پیام تأیید «🔶 کد: ۵۶» می‌دهد؛ یک شمارهٔ کوتاه و پشت‌سرهم
-- که حسابداری و پشتیبانی با آن کاربر را صدا می‌زنند (uuid به درد گفتن
-- در تلفن نمی‌خورد).
create sequence if not exists public.profiles_member_code_seq start 1;

-- default فرّار است، پس PostgreSQL موقع افزودن ستون برای هر ردیف
-- موجود هم یک عدد می‌گیرد — یعنی کاربران فعلی خودکار کد می‌گیرند.
alter table public.profiles
  add column if not exists member_code integer not null
    default nextval('public.profiles_member_code_seq');

comment on column public.profiles.member_code is
  'کد کوتاه عضویت — در پیام تأیید تلگرام و ارجاع‌های حسابداری استفاده می‌شود.';

create unique index if not exists profiles_member_code_key
  on public.profiles (member_code);

-- ─── ۲) صندوق ورودی ─────────────────────────────────────────────
create table if not exists public.registration_requests (
  id                text primary key default gen_random_uuid()::text,

  -- یکتا: هر آیدی تلگرام فقط یک درخواست دارد. ثبت‌نام دوباره بعد از
  -- رد شدن، همین ردیف را بازنویسی می‌کند.
  telegram_id       bigint not null unique,
  telegram_username text,

  phone             text,
  first_name        text,
  last_name         text,
  alias             text,
  full_name         text,          -- first + last، همان چیزی که در profile می‌نشیند
  referrer_id       uuid references public.profiles(id),

  status            text not null default 'awaiting_phone'
                    check (status in (
                      'awaiting_phone', 'awaiting_first_name', 'awaiting_last_name',
                      'awaiting_alias', 'submitted', 'approved', 'rejected'
                    )),
  reject_reason     text,

  -- پروفایلی که بعد از تأیید ساخته شد
  profile_id        uuid references public.profiles(id),

  -- کارت‌هایی که برای ادمین‌ها فرستاده شده — [{"chat_id":…,"message_id":…}]
  -- تا بعد از تصمیم همه‌شان ویرایش شوند و دکمه‌ها برداشته شوند.
  admin_msgs        jsonb not null default '[]'::jsonb,

  -- صندوق خروجی برای تصمیمی که از **پنل** گرفته می‌شود.
  -- پنل نمی‌تواند خودش حساب بسازد: ساخت auth user کلید service-role
  -- می‌خواهد و آن هرگز به مرورگر نمی‌رود. پس پنل فقط تصمیم را صف
  -- می‌کند و بات (که کلید را دارد) اجرایش می‌کند — همان الگوی
  -- bot_announcements. دستاورد جانبی: مسیر اطلاع‌رسانی به متقاضی و
  -- بستن کارت‌های تلگرام یکی می‌ماند، از هر جا که تصمیم گرفته شود.
  bot_action        text check (bot_action in ('approve', 'reject')),
  bot_action_by     uuid references public.profiles(id),
  bot_action_error  text,

  decided_by        uuid references public.profiles(id),
  decided_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.registration_requests is
  'درخواست‌های عضویت از بات تلگرام. تأیید با ادمین است — چه از تلگرام، چه از پنل.';

create index if not exists registration_requests_status_idx
  on public.registration_requests (status, created_at desc);

drop trigger if exists registration_requests_updated_at on public.registration_requests;
create trigger registration_requests_updated_at before update on public.registration_requests
  for each row execute function update_updated_at();

-- ─── ۳) تأیید درخواست ───────────────────────────────────────────
--
-- بات پیش از صدا زدن این تابع، auth user و پروفایل غیرفعال را ساخته و
-- شناسه‌اش را در p_profile_id می‌دهد.
--
-- p_actor_id برای بات است که auth.uid() ندارد؛ از پنل خالی می‌ماند و
-- از auth.uid() خوانده می‌شود. در هر دو حالت نقش actor دوباره از روی
-- دیتابیس اعتبارسنجی می‌شود — به بات اعتماد نمی‌کنیم.
create or replace function public.approve_registration(
  p_request_id       text,
  p_profile_id       uuid,
  p_actor_id         uuid    default null,
  p_deposit          numeric default null,
  p_per_unit_deposit numeric default null,
  p_commission       bigint  default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_actor_role user_role;
  v_actor_active boolean;
  v_req public.registration_requests;
  v_profile public.profiles;
begin
  select role, active into v_actor_role, v_actor_active
  from public.profiles where id = v_actor;

  if v_actor_role is distinct from 'admin' or not coalesce(v_actor_active, false) then
    raise exception 'فقط ادمین فعال می‌تواند عضویت را تأیید کند';
  end if;

  select * into v_req from public.registration_requests
  where id = p_request_id for update;

  if v_req.id is null then raise exception 'درخواست یافت نشد'; end if;
  if v_req.status <> 'submitted' then
    raise exception 'این درخواست در وضعیت «%» است و قابل تأیید نیست', v_req.status;
  end if;

  update public.profiles set
    full_name           = coalesce(v_req.full_name, full_name),
    phone               = coalesce(v_req.phone, phone),
    alias               = coalesce(v_req.alias, alias),
    telegram_id         = v_req.telegram_id::text,
    referrer_id         = coalesce(v_req.referrer_id, referrer_id),
    active              = true,
    role                = 'trader',
    deposit_tether      = coalesce(p_deposit, deposit_tether, 0),
    per_unit_deposit    = coalesce(p_per_unit_deposit, per_unit_deposit, 500),
    commission_per_unit = coalesce(p_commission, commission_per_unit, 50000),
    approved_by         = v_actor,
    approved_at         = now()
  where id = p_profile_id
  returning * into v_profile;

  if v_profile.id is null then raise exception 'پروفایل یافت نشد'; end if;

  update public.registration_requests set
    status     = 'approved',
    profile_id = p_profile_id,
    decided_by = v_actor,
    decided_at = now()
  where id = p_request_id;

  insert into public.notifications (user_id, type, title, body)
  values (p_profile_id, 'account_approved', 'حساب شما تأیید شد',
          'عضویت شما در اتاق تأیید شد. حالا می‌توانید در گروه لفظ بزنید.');

  perform public.append_audit_log(v_actor, 'admin', 'REGISTRATION_APPROVED',
    jsonb_build_object(
      'request_id',  p_request_id,
      'profile_id',  p_profile_id,
      'telegram_id', v_req.telegram_id,
      'full_name',   v_req.full_name
    ));

  -- بات از همین خروجی پیام «✅ عضویت شما تایید شد» را می‌سازد.
  return jsonb_build_object(
    'profile_id',       p_profile_id,
    'telegram_id',      v_req.telegram_id,
    'member_code',      v_profile.member_code,
    'full_name',        v_profile.full_name,
    'alias',            v_profile.alias,
    'deposit_tether',   v_profile.deposit_tether,
    'per_unit_deposit', v_profile.per_unit_deposit
  );
end;
$$;

-- ─── رد درخواست ─────────────────────────────────────────────────
create or replace function public.reject_registration(
  p_request_id text,
  p_reason     text default null,
  p_actor_id   uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_actor_role user_role;
  v_actor_active boolean;
  v_req public.registration_requests;
begin
  select role, active into v_actor_role, v_actor_active
  from public.profiles where id = v_actor;

  if v_actor_role is distinct from 'admin' or not coalesce(v_actor_active, false) then
    raise exception 'فقط ادمین فعال می‌تواند عضویت را رد کند';
  end if;

  select * into v_req from public.registration_requests
  where id = p_request_id for update;

  if v_req.id is null then raise exception 'درخواست یافت نشد'; end if;
  if v_req.status <> 'submitted' then
    raise exception 'این درخواست در وضعیت «%» است و قابل رد کردن نیست', v_req.status;
  end if;

  update public.registration_requests set
    status        = 'rejected',
    reject_reason = p_reason,
    decided_by    = v_actor,
    decided_at    = now()
  where id = p_request_id;

  perform public.append_audit_log(v_actor, 'admin', 'REGISTRATION_REJECTED',
    jsonb_build_object(
      'request_id',  p_request_id,
      'telegram_id', v_req.telegram_id,
      'reason',      p_reason
    ));

  return jsonb_build_object('telegram_id', v_req.telegram_id, 'full_name', v_req.full_name);
end;
$$;

-- ─── صف تصمیم از پنل ────────────────────────────────────────────
-- پنل این را صدا می‌زند؛ بات هر ۲۰ ثانیه صف را خالی می‌کند.
create or replace function public.queue_registration_decision(
  p_request_id text,
  p_action     text,
  p_reason     text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role user_role;
  v_actor_active boolean;
  v_status text;
begin
  if p_action not in ('approve', 'reject') then
    raise exception 'عملیات نامعتبر است';
  end if;

  select role, active into v_actor_role, v_actor_active
  from public.profiles where id = v_actor;

  if v_actor_role is distinct from 'admin' or not coalesce(v_actor_active, false) then
    raise exception 'فقط ادمین فعال می‌تواند تصمیم بگیرد';
  end if;

  select status into v_status from public.registration_requests where id = p_request_id;
  if v_status is null then raise exception 'درخواست یافت نشد'; end if;
  if v_status <> 'submitted' then
    raise exception 'این درخواست در وضعیت «%» است', v_status;
  end if;

  update public.registration_requests set
    bot_action       = p_action,
    bot_action_by    = v_actor,
    bot_action_error = null,
    reject_reason    = case when p_action = 'reject' then p_reason else reject_reason end
  where id = p_request_id;
end;
$$;

-- ─── ۴) تنظیمات ─────────────────────────────────────────────────
insert into public.system_settings (key, value) values
  -- کلید اصلی ثبت‌نام تلگرامی. پیش‌فرض روشن، چون حالا تنها راه ورود است.
  ('telegram_signup_enabled', 'true'),
  -- نام مستعار را هم بپرسد؟ (موج تهران می‌پرسد و در سند معامله نشان می‌دهد)
  ('signup_ask_alias',        'true'),
  -- متن قوانینی که پیش از ثبت‌نام فرستاده می‌شود. خالی = بات خودش از
  -- روی تنظیمات زندهٔ اتاق می‌سازد (ساعت کاری، بیعانه، کمیسیون، آستانه‌ها).
  ('room_rules_text',         '""'),
  -- یک خط دربارهٔ ساعت کاری حسابداری، در پیام تأیید عضویت.
  ('accounting_hours_text',   '""')
on conflict (key) do nothing;

-- ─── RLS ────────────────────────────────────────────────────────
alter table public.registration_requests enable row level security;

-- بات با service-role کار می‌کند و RLS را دور می‌زند؛ این سیاست‌ها
-- فقط برای پنل‌اند.
drop policy if exists "registration_requests: staff read"  on public.registration_requests;
drop policy if exists "registration_requests: admin write" on public.registration_requests;

create policy "registration_requests: staff read"
  on public.registration_requests for select
  using (public.current_role() in ('admin', 'accountant'));

create policy "registration_requests: admin write"
  on public.registration_requests for update
  using (public.current_role() = 'admin');

-- ============================================================
-- 0012_commission_tether_and_qty_limits.sql
-- ============================================================

-- ════════════════════════════════════════════════════════════════
--  Migration 0012 — کمیسیون تتری + سقف حجم لفظ
--
--  تصمیم کارفرما (۲۰۲۶-۰۹-۲۲)، از روی قوانین واقعی «موج تهران»:
--
--   ۱) «کمیسیون معاملات در هر سر خرید یا فروش به ازای هر واحد یک تتر
--      می‌باشد» — تا حالا `commission_per_unit` یک bigint تومانی بود و
--      پنل هم «تومان» لیبل می‌زد. حالا numeric تتری با پیش‌فرض ۱.
--
--   ۲) «کف حجم در هر لفظ ۱ واحد و سقف ۳۰ واحد» — تا حالا ۱ تا ۱۰ در
--      `handlers.ts` هاردکد بود. حالا per-market و قابل تنظیم از پنل.
--
--  چرا حالا بی‌خطر است: `trades`، `orders`، `settlements` و `profiles`
--  همگی خالی‌اند (دیتابیس تازه ساخته شده)، پس تغییر نوع ستون هیچ دادهٔ
--  پولی را جابه‌جا نمی‌کند.
--
--  ⚠️ باگی که همین‌جا درست شد: در `apply_settlement` کمیسیون از سود
--  تومانی کم و بعد کل بر نرخ تتر تقسیم می‌شد. حالا که کمیسیون خودش تتری
--  است، آن تقسیم یعنی **دو بار تبدیل**. فرمول درست:
--        ودیعه += (سود تومانی ÷ نرخ تتر) − کمیسیون تتری
--  پاداش رفرال هم دیگر تقسیم نمی‌شود چون از کمیسیونِ تتری می‌آید.
--
--  ⚠️ دو باگ دیگر در `get_settlement_preview` که چون داشت بازنویسی
--  می‌شد درست شد:
--    • `count(t.id)` تعداد **معامله** را می‌شمرد نه **واحد**؛ یعنی یک
--      معاملهٔ ۱۰ واحدی، ۱ واحد حساب می‌شد و بیعانهٔ لازم ۱۰ برابر کمتر
--      از واقعیت درمی‌آمد.
--    • ناحیه‌ها روی مدل ۴-رنگ قدیمی (۸۵/۷۰/۵۰) مانده بودند که کنار
--      گذاشته شده؛ حالا دقیقاً مثل `compute_user_margin` حساب می‌شوند تا
--      پنل و بات یک عدد بگویند.
-- ════════════════════════════════════════════════════════════════

-- ─── حذف امضاهای قدیمی ──────────────────────────────────────────
-- تغییر نوع پارامتر یک overload تازه می‌سازد، جای قبلی را نمی‌گیرد.
do $$
declare r record;
begin
  for r in
    select 'drop function if exists public.' || p.proname
           || '(' || pg_get_function_identity_arguments(p.oid) || ');' as cmd
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'approve_user', 'approve_trader', 'bulk_update_traders',
        'approve_registration', 'apply_settlement', 'get_settlement_preview'
      )
  loop execute r.cmd; end loop;
end $$;

-- ─── ۱) سقف و کف حجم لفظ، per-market ────────────────────────────
alter table public.markets
  add column if not exists min_qty integer not null default 1,
  add column if not exists max_qty integer not null default 30;

comment on column public.markets.min_qty is 'کف حجم هر لفظ (واحد).';
comment on column public.markets.max_qty is 'سقف حجم هر لفظ (واحد) — موج تهران: ۳۰.';

alter table public.markets
  drop constraint if exists markets_qty_range_check;
alter table public.markets
  add constraint markets_qty_range_check check (min_qty >= 1 and max_qty >= min_qty);

-- بازارهای موجود هم به قاعدهٔ تازه بیایند
update public.markets set min_qty = 1, max_qty = 30 where max_qty is null or max_qty = 0;

-- ─── ۲) کمیسیون: تومان → تتر ────────────────────────────────────
alter table public.profiles
  alter column commission_per_unit type numeric(18,6)
    using coalesce(commission_per_unit, 0)::numeric,
  alter column commission_per_unit set default 1;

comment on column public.profiles.commission_per_unit is
  'کمیسیون هر واحد به **تتر**، در هر سرِ معامله جداگانه. پیش‌فرض ۱ (قاعدهٔ موج تهران).';

alter table public.member_groups
  alter column commission_per_unit type numeric(18,6)
    using coalesce(commission_per_unit, 0)::numeric,
  alter column commission_per_unit set default 0;

comment on column public.member_groups.commission_per_unit is
  'کمیسیون هر واحد به تتر برای این گروه — اگر ست باشد بر مقدار per-user اولویت دارد.';

alter table public.trades
  alter column buyer_commission  type numeric(18,6) using buyer_commission::numeric,
  alter column seller_commission type numeric(18,6) using seller_commission::numeric;

comment on column public.trades.buyer_commission  is 'کمیسیون خریدار به تتر.';
comment on column public.trades.seller_commission is 'کمیسیون فروشنده به تتر.';

-- نامِ ستون دروغ می‌گفت: جمع کمیسیون حالا تتری است.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'settlements'
      and column_name = 'total_commission_toman'
  ) then
    alter table public.settlements
      rename column total_commission_toman to total_commission_tether;
  end if;
end $$;

alter table public.settlements
  alter column total_commission_tether type numeric(18,6)
    using coalesce(total_commission_tether, 0)::numeric,
  alter column total_commission_tether set default 0;

-- گروه‌های پیش‌فرض ۰۰۰۲ با اعداد تومانی پر شده بودند (۰ / ۴۰۰۰۰ / …).
-- در اتاق تتری این‌ها بی‌معنی‌اند؛ صفر می‌شوند تا مقدار per-user ملاک باشد.
update public.member_groups set commission_per_unit = 0 where commission_per_unit > 1000;

-- کاربران موجود (اگر بعداً اجرا شد) — عدد تومانی را به ۱ تتر برگردان
update public.profiles set commission_per_unit = 1 where commission_per_unit > 1000;

-- ─── تأیید کاربر ────────────────────────────────────────────────
create or replace function public.approve_user(
  p_user_id            uuid,
  p_deposit            numeric default null,
  p_per_unit_deposit   numeric default null,
  p_commission         numeric default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role user_role;
  v_target_role user_role;
  v_actor_super boolean;
begin
  select role, is_super_admin into v_actor_role, v_actor_super
  from public.profiles where id = v_actor;

  if v_actor_role <> 'admin' then
    raise exception 'فقط ادمین می‌تواند کاربر را تأیید کند';
  end if;

  select role into v_target_role from public.profiles where id = p_user_id;
  if v_target_role is null then raise exception 'کاربر یافت نشد'; end if;

  if v_target_role = 'admin' and not coalesce(v_actor_super, false) then
    raise exception 'فقط سوپرادمین می‌تواند ادمین جدید را تأیید کند';
  end if;

  update public.profiles set
    active              = true,
    deposit_tether      = case when v_target_role = 'trader' then coalesce(p_deposit, 0) else deposit_tether end,
    per_unit_deposit    = case when v_target_role = 'trader' then coalesce(p_per_unit_deposit, 500) else per_unit_deposit end,
    commission_per_unit = case when v_target_role = 'trader' then coalesce(p_commission, 1) else commission_per_unit end,
    approved_by         = v_actor,
    approved_at         = now()
  where id = p_user_id;

  insert into public.notifications (user_id, type, title, body)
  values (p_user_id, 'account_approved', 'حساب شما تأیید شد',
          'حساب ' || v_target_role::text || ' شما توسط ادمین تأیید شد.');

  perform public.append_audit_log(v_actor, 'admin', 'USER_APPROVED',
    jsonb_build_object('user_id', p_user_id, 'role', v_target_role::text));
end;
$$;

create or replace function public.approve_trader(
  p_trader_id        uuid,
  p_deposit          numeric,
  p_per_unit_deposit numeric,
  p_commission       numeric
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.approve_user(p_trader_id, p_deposit, p_per_unit_deposit, p_commission);
end;
$$;

-- ─── تأیید عضویت تلگرامی (۰۰۱۱ با نوع تازه) ─────────────────────
create or replace function public.approve_registration(
  p_request_id       text,
  p_profile_id       uuid,
  p_actor_id         uuid    default null,
  p_deposit          numeric default null,
  p_per_unit_deposit numeric default null,
  p_commission       numeric default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_actor_role user_role;
  v_actor_active boolean;
  v_req public.registration_requests;
  v_profile public.profiles;
begin
  select role, active into v_actor_role, v_actor_active
  from public.profiles where id = v_actor;

  if v_actor_role is distinct from 'admin' or not coalesce(v_actor_active, false) then
    raise exception 'فقط ادمین فعال می‌تواند عضویت را تأیید کند';
  end if;

  select * into v_req from public.registration_requests
  where id = p_request_id for update;

  if v_req.id is null then raise exception 'درخواست یافت نشد'; end if;
  if v_req.status <> 'submitted' then
    raise exception 'این درخواست در وضعیت «%» است و قابل تأیید نیست', v_req.status;
  end if;

  update public.profiles set
    full_name           = coalesce(v_req.full_name, full_name),
    phone               = coalesce(v_req.phone, phone),
    alias               = coalesce(v_req.alias, alias),
    telegram_id         = v_req.telegram_id::text,
    referrer_id         = coalesce(v_req.referrer_id, referrer_id),
    active              = true,
    role                = 'trader',
    deposit_tether      = coalesce(p_deposit, deposit_tether, 0),
    per_unit_deposit    = coalesce(p_per_unit_deposit, per_unit_deposit, 500),
    commission_per_unit = coalesce(p_commission, commission_per_unit, 1),
    approved_by         = v_actor,
    approved_at         = now()
  where id = p_profile_id
  returning * into v_profile;

  if v_profile.id is null then raise exception 'پروفایل یافت نشد'; end if;

  update public.registration_requests set
    status     = 'approved',
    profile_id = p_profile_id,
    decided_by = v_actor,
    decided_at = now()
  where id = p_request_id;

  insert into public.notifications (user_id, type, title, body)
  values (p_profile_id, 'account_approved', 'حساب شما تأیید شد',
          'عضویت شما در اتاق تأیید شد. حالا می‌توانید در گروه لفظ بزنید.');

  perform public.append_audit_log(v_actor, 'admin', 'REGISTRATION_APPROVED',
    jsonb_build_object(
      'request_id',  p_request_id,
      'profile_id',  p_profile_id,
      'telegram_id', v_req.telegram_id,
      'full_name',   v_req.full_name
    ));

  return jsonb_build_object(
    'profile_id',          p_profile_id,
    'telegram_id',         v_req.telegram_id,
    'member_code',         v_profile.member_code,
    'full_name',           v_profile.full_name,
    'alias',               v_profile.alias,
    'deposit_tether',      v_profile.deposit_tether,
    'per_unit_deposit',    v_profile.per_unit_deposit,
    'commission_per_unit', v_profile.commission_per_unit
  );
end;
$$;

-- ─── ویرایش گروهی (۰۰۰۹ با نوع تازه) ────────────────────────────
create or replace function public.bulk_update_traders(
  p_user_ids               uuid[]   default null,
  p_target_group_id        text     default null,
  p_per_unit_deposit       numeric  default null,
  p_commission_per_unit    numeric  default null,
  p_max_open_units         integer  default null,
  p_member_group_id        text     default null,
  p_referrer_id            uuid     default null,
  p_referral_bonus_pct     numeric  default null,
  p_active                 boolean  default null,
  p_is_credit_user         boolean  default null,
  p_credit_units           integer  default null,
  p_margin_call_disabled   boolean  default null
) returns integer language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'فقط ادمین می‌تواند اعمال گروهی انجام دهد';
  end if;

  update public.profiles set
    per_unit_deposit       = coalesce(p_per_unit_deposit,     per_unit_deposit),
    commission_per_unit    = coalesce(p_commission_per_unit,  commission_per_unit),
    max_open_units         = coalesce(p_max_open_units,       max_open_units),
    member_group_id        = coalesce(p_member_group_id,      member_group_id),
    referrer_id            = coalesce(p_referrer_id,          referrer_id),
    referral_bonus_pct     = coalesce(p_referral_bonus_pct,   referral_bonus_pct),
    active                 = coalesce(p_active,               active),
    is_credit_user         = coalesce(p_is_credit_user,       is_credit_user),
    credit_units           = coalesce(p_credit_units,         credit_units),
    margin_call_disabled   = coalesce(p_margin_call_disabled, margin_call_disabled)
  where role = 'trader'
    and (
      (p_user_ids is not null and id = any(p_user_ids))
      or (p_user_ids is null and (p_target_group_id is null or member_group_id = p_target_group_id))
    );

  get diagnostics v_count = row_count;

  perform public.append_audit_log(v_actor, 'admin', 'TRADERS_BULK_UPDATED',
    jsonb_build_object(
      'user_ids',             p_user_ids,
      'target_group_id',      p_target_group_id,
      'per_unit_deposit',     p_per_unit_deposit,
      'commission_per_unit',  p_commission_per_unit,
      'max_open_units',       p_max_open_units,
      'member_group_id',      p_member_group_id,
      'referrer_id',          p_referrer_id,
      'referral_bonus_pct',   p_referral_bonus_pct,
      'active',               p_active,
      'is_credit_user',       p_is_credit_user,
      'credit_units',         p_credit_units,
      'margin_call_disabled', p_margin_call_disabled,
      'count',                v_count
    ));

  return v_count;
end;
$$;

grant execute on function public.bulk_update_traders(
  uuid[], text, numeric, numeric, integer, text, uuid, numeric, boolean, boolean, integer, boolean
) to authenticated;

-- ─── تصفیه، با فرمول اصلاح‌شده ──────────────────────────────────
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
  v_buyer_comm    numeric;    -- تتر
  v_seller_comm   numeric;    -- تتر
  v_count         integer := 0;   -- تعداد **معامله**
  v_traders       integer := 0;   -- تعداد **معامله‌گر** یکتا
  v_volume        integer := 0;
  v_commission    numeric := 0;
  v_buyer_referrer  uuid;
  v_seller_referrer uuid;
  v_referrer_pct  numeric;
begin
  if not exists (select 1 from public.profiles where id = v_actor_id and role = 'admin') then
    raise exception 'فقط ادمین می‌تواند تصفیه انجام دهد';
  end if;

  select coalesce((value)::text::numeric, 10)
    into v_referrer_pct
    from public.system_settings
   where key = 'referrer_commission_pct';

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
    v_buyer_pnl  := (p_rate_toman - v_trade.price_toman) * v_trade.quantity;
    v_seller_pnl := -v_buyer_pnl;

    -- کمیسیون تتری: اولویت با member_group، fallback به profile
    select
      coalesce(nullif(mg.commission_per_unit, 0), p.commission_per_unit, 0) * v_trade.quantity,
      p.referrer_id
    into v_buyer_comm, v_buyer_referrer
    from public.profiles p
    left join public.member_groups mg on mg.id = p.member_group_id
    where p.id = v_trade.buyer_id;

    select
      coalesce(nullif(mg.commission_per_unit, 0), p.commission_per_unit, 0) * v_trade.quantity,
      p.referrer_id
    into v_seller_comm, v_seller_referrer
    from public.profiles p
    left join public.member_groups mg on mg.id = p.member_group_id
    where p.id = v_trade.seller_id;

    v_buyer_comm  := coalesce(v_buyer_comm, 0);
    v_seller_comm := coalesce(v_seller_comm, 0);

    update public.trades set
      settled           = true,
      settlement_id     = v_settlement_id,
      buyer_pnl_toman   = v_buyer_pnl,
      seller_pnl_toman  = v_seller_pnl,
      buyer_commission  = v_buyer_comm,
      seller_commission = v_seller_comm
    where id = v_trade.id;

    if p_rate_tether > 0 then
      -- سود تومانی به تتر تبدیل می‌شود؛ کمیسیون **خودش تتری است** و
      -- نباید دوباره تقسیم شود.
      update public.profiles set deposit_tether =
        deposit_tether + (v_buyer_pnl::numeric / p_rate_tether) - v_buyer_comm
      where id = v_trade.buyer_id;

      update public.profiles set deposit_tether =
        deposit_tether + (v_seller_pnl::numeric / p_rate_tether) - v_seller_comm
      where id = v_trade.seller_id;
    end if;

    -- پاداش رفرال: درصدی از کمیسیونِ تتری، بدون تبدیل
    if v_buyer_referrer is not null and v_referrer_pct > 0 then
      update public.profiles set
        deposit_tether = deposit_tether + (v_buyer_comm * v_referrer_pct / 100.0)
       where id = v_buyer_referrer;
    end if;

    if v_seller_referrer is not null and v_referrer_pct > 0 then
      update public.profiles set
        deposit_tether = deposit_tether + (v_seller_comm * v_referrer_pct / 100.0)
       where id = v_seller_referrer;
    end if;

    v_count      := v_count + 1;
    v_volume     := v_volume + v_trade.quantity;
    v_commission := v_commission + v_buyer_comm + v_seller_comm;
  end loop;

  -- پنل این عدد را «… تریدر تأثیر پذیرفتند» نشان می‌دهد، ولی تا حالا
  -- تعداد معامله برمی‌گشت. یک تصفیهٔ ۳ معامله‌ای بین ۲ نفر، «۳ تریدر»
  -- می‌گفت.
  select count(distinct u) into v_traders from (
    select buyer_id  as u from public.trades where settlement_id = v_settlement_id
    union
    select seller_id      from public.trades where settlement_id = v_settlement_id
  ) x;

  update public.orders set
    status        = 'cancelled',
    cancelled_at  = now(),
    cancel_reason = 'auto-cancel-settlement'
  where market_id = p_market_id
    and settlement_date = p_settlement_date
    and status in ('open', 'partial');

  insert into public.settlements
    (id, market_id, settlement_date, rate_toman, rate_tether,
     applied_by, snapshot_before, total_trades_count, total_volume_units, total_commission_tether)
  values
    (v_settlement_id, p_market_id, p_settlement_date, p_rate_toman, p_rate_tether,
     v_actor_id, v_snapshot, v_count, v_volume, v_commission);

  perform public.append_audit_log(v_actor_id, 'admin', 'SETTLEMENT_APPLIED',
    jsonb_build_object('settlement_id', v_settlement_id, 'market_id', p_market_id,
                       'date', p_settlement_date, 'rate_toman', p_rate_toman,
                       'count', v_count, 'volume', v_volume,
                       'commission_tether', v_commission));

  return jsonb_build_object('settlement_id', v_settlement_id,
                            'affected_traders', v_traders,
                            'total_trades', v_count,
                            'total_volume', v_volume,
                            'total_commission', v_commission);
end;
$$;

-- ─── پیش‌نمایش تصفیه، بازنویسی‌شده ──────────────────────────────
create or replace function public.get_settlement_preview(
  p_market_id       text,
  p_settlement_date date,
  p_test_price      bigint,
  p_tether_rate     bigint
) returns table (
  trader_id              uuid,
  full_name              text,
  deposit_tether         numeric,
  open_units             integer,
  floating_pnl_toman     bigint,
  floating_pnl_tether    numeric,
  commission_accumulated numeric,   -- تتر
  required_tether        numeric,
  available_tether       numeric,
  percentage             numeric,   -- سلامت ودیعه، ۱۰۰ = دست‌نخورده
  loss_percentage        numeric,
  zone                   text
) language plpgsql security definer set search_path = public as $$
declare
  v_warn integer;
  v_liq  integer;
begin
  select coalesce(m.margin_warn_pct, 75), coalesce(m.margin_liquidate_pct, 85)
    into v_warn, v_liq
    from public.markets m where m.id = p_market_id;

  v_warn := coalesce(v_warn, 75);
  v_liq  := coalesce(v_liq, 85);

  return query
  with agg as (
    select
      p.id                                as pid,
      p.full_name                         as pname,
      coalesce(p.deposit_tether, 0)       as deposit,
      coalesce(p.per_unit_deposit, 0)     as per_unit,
      coalesce(p.commission_per_unit, 0)  as comm_unit,
      coalesce(p.is_credit_user, false)   as is_credit,
      coalesce(p.credit_units, 0)         as credit_units,
      coalesce(p.margin_call_disabled, false) as call_off,
      -- **واحد**، نه تعداد معامله. باگ قبلی همین بود.
      coalesce(sum(t.quantity), 0)::integer as units,
      coalesce(sum(
        case
          when t.buyer_id  = p.id then (p_test_price - t.price_toman) * t.quantity
          when t.seller_id = p.id then (t.price_toman - p_test_price) * t.quantity
          else 0
        end
      ), 0)::bigint                        as pnl_toman
    from public.profiles p
    left join public.trades t
      on t.market_id       = p_market_id
     and t.settlement_date = p_settlement_date
     and t.settled         = false
     and t.liquidated_at is null
     and (t.buyer_id = p.id or t.seller_id = p.id)
    where p.role = 'trader' and p.active = true
    group by p.id, p.full_name, p.deposit_tether, p.per_unit_deposit,
             p.commission_per_unit, p.is_credit_user, p.credit_units, p.margin_call_disabled
  ),
  calc as (
    select
      a.*,
      case when p_tether_rate > 0 then a.pnl_toman::numeric / p_tether_rate else 0 end as pnl_tether,
      a.units * a.per_unit as required,
      case when a.is_credit then a.credit_units * a.per_unit else a.deposit end as deposit_base
    from agg a
  ),
  fin as (
    select
      c.*,
      c.deposit_base + c.pnl_tether as available,
      c.units * c.comm_unit         as commission
    from calc c
  ),
  scored as (
    select
      f.*,
      case when f.required = 0 then 0
           else greatest(0, (f.required - f.available) / f.required * 100)
      end as loss_pct
    from fin f
  )
  select
    s.pid,
    s.pname,
    round(s.deposit, 6),
    s.units,
    s.pnl_toman,
    round(s.pnl_tether, 6),
    round(s.commission, 6),
    round(s.required, 6),
    round(s.available, 6),
    round(100 - s.loss_pct, 2),
    round(s.loss_pct, 2),
    -- دقیقاً همان قاعدهٔ compute_user_margin، از جمله downgrade وقتی
    -- مدیر حراج خودکار این کاربر را خاموش کرده.
    case
      when s.loss_pct >= v_liq  then (case when s.call_off then 'warn' else 'call' end)
      when s.loss_pct >= v_warn then 'warn'
      else 'safe'
    end
  from scored s;
end;
$$;

grant execute on function public.get_settlement_preview(text, date, bigint, bigint) to authenticated;
grant execute on function public.apply_settlement(text, date, bigint, bigint) to authenticated;
grant execute on function public.approve_user(uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.approve_trader(uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.approve_registration(text, uuid, uuid, numeric, numeric, numeric) to authenticated;

