alter table public.program_templates drop constraint if exists program_templates_id_check;
alter table public.program_templates add constraint program_templates_id_check check (id in ('beginner', 'advanced'));
insert into public.program_templates(id) values ('advanced') on conflict (id) do nothing;
