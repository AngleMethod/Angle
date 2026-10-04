-- Preserve the member's initial self-assessment when their coach later edits the plan.
alter table public.user_workouts
  add column if not exists starter_level text check (starter_level in ('beginner','intermediate','advanced')),
  add column if not exists starter_template_version integer;

-- Called only by the server after verifying the member's identity. The conditional
-- upsert locks the row and checks its current value, including concurrent coach saves.
create or replace function public.assign_starter_program(p_user_id uuid, p_level text)
returns text language plpgsql security invoker set search_path = public as $$
declare
  v_steps jsonb;
  v_version integer;
  v_assigned uuid;
begin
  if p_level is null or p_level not in ('beginner','intermediate','advanced') then
    return 'invalid_level';
  end if;
  perform 1 from public.subscriptions
    where user_id = p_user_id and status in ('active','trialing') for share;
  if not found then return 'subscription_required'; end if;

  if exists (select 1 from public.user_workouts where user_id = p_user_id and steps <> '[]'::jsonb) then
    return 'existing_program';
  end if;
  select steps, version into v_steps, v_version from public.program_templates where id = p_level;
  if v_steps is null or jsonb_typeof(v_steps) <> 'array' then return 'template_unavailable'; end if;
  if not exists (select 1 from jsonb_array_elements(v_steps) item where item->>'type' is distinct from 'banner') then
    return 'template_unavailable';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_steps) item
    where item->>'type' is distinct from 'banner'
      and not exists (select 1 from public.videos where id::text = item->>'videoId')
  ) then return 'template_unavailable'; end if;

  select jsonb_agg(case when item->>'type' = 'banner' and item->>'separateDay' = 'true'
    then jsonb_set(item, '{dayId}', to_jsonb(gen_random_uuid()::text)) else item end order by position)
    into v_steps from jsonb_array_elements(v_steps) with ordinality as items(item, position);

  insert into public.user_workouts(user_id, steps, assigned_by_email, updated_at, starter_level, starter_template_version)
    values (p_user_id, v_steps, 'Self-selected starter program', now(), p_level, v_version)
    on conflict (user_id) do update set
      steps = excluded.steps, assigned_by_email = excluded.assigned_by_email,
      updated_at = excluded.updated_at, starter_level = excluded.starter_level,
      starter_template_version = excluded.starter_template_version
    where user_workouts.steps = '[]'::jsonb
    returning user_id into v_assigned;
  if v_assigned is null then return 'existing_program'; end if;
  return 'assigned';
end;
$$;
revoke all on function public.assign_starter_program(uuid,text) from public, anon, authenticated;
grant execute on function public.assign_starter_program(uuid,text) to service_role;
