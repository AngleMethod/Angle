alter table public.program_templates drop constraint if exists program_templates_id_check;
alter table public.program_templates add constraint program_templates_id_check check (id in ('beginner', 'intermediate', 'advanced'));
insert into public.program_templates(id) values ('intermediate') on conflict (id) do nothing;
