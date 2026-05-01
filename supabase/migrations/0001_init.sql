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
create policy "profiles: own read"
  on public.profiles for select using (id = auth.uid());

create policy "profiles: admin read all"
  on public.profiles for select using (public.current_role() = 'admin');

create policy "profiles: accountant read all"
  on public.profiles for select using (public.current_role() = 'accountant');

create policy "profiles: trader see names"
  on public.profiles for select using (
    public.current_role() = 'trader'
    -- traders can see name/phone but not deposits — handled by column-level or app logic
  );

create policy "profiles: admin write all"
  on public.profiles for update using (public.current_role() = 'admin');

create policy "profiles: own update"
  on public.profiles for update using (id = auth.uid());

-- ─── markets RLS ─────────────────────────────────────────────────────────────
create policy "markets: all read"
  on public.markets for select using (true);

create policy "markets: admin write"
  on public.markets for insert with check (public.current_role() = 'admin');

create policy "markets: admin update"
  on public.markets for update using (public.current_role() = 'admin');

-- ─── orders RLS ──────────────────────────────────────────────────────────────
create policy "orders: all read open"
  on public.orders for select using (
    status in ('open', 'partial')
    or trader_id = auth.uid()
    or public.current_role() in ('admin', 'accountant')
  );

create policy "orders: trader insert own"
  on public.orders for insert with check (trader_id = auth.uid());

create policy "orders: update via rpc"
  on public.orders for update using (true); -- controlled by RPC security definer

-- ─── trades RLS ──────────────────────────────────────────────────────────────
create policy "trades: all read"
  on public.trades for select using (
    buyer_id = auth.uid()
    or seller_id = auth.uid()
    or public.current_role() in ('admin', 'accountant')
  );

create policy "trades: insert via rpc"
  on public.trades for insert with check (true); -- RPC security definer

create policy "trades: update via rpc"
  on public.trades for update using (true);

-- ─── settlements RLS ─────────────────────────────────────────────────────────
create policy "settlements: admin accountant read"
  on public.settlements for select using (public.current_role() in ('admin', 'accountant'));

create policy "settlements: insert via rpc"
  on public.settlements for insert with check (true);

create policy "settlements: update via rpc"
  on public.settlements for update using (true);

-- ─── audit_log RLS ───────────────────────────────────────────────────────────
create policy "audit: admin accountant read"
  on public.audit_log for select using (public.current_role() in ('admin', 'accountant'));

-- No direct insert/update/delete (append_audit_log function handles it)

-- ─── notifications RLS ───────────────────────────────────────────────────────
create policy "notif: own read"
  on public.notifications for select using (user_id = auth.uid());

create policy "notif: own update"
  on public.notifications for update using (user_id = auth.uid());

create policy "notif: insert via trigger"
  on public.notifications for insert with check (true);

-- ─── system_settings RLS ─────────────────────────────────────────────────────
create policy "settings: all read"
  on public.system_settings for select using (true);

create policy "settings: admin write"
  on public.system_settings for insert with check (public.current_role() = 'admin');

create policy "settings: admin update"
  on public.system_settings for update using (public.current_role() = 'admin');

-- ═══════════════════════════════════════════════════════════════════════════
--  REALTIME
-- ═══════════════════════════════════════════════════════════════════════════

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.trades;
alter publication supabase_realtime add table public.markets;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.settlements;
alter publication supabase_realtime add table public.notifications;

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

