create table if not exists public.program_templates (
  id text primary key check (id = 'beginner'),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  version integer not null default 0 check (version >= 0),
  updated_at timestamptz
);
alter table public.program_templates enable row level security;
revoke all on public.program_templates from anon, authenticated;
grant select, update on public.program_templates to service_role;
insert into public.program_templates(id) values ('beginner') on conflict (id) do nothing;
