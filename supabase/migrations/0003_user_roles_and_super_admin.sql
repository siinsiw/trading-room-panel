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
