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
