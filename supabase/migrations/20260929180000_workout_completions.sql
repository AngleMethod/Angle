create table if not exists public.workout_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  completed_at timestamptz not null default now(),
  completed_date date not null,
  time_zone text not null,
  workout_name text not null check (char_length(workout_name) between 1 and 200),
  day_key text not null check (char_length(day_key) between 1 and 200),
  completed_exercises integer not null check (completed_exercises > 0),
  total_exercises integer not null check (total_exercises >= completed_exercises and total_exercises <= 1000),
  primary key (user_id, session_id)
);
create index if not exists workout_completions_user_date_idx on public.workout_completions(user_id, completed_date);
alter table public.workout_completions enable row level security;
-- Access is only through authenticated, ownership-checked server routes.
revoke all on public.workout_completions from anon, authenticated;
grant select, insert on public.workout_completions to service_role;
