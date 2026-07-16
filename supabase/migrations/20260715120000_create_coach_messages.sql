-- Text-only coach messaging between active subscribers and admins.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  sender_role text not null,
  sender_email text not null,
  body text not null,
  read_by_admin_at timestamptz,
  read_by_user_at timestamptz,
  created_at timestamptz not null default now(),

  constraint coach_messages_sender_role_check
    check (sender_role in ('user', 'admin')),
  constraint coach_messages_body_length_check
    check (char_length(body) between 1 and 4000)
);

comment on table public.coach_messages is
  'Text-only message threads between subscribers and Angle admins. One thread is represented by all rows for a user_id.';

create index if not exists coach_messages_user_created_idx
  on public.coach_messages (user_id, created_at asc);

create index if not exists coach_messages_created_idx
  on public.coach_messages (created_at desc);

create index if not exists coach_messages_admin_unread_idx
  on public.coach_messages (user_id, created_at desc)
  where sender_role = 'user' and read_by_admin_at is null;

alter table public.coach_messages enable row level security;

grant select, insert, update on public.coach_messages to authenticated;

drop policy if exists "Users can view their own coach messages"
  on public.coach_messages;
create policy "Users can view their own coach messages"
on public.coach_messages
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own coach messages"
  on public.coach_messages;
create policy "Users can create their own coach messages"
on public.coach_messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  and sender_role = 'user'
  and lower(sender_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Admins can view all coach messages"
  on public.coach_messages;
create policy "Admins can view all coach messages"
on public.coach_messages
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = any (
    array['josh@anglemethod.com', 'morgan@anglemethod.com', 'ninagrishchenko2003@gmail.com']
  )
);

drop policy if exists "Admins can create coach messages"
  on public.coach_messages;
create policy "Admins can create coach messages"
on public.coach_messages
for insert
to authenticated
with check (
  sender_role = 'admin'
  and lower(coalesce(auth.jwt() ->> 'email', '')) = any (
    array['josh@anglemethod.com', 'morgan@anglemethod.com', 'ninagrishchenko2003@gmail.com']
  )
);

drop policy if exists "Admins can mark coach messages read"
  on public.coach_messages;
create policy "Admins can mark coach messages read"
on public.coach_messages
for update
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = any (
    array['josh@anglemethod.com', 'morgan@anglemethod.com', 'ninagrishchenko2003@gmail.com']
  )
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = any (
    array['josh@anglemethod.com', 'morgan@anglemethod.com', 'ninagrishchenko2003@gmail.com']
  )
);
