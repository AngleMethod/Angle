-- All fixtures are transaction-local; no student workouts or subscriptions change.
begin;
create temporary table starter_test_results (check_name text, passed boolean);
do $$
declare
  test_user uuid := gen_random_uuid();
  chosen_level text;
  template_steps jsonb;
  assigned_steps jsonb;
  previous_steps jsonb;
  assignment_result text;
begin
  insert into auth.users(id) values(test_user);
  if public.assign_starter_program(test_user,'beginner') <> 'subscription_required' then raise exception 'Missing subscription was accepted'; end if;
  insert into starter_test_results values ('No membership: blocked',true);
  insert into public.subscriptions(user_id,status) values(test_user,'active');
  if public.assign_starter_program(test_user,'bad') <> 'invalid_level' then raise exception 'Bad level accepted'; end if;
  foreach chosen_level in array array['beginner','intermediate','advanced'] loop
    -- Empty fixture exercises the conflict/update path after the first insert.
    update public.user_workouts set steps='[]'::jsonb where user_id=test_user;
    assignment_result := public.assign_starter_program(test_user,chosen_level);
    if assignment_result <> 'assigned' then raise exception 'Assignment failed: % %',chosen_level,assignment_result; end if;
    select steps into assigned_steps from public.user_workouts where user_id=test_user;
    select steps into template_steps from public.program_templates where id=chosen_level;
    if jsonb_array_length(assigned_steps) <> jsonb_array_length(template_steps) then raise exception 'Incomplete template copy'; end if;
    if exists (
      select 1 from jsonb_array_elements(template_steps) with ordinality t(item,n)
      join jsonb_array_elements(assigned_steps) with ordinality a(item,n) using(n)
      where t.item - 'dayId' <> a.item - 'dayId'
        or (t.item->>'separateDay'='true' and t.item->>'dayId'=a.item->>'dayId')
    ) then raise exception 'Copy differs or day IDs reused'; end if;
    if not exists(select 1 from public.user_workouts where user_id=test_user and starter_level=chosen_level) then raise exception 'Level not recorded'; end if;
    if public.assign_starter_program(test_user,'advanced') <> 'existing_program' then raise exception 'Repeat assignment allowed'; end if;
    select steps into previous_steps from public.user_workouts where user_id=test_user;
    if previous_steps <> assigned_steps then raise exception 'Assigned plan overwritten'; end if;
    insert into starter_test_results values(initcap(chosen_level)||': complete copy, fresh day IDs, repeat blocked',true);
  end loop;
  update public.user_workouts set steps='[{"type":"banner","text":"Coach plan"}]'::jsonb, starter_level=null where user_id=test_user;
  if public.assign_starter_program(test_user,'beginner') <> 'existing_program' then raise exception 'Coach plan overwritten'; end if;
  insert into starter_test_results values('Coach plan (including banner-only): protected',true);
  if not exists(select 1 from public.subscriptions where user_id=test_user and onboarding_status='not_booked') then raise exception 'Booking status changed'; end if;
  insert into starter_test_results values('Assessment booking status: unchanged',true);
  update public.user_workouts set steps='[]'::jsonb where user_id=test_user;
  update public.subscriptions set status='canceled' where user_id=test_user;
  if public.assign_starter_program(test_user,'beginner') <> 'subscription_required' then raise exception 'Canceled member accepted'; end if;
  insert into starter_test_results values('Canceled membership: blocked',true);
end;
$$;
select * from starter_test_results;
rollback;
