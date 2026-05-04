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
