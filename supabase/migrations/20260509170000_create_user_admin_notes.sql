create table if not exists public.user_admin_notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goals text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_admin_notes enable row level security;

insert into public.user_admin_notes (user_id, goals)
select user_id, goals
from public.user_workouts
where goals is not null and btrim(goals) <> ''
on conflict (user_id)
do update set
  goals = excluded.goals,
  updated_at = now();
