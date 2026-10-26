-- LEGACY ONLY: upgrade the previous base schema, not the current schema.sql.
-- The current fresh-install workflow is schema.sql alone; do not run this file
-- after it. Retained only as a historical upgrade path for the old schema.
-- Existing rows are assigned to one tenant (LAB001); rename it before opening
-- onboarding. No existing business rows are dropped.

begin;

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  code varchar(24) not null unique,
  name varchar(180) not null,
  registration_number varchar(100),
  email varchar(254),
  phone varchar(32),
  address text,
  city varchar(120),
  country varchar(100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.clinics (code, name, country)
values ('LAB001', 'Existing Lab (update during onboarding)', null)
on conflict (code) do nothing;

alter table public.users
  add column clinic_id uuid,
  add column username varchar(80),
  add column staff_number integer generated always as identity,
  add column must_change_password boolean not null default true,
  add column last_sign_in_at timestamptz;

alter table public.patients
  add column clinic_id uuid,
  add column middle_name varchar(100),
  add column email varchar(254),
  add column country varchar(100),
  add column city varchar(120),
  add column house_number varchar(80),
  add column street varchar(160),
  add column valid_id_type varchar(100),
  add column valid_id_number varchar(120);

alter table public.test_catalog add column clinic_id uuid;
alter table public.reference_ranges add column clinic_id uuid;
alter table public.test_requests add column clinic_id uuid;
alter table public.request_items add column clinic_id uuid;
alter table public.queue_entries add column clinic_id uuid;
alter table public.payments add column clinic_id uuid;
alter table public.specimens add column clinic_id uuid;
alter table public.results add column clinic_id uuid;
alter table public.result_reviews add column clinic_id uuid;
alter table public.request_status_history add column clinic_id uuid;
alter table public.audit_logs add column clinic_id uuid;

do $$
declare tenant_id uuid;
begin
  select id into strict tenant_id from public.clinics where code = 'LAB001';

  update public.users set clinic_id = tenant_id where clinic_id is null;
  update public.patients set clinic_id = tenant_id where clinic_id is null;
  update public.test_catalog set clinic_id = tenant_id where clinic_id is null;
  update public.reference_ranges set clinic_id = tenant_id where clinic_id is null;
  update public.test_requests set clinic_id = tenant_id where clinic_id is null;
  update public.request_items set clinic_id = tenant_id where clinic_id is null;
  update public.queue_entries set clinic_id = tenant_id where clinic_id is null;
  update public.payments set clinic_id = tenant_id where clinic_id is null;
  update public.specimens set clinic_id = tenant_id where clinic_id is null;
  update public.results set clinic_id = tenant_id where clinic_id is null;
  update public.result_reviews set clinic_id = tenant_id where clinic_id is null;
  update public.request_status_history set clinic_id = tenant_id where clinic_id is null;
  update public.audit_logs set clinic_id = tenant_id where clinic_id is null;
end $$;

-- Stable, tenant-scoped username: role code + zero-padded staff number.
-- Names are omitted so a username does not expose personal data or change
-- when a staff member's legal name changes. Login also requires clinic code.
update public.users
set username = case role
  when 'cashier' then 'CSH-'
  when 'medical_technologist' then 'MLT-'
  when 'pathologist' then 'PTH-'
  when 'administrator' then 'ADM-'
  else null
end || lpad(staff_number::text, 6, '0')
where role <> 'patient' and username is null;

-- Allow newly created accounts to remain pending until a one-time activation
-- code is redeemed and a user-chosen password hash is set.
alter table public.users alter column password_hash drop not null;
alter table public.users alter column is_active set default false;

create or replace function public.assign_staff_username()
returns trigger
language plpgsql
as $$
declare role_code text;
begin
  if new.role = 'patient' then
    new.username := null;
    return new;
  end if;

  role_code := case new.role
    when 'cashier' then 'CSH'
    when 'medical_technologist' then 'MLT'
    when 'pathologist' then 'PTH'
    when 'administrator' then 'ADM'
  end;

  new.username := role_code || '-' || lpad(new.staff_number::text, 6, '0');
  return new;
end $$;

create trigger users_assign_staff_username
before insert or update of role, clinic_id, staff_number on public.users
for each row execute function public.assign_staff_username();

create table public.staff_profiles (
  user_id uuid primary key references public.users(id) on delete restrict,
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  first_name varchar(100) not null,
  middle_name varchar(100),
  last_name varchar(100) not null,
  date_of_birth date,
  phone varchar(32),
  country varchar(100),
  city varchar(120),
  house_number varchar(80),
  street varchar(160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_tokens (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  token_hash varchar(64) not null unique,
  purpose varchar(24) not null check (purpose in ('activation', 'password_reset')),
  expires_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint account_tokens_expiry_by_purpose_check
    check ((purpose = 'activation' and expires_at is null) or (purpose = 'password_reset' and expires_at is not null))
);
create index account_tokens_user_purpose_idx
  on public.account_tokens(user_id, purpose, expires_at);

-- Replace global business identifiers with clinic-scoped uniqueness.
alter table public.patients drop constraint if exists patients_pid_key;
alter table public.test_catalog drop constraint if exists test_catalog_code_key;
alter table public.payments drop constraint if exists payments_receipt_number_key;
alter table public.queue_entries drop constraint if exists queue_entries_date_number_unique;
alter table public.users drop constraint if exists users_email_key;

create unique index patients_clinic_pid_unique on public.patients(clinic_id, pid);
create unique index test_catalog_clinic_code_unique on public.test_catalog(clinic_id, code);
create unique index payments_clinic_receipt_number_unique
  on public.payments(clinic_id, receipt_number);
create unique index queue_entries_date_number_unique
  on public.queue_entries(clinic_id, queue_date, queue_number);
create unique index users_clinic_username_unique on public.users(clinic_id, username);
create unique index users_clinic_staff_number_unique on public.users(clinic_id, staff_number);
create unique index users_clinic_email_unique on public.users(clinic_id, email);
drop index if exists public.patients_name_idx;
create index patients_name_idx on public.patients(clinic_id, last_name, first_name);

-- Composite keys allow foreign keys to enforce same-tenant relationships,
-- even if a future backend handler accidentally mixes clinic-scoped IDs.
create unique index users_id_clinic_unique on public.users(id, clinic_id);
create unique index patients_id_clinic_unique on public.patients(id, clinic_id);
create unique index test_catalog_id_clinic_unique on public.test_catalog(id, clinic_id);
create unique index test_requests_id_clinic_unique on public.test_requests(id, clinic_id);
create unique index request_items_id_clinic_unique on public.request_items(id, clinic_id);

alter table public.users alter column clinic_id set not null;
alter table public.patients alter column clinic_id set not null;
alter table public.test_catalog alter column clinic_id set not null;
alter table public.reference_ranges alter column clinic_id set not null;
alter table public.test_requests alter column clinic_id set not null;
alter table public.request_items alter column clinic_id set not null;
alter table public.queue_entries alter column clinic_id set not null;
alter table public.payments alter column clinic_id set not null;
alter table public.specimens alter column clinic_id set not null;
alter table public.results alter column clinic_id set not null;
alter table public.result_reviews alter column clinic_id set not null;
alter table public.request_status_history alter column clinic_id set not null;
alter table public.audit_logs alter column clinic_id set not null;

alter table public.users add constraint users_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.patients add constraint patients_user_same_clinic_fk
  foreign key (user_id, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.patients add constraint patients_registrar_same_clinic_fk
  foreign key (registered_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.staff_profiles add constraint staff_profiles_user_same_clinic_fk
  foreign key (user_id, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.account_tokens add constraint account_tokens_user_same_clinic_fk
  foreign key (user_id, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.users add constraint users_staff_username_required
  check (role = 'patient' or username is not null);
alter table public.users drop constraint if exists users_staff_email_required;
alter table public.users add constraint users_staff_email_required
  check (role = 'patient' or email is not null);
alter table public.patients add constraint patients_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.test_catalog add constraint test_catalog_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.reference_ranges add constraint reference_ranges_test_same_clinic_fk
  foreign key (test_id, clinic_id) references public.test_catalog(id, clinic_id) on delete restrict;
alter table public.reference_ranges add constraint reference_ranges_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.test_requests add constraint test_requests_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.test_requests add constraint test_requests_patient_same_clinic_fk
  foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete restrict;
alter table public.test_requests add constraint test_requests_creator_same_clinic_fk
  foreign key (created_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.test_requests add constraint test_requests_releaser_same_clinic_fk
  foreign key (released_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.request_items add constraint request_items_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.request_items add constraint request_items_request_same_clinic_fk
  foreign key (request_id, clinic_id) references public.test_requests(id, clinic_id) on delete restrict;
alter table public.request_items add constraint request_items_test_same_clinic_fk
  foreign key (test_id, clinic_id) references public.test_catalog(id, clinic_id) on delete restrict;
alter table public.queue_entries add constraint queue_entries_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.queue_entries add constraint queue_entries_request_same_clinic_fk
  foreign key (request_id, clinic_id) references public.test_requests(id, clinic_id) on delete restrict;
alter table public.queue_entries add constraint queue_entries_caller_same_clinic_fk
  foreign key (called_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.payments add constraint payments_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.payments add constraint payments_request_same_clinic_fk
  foreign key (request_id, clinic_id) references public.test_requests(id, clinic_id) on delete restrict;
alter table public.payments add constraint payments_recorder_same_clinic_fk
  foreign key (recorded_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.specimens add constraint specimens_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.specimens add constraint specimens_request_same_clinic_fk
  foreign key (request_id, clinic_id) references public.test_requests(id, clinic_id) on delete restrict;
alter table public.specimens add constraint specimens_receiver_same_clinic_fk
  foreign key (received_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.results add constraint results_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.results add constraint results_request_item_same_clinic_fk
  foreign key (request_item_id, clinic_id) references public.request_items(id, clinic_id) on delete restrict;
alter table public.results add constraint results_encoder_same_clinic_fk
  foreign key (encoded_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.result_reviews add constraint result_reviews_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.result_reviews add constraint result_reviews_request_same_clinic_fk
  foreign key (request_id, clinic_id) references public.test_requests(id, clinic_id) on delete restrict;
alter table public.result_reviews add constraint result_reviews_reviewer_same_clinic_fk
  foreign key (reviewed_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.request_status_history add constraint request_status_history_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.request_status_history add constraint status_history_request_same_clinic_fk
  foreign key (request_id, clinic_id) references public.test_requests(id, clinic_id) on delete restrict;
alter table public.request_status_history add constraint status_history_actor_same_clinic_fk
  foreign key (changed_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.audit_logs add constraint audit_logs_clinic_fk
  foreign key (clinic_id) references public.clinics(id) on delete restrict;
alter table public.audit_logs add constraint audit_logs_actor_same_clinic_fk
  foreign key (actor_user_id, clinic_id) references public.users(id, clinic_id) on delete restrict;

alter table public.clinics enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.account_tokens enable row level security;
-- Existing tenant tables already have RLS enabled by schema.sql. No policies
-- are created here: direct Data API access remains denied until policies are
-- deliberately designed for the authenticated backend/app model.

commit;
