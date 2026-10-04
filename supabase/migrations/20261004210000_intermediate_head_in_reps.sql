-- Replace only the video/title/default instructions; keep the existing dose.
update public.program_templates t
set steps=jsonb_set(t.steps, '{2}', (t.steps->2) || jsonb_build_object(
  'videoId',v.id::text,'title',v.title,'description',coalesce(v.description,''))),
  version=t.version+1, updated_at=now()
from public.videos v
where t.id='intermediate' and t.version=1
  and t.steps->2->>'videoId'='08b8ec1e-e701-4f65-9e56-faaa8d4202e8'
  and v.id='2ae278cb-be84-4a96-8d7e-267a1631425e'
returning t.id, t.version, t.steps->2->>'title' as title,
  t.steps->2->>'sets' as sets, t.steps->2->>'repsOrHoldTime' as reps,
  t.steps->2->>'description' as instructions;
