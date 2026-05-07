-- ════════════════════════════════════════════════════════════════
--  Migration 0009 — Extend bulk_update_traders to all profile fields
--  Source: مهدی dor 4 (2026-05-07): «ویرایش تکی و گروهی برای همه چیز»
--   - افزودن همهٔ فیلدهای قابل ویرایش گروهی (نه balance، نه identity)
--   - پشتیبانی از انتخاب per-id (لیست user_ids) به‌جای فقط group_id
-- ════════════════════════════════════════════════════════════════

do $$
declare r record;
begin
  for r in
    select 'drop function public.' || proname || '(' || pg_get_function_identity_arguments(oid) || ');' as cmd
    from pg_proc
    where proname in ('bulk_update_traders')
    and pg_function_is_visible(oid)
  loop execute r.cmd; end loop;
end $$;

create or replace function public.bulk_update_traders(
  p_user_ids               uuid[]   default null,   -- اولویت با این. null یعنی از target_group_id استفاده شود
  p_target_group_id        text     default null,   -- اگر user_ids=null و این هم null → همهٔ تریدرها
  p_per_unit_deposit       numeric  default null,
  p_commission_per_unit    bigint   default null,
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
  uuid[], text, numeric, bigint, integer, text, uuid, numeric, boolean, boolean, integer, boolean
) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- END migration 0009
-- ════════════════════════════════════════════════════════════════
