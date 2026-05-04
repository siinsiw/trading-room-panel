-- ═══════════════════════════════════════════════════════════════════════════
--  Migration 0006 — Counter-offer + Liquidation + Parry-breach helper
--    1. Counter-offer columns on orders (parent_order_id, proposed_price, …)
--    2. RPC liquidate_user_position — flag positions as liquidated
--    3. RPC check_parry_breach — returns true if last trade breached parry
--    4. compute_user_margin → switch to 2-threshold model (loss_percentage)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Counter-offer columns ───────────────────────────────────────────────
alter table public.orders
  add column if not exists parent_order_id   uuid          null references public.orders(id),
  add column if not exists proposed_by_user  uuid          null references public.profiles(id),
  add column if not exists is_counter_offer  boolean       not null default false;

create index if not exists idx_orders_parent on public.orders(parent_order_id) where parent_order_id is not null;

comment on column public.orders.parent_order_id is
  'When set, this order is a counter-offer (چونه) on parent_order_id';
comment on column public.orders.proposed_by_user is
  'For counter-offers: the user who proposed the alternative price';

-- ─── RPC: liquidate_user_position ────────────────────────────────────────
-- Flags every open trade of a user in a market as liquidated. Does NOT auto-close
-- (since this is a P2P verbal market — actual closing requires admin intervention).
create or replace function public.liquidate_user_position(
  p_user_id   uuid,
  p_market_id uuid,
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

-- Add liquidate columns on trades if not present
alter table public.trades
  add column if not exists liquidated_at    timestamptz null,
  add column if not exists liquidate_reason text        null;

create index if not exists idx_trades_liquidated on public.trades(liquidated_at) where liquidated_at is not null;

-- ─── RPC: check_parry_breach ─────────────────────────────────────────────
-- Returns true if a given trade price breaches the parry threshold relative
-- to the latest settlement price for that market.
create or replace function public.check_parry_breach(
  p_market_id   uuid,
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

  -- Find latest non-reversed settlement for this market
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
  select * into v_market  from public.markets  where id = p_market_id::uuid;

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
  where t.market_id = p_market_id::uuid
    and t.settled = false
    and t.liquidated_at is null
    and (t.buyer_id = p_user_id or t.seller_id = p_user_id);

  v_required       := v_open_units * coalesce(v_profile.per_unit_deposit, 0);
  v_floating_tether := case when p_tether_rate > 0 then v_floating_toman::numeric / p_tether_rate else 0 end;
  v_available      := coalesce(v_profile.deposit_tether, 0) + v_floating_tether;

  -- درصد ضرر = چقدر از ودیعه مورد نیاز در ضرر است
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
