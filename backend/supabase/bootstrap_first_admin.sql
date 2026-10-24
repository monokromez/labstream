-- Create one demo clinic and its first Administrator after schema.sql.
-- This creates NO patients, tests, requests, specimens, results, or other demo data.
-- Edit the clinic name/code and email before running. Run only once per fresh DB.
-- The temporary output includes a one-time activation code; copy it privately.

with activation_secret as (
  select rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=') as code
),
clinic_row as (
  insert into public.clinics (code, name)
  values ('LABSTREAM-DEMO', 'Labstream Demo Clinic')
  returning id, code
),
admin_row as (
  insert into public.users (clinic_id, role, email, is_active, must_change_password)
  select c.id, 'administrator'::public.user_role, 'admin@labstream-demo.test', false, true
    from clinic_row c
  returning id, clinic_id, username
),
profile_row as (
  insert into public.staff_profiles (user_id, clinic_id, first_name, last_name, email)
  select a.id, a.clinic_id, 'Demo', 'Administrator', 'admin@labstream-demo.test'
    from admin_row a
  returning user_id
),
token_row as (
  insert into public.account_tokens (clinic_id, user_id, token_hash, purpose, expires_at)
  select a.clinic_id, a.id, encode(digest(s.code, 'sha256'), 'hex'), 'activation', now() + interval '24 hours'
    from admin_row a cross join activation_secret s
  returning user_id, expires_at
)
select c.code, a.username, s.code, t.expires_at
  from clinic_row c
  join admin_row a on a.clinic_id = c.id
  join profile_row p on p.user_id = a.id
  join token_row t on t.user_id = a.id
 cross join activation_secret s;
