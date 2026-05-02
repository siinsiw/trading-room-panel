-- ═══════════════════════════════════════════════════════════════════════════
--  اتاق معاملات — Seed Data (تست)
--  مرحله ۱: اول migration/0001_init.sql رو اجرا کن، بعد این فایل رو
--  Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── کاربران تست (auth.users) ────────────────────────────────────────────────
-- ایمیل: admin@test.com  پسورد: Test1234!
-- ایمیل: trader1@test.com پسورد: Test1234!
-- ایمیل: trader2@test.com پسورد: Test1234!
-- ایمیل: trader3@test.com پسورد: Test1234!

insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, role, aud, created_at, updated_at
) values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@test.com',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"full_name":"سینا صفرزاده","phone":"09120000001","role":"admin"}'::jsonb,
    'authenticated', 'authenticated', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'trader1@test.com',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"full_name":"علی رضایی","phone":"09120000002"}'::jsonb,
    'authenticated', 'authenticated', now(), now()
  ),
  (
    'cccccccc-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'trader2@test.com',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"full_name":"مریم احمدی","phone":"09120000003"}'::jsonb,
    'authenticated', 'authenticated', now(), now()
  ),
  (
    'dddddddd-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'trader3@test.com',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"full_name":"حسین محمدی","phone":"09120000004"}'::jsonb,
    'authenticated', 'authenticated', now(), now()
  )
on conflict (id) do nothing;

-- ─── پروفایل‌ها ─────────────────────────────────────────────────────────────
insert into public.profiles (
  id, full_name, phone, role, active,
  deposit_tether, per_unit_deposit, commission_per_unit,
  approved_by, approved_at
) values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'سینا صفرزاده', '09120000001', 'admin', true,
    0, 0, 0, null, null
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'علی رضایی', '09120000002', 'trader', true,
    2000, 500, 50000,
    'aaaaaaaa-0000-0000-0000-000000000001', now()
  ),
  (
    'cccccccc-0000-0000-0000-000000000003',
    'مریم احمدی', '09120000003', 'trader', true,
    3000, 500, 50000,
    'aaaaaaaa-0000-0000-0000-000000000001', now()
  ),
  (
    'dddddddd-0000-0000-0000-000000000004',
    'حسین محمدی', '09120000004', 'trader', true,
    1500, 500, 50000,
    'aaaaaaaa-0000-0000-0000-000000000001', now()
  )
on conflict (id) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  active = excluded.active,
  deposit_tether = excluded.deposit_tether;

-- ─── بازار ──────────────────────────────────────────────────────────────────
insert into public.markets (id, name, symbol, unit_weight, unit_label, mazne_current, active)
values ('market-gold-01', 'طلای آب‌شده', 'XAU', 100, 'گرم', 88300000, true)
on conflict (id) do update set mazne_current = 88300000, active = true;

-- ─── سفارش‌های باز (امروز) ──────────────────────────────────────────────────
insert into public.orders (
  id, trader_id, market_id, side, lafz, price_toman,
  quantity, filled, remaining, settlement_date, status, placed_at
) values
  ('order-001', 'bbbbbbbb-0000-0000-0000-000000000002', 'market-gold-01',
   'buy',  200, 88500000, 3, 0, 3, current_date, 'open', now() - interval '30 min'),
  ('order-002', 'bbbbbbbb-0000-0000-0000-000000000002', 'market-gold-01',
   'buy',  150, 88450000, 2, 0, 2, current_date, 'open', now() - interval '20 min'),
  ('order-003', 'cccccccc-0000-0000-0000-000000000003', 'market-gold-01',
   'sell', -100, 88200000, 4, 0, 4, current_date, 'open', now() - interval '25 min'),
  ('order-004', 'cccccccc-0000-0000-0000-000000000003', 'market-gold-01',
   'sell', -200, 88100000, 2, 0, 2, current_date, 'open', now() - interval '15 min'),
  ('order-005', 'dddddddd-0000-0000-0000-000000000004', 'market-gold-01',
   'buy',  300, 88600000, 5, 2, 3, current_date, 'partial', now() - interval '40 min')
on conflict (id) do nothing;

-- ─── معاملات انجام‌شده (امروز) ──────────────────────────────────────────────
insert into public.trades (
  id, market_id, buyer_id, seller_id, buy_order_id, sell_order_id,
  quantity, price_toman, settlement_date, matched_at, settled
) values
  (
    'trade-001', 'market-gold-01',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'cccccccc-0000-0000-0000-000000000003',
    'order-001', 'order-003',
    2, 88300000, current_date, now() - interval '28 min', false
  ),
  (
    'trade-002', 'market-gold-01',
    'dddddddd-0000-0000-0000-000000000004',
    'cccccccc-0000-0000-0000-000000000003',
    'order-005', 'order-003',
    2, 88300000, current_date, now() - interval '20 min', false
  ),
  (
    'trade-003', 'market-gold-01',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'cccccccc-0000-0000-0000-000000000003',
    'order-002', 'order-004',
    1, 88250000, current_date, now() - interval '10 min', false
  )
on conflict (id) do nothing;

-- ─── تنظیمات سیستم ──────────────────────────────────────────────────────────
insert into public.system_settings (key, value) values
  ('lock_time', '"13:30"'),
  ('base_commission', '50000'),
  ('lafz_max', '999'),
  ('lafz_min', '1')
on conflict (key) do nothing;

-- ─── نتیجه ──────────────────────────────────────────────────────────────────
select 'profiles' as tbl, count(*) from public.profiles
union all
select 'markets',  count(*) from public.markets
union all
select 'orders',   count(*) from public.orders
union all
select 'trades',   count(*) from public.trades;
