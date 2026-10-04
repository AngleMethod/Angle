-- Certificates are independent earned records: no changes to programs or subscriptions.
create table if not exists public.mastery_certificates (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null check (length(trim(recipient_name)) between 1 and 80),
  recipient_email text not null,
  skill text not null check (length(trim(skill)) between 1 and 100),
  awarded_by uuid references auth.users(id) on delete set null,
  awarded_at timestamptz not null default now(),
  award_date date not null default (now() at time zone 'America/Chicago')::date,
  template_version integer not null default 1 check (template_version = 1),
  seen_at timestamptz,
  email_status text not null default 'pending' check (email_status in ('pending','sending','sent','failed')),
  email_attempted_at timestamptz,
  email_sent_at timestamptz,
  email_provider_id text
);
create unique index if not exists mastery_certificates_unique_skill on public.mastery_certificates(user_id, lower(trim(skill)));
create index if not exists mastery_certificates_member on public.mastery_certificates(user_id, awarded_at desc);
alter table public.mastery_certificates enable row level security;
revoke all on public.mastery_certificates from public, anon, authenticated;
grant select,insert,update,delete on public.mastery_certificates to service_role;
create or replace function public.claim_certificate_email(certificate_id uuid)
returns setof public.mastery_certificates language sql security invoker set search_path = '' as $$
  update public.mastery_certificates set email_status='sending',email_attempted_at=now()
  where id=certificate_id and (email_status in ('pending','failed') or (email_status='sending' and email_attempted_at < now()-interval '10 minutes'))
  returning *;
$$;
revoke all on function public.claim_certificate_email(uuid) from public,anon,authenticated;
grant execute on function public.claim_certificate_email(uuid) to service_role;
