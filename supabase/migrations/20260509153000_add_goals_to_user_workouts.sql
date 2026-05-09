alter table public.user_workouts
  add column if not exists goals text;
