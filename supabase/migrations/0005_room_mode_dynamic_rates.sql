-- ═══════════════════════════════════════════════════════════════════════════
--  Migration 0005 — Room mode (parry/margin), dynamic tether rate, owner override
--  Implements clarifications from آقا مهدی (2026-05-03):
--    1. Room can operate in 'parry' or 'margin' mode (per-market)
--    2. Margin mode uses two configurable thresholds: warn% / liquidate%
--    3. Tether rate is dynamic (updated by bot from latest trade)
--    4. Owner override on expired/oversold lafz (not auto-cancel)
--    5. Admin can cancel "لفظ پرت" (off-market) lafz
--    6. Lafz can be absolute price OR relative to mazne
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── New enums ───────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'room_mode') then
    create type room_mode as enum ('parry', 'margin');
  end if;
end $$;

-- ─── markets: add room_mode + parry threshold ───────────────────────────────
alter table public.markets
  add column if not exists mode               room_mode  not null default 'margin',
  add column if not exists parry_threshold    integer    null,           -- toman, only used in 'parry' mode
  add column if not exists margin_warn_pct    integer    not null default 75,
  add column if not exists margin_liquidate_pct integer  not null default 85,
  add column if not exists tether_rate_today  numeric    null,           -- last today-trade price (toman/usdt)
  add column if not exists tether_rate_tomorrow numeric  null;           -- last tomorrow-trade price

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
  p_order_id uuid,
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
  -- only admin / accountant can cancel as پرت
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

-- ─── RPC: owner_override_baraka (owner accepts على expired or oversold) ────
create or replace function public.owner_override_baraka(
  p_order_id     uuid,
  p_buyer_id     uuid,
  p_seller_id    uuid,
  p_quantity     integer,
  p_price_toman  numeric,
  p_market_id    uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_order public.orders%rowtype;
  v_trade_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'لفظ یافت نشد';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'این لفظ لغو شده — override ممکن نیست';
  end if;

  -- mark override
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

  -- create the trade row
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
  p_market_id uuid,
  p_kind      text,           -- 'today' | 'tomorrow'
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
create or replace function public.apply_emergency_settlement(
  p_market_id      uuid,
  p_rate_toman     numeric,
  p_rate_tether    numeric,
  p_reason         text default 'manual'    -- 'manual' | 'parry_triggered'
)
returns json
language plpgsql
security definer
as $$
declare
  v_caller_role text;
  v_settlement_id uuid;
  v_today date := current_date;
begin
  v_caller_role := public.current_role();
  if v_caller_role not in ('admin') and p_reason = 'manual' then
    raise exception 'فقط ادمین می‌تواند تصفیهٔ فوری دستی بزند';
  end if;

  -- Run normal apply_settlement with the emergency flag (we reuse the same logic)
  -- Mark in audit / settlement note
  select public.apply_settlement(p_market_id, p_rate_toman, p_rate_tether) into v_settlement_id;

  insert into public.audit_log (actor_id, actor_role, action, payload)
  values (
    auth.uid(),
    v_caller_role,
    'EMERGENCY_SETTLEMENT',
    json_build_object(
      'market_id', p_market_id,
      'rate_toman', p_rate_toman,
      'rate_tether', p_rate_tether,
      'reason', p_reason,
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
