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
