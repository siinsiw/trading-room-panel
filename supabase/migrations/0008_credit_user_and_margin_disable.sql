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
