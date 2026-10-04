-- Reset reusable template instructions only; never touch assigned member workouts.
begin;
do $$
declare
  template_row record;
  reset_steps jsonb;
begin
  for template_row in
    select id, steps from public.program_templates
    where id in ('beginner','intermediate','advanced') for update
  loop
    if exists (
      select 1 from jsonb_array_elements(template_row.steps) s(item)
      where s.item->>'type' is distinct from 'banner'
        and not exists (select 1 from public.videos v where v.id::text=s.item->>'videoId')
    ) then raise exception 'Missing library video in %; no templates changed', template_row.id;
    end if;

    select coalesce(jsonb_agg(
      case when s.item->>'type' = 'banner' then s.item
        else jsonb_set(s.item, '{description}', to_jsonb(coalesce(v.description,'')), true) end
      order by s.position), '[]'::jsonb)
    into reset_steps
    from jsonb_array_elements(template_row.steps) with ordinality s(item,position)
    left join public.videos v on v.id::text=s.item->>'videoId';

    -- Only descriptions may change; retain every day, field, and item position.
    if (select jsonb_agg(item - 'description' order by position)
        from jsonb_array_elements(reset_steps) with ordinality s(item,position))
       is distinct from
       (select jsonb_agg(item - 'description' order by position)
        from jsonb_array_elements(template_row.steps) with ordinality s(item,position))
    then raise exception 'Unexpected non-description change'; end if;

    update public.program_templates set steps=reset_steps, version=version+1, updated_at=now()
      where id=template_row.id and steps is distinct from reset_steps;
  end loop;
end;
$$;
commit;

select t.id as template, count(*) as exercises,
  count(*) filter (where v.id is null) as missing_videos,
  count(*) filter (where s.item->>'description' is distinct from coalesce(v.description,'')) as remaining_mismatches
from public.program_templates t
cross join lateral jsonb_array_elements(t.steps) s(item)
left join public.videos v on v.id::text=s.item->>'videoId'
where t.id in ('beginner','intermediate','advanced') and s.item->>'type' is distinct from 'banner'
group by t.id order by t.id;
