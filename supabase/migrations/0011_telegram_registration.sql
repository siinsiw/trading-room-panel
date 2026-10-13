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
