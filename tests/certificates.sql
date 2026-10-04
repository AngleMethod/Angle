begin;
create temporary table certificate_checks (check_name text, passed boolean);
insert into auth.users(id,email) values ('c37f0000-0000-4000-8000-000000000001','certificate-fixture@example.invalid');
insert into public.mastery_certificates(id,user_id,recipient_name,recipient_email,skill)
values ('c37f0000-0000-4000-8000-000000000002','c37f0000-0000-4000-8000-000000000001','Certificate Fixture','certificate-fixture@example.invalid','Candle One-Arm Handstand');
insert into certificate_checks select 'Date is assigned by database in coach time zone',award_date=(now() at time zone 'America/Chicago')::date from public.mastery_certificates where id='c37f0000-0000-4000-8000-000000000002';
insert into certificate_checks select 'First email worker acquires lease',count(*)=1 from public.claim_certificate_email('c37f0000-0000-4000-8000-000000000002');
insert into certificate_checks select 'Second worker cannot send concurrently',count(*)=0 from public.claim_certificate_email('c37f0000-0000-4000-8000-000000000002');
update public.mastery_certificates set email_status='failed' where id='c37f0000-0000-4000-8000-000000000002';
insert into certificate_checks select 'Failed email can be retried',count(*)=1 from public.claim_certificate_email('c37f0000-0000-4000-8000-000000000002');
update public.mastery_certificates set email_status='sent' where id='c37f0000-0000-4000-8000-000000000002';
insert into certificate_checks select 'Sent email cannot be sent again',count(*)=0 from public.claim_certificate_email('c37f0000-0000-4000-8000-000000000002');
do $$ begin
  begin
    insert into public.mastery_certificates(id,user_id,recipient_name,recipient_email,skill)
    values ('c37f0000-0000-4000-8000-000000000003','c37f0000-0000-4000-8000-000000000001','Certificate Fixture','certificate-fixture@example.invalid',' candle one-arm handstand ');
    insert into certificate_checks values ('Duplicate skill blocked',false);
  exception when unique_violation then insert into certificate_checks values ('Duplicate skill blocked',true); end;
end $$;
insert into certificate_checks values ('Anonymous cannot read certificates',not has_table_privilege('anon','public.mastery_certificates','select')),
('Members cannot read other members through direct database access',not has_table_privilege('authenticated','public.mastery_certificates','select')),
('Members cannot award themselves certificates',not has_table_privilege('authenticated','public.mastery_certificates','insert')),
('Members cannot claim email delivery',not has_function_privilege('authenticated','public.claim_certificate_email(uuid)','execute')),
('RLS enabled',(select relrowsecurity from pg_class where oid='public.mastery_certificates'::regclass));
select * from certificate_checks;
rollback;
