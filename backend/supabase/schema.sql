-- Labstream end-to-end workflow schema (fresh Supabase project).
-- Run reset.sql only when intentionally discarding Labstream data, then run this file.
-- Do not expose password_hash or account_tokens through client APIs. Backend code
-- must enforce roles, the single-laboratory scope, assignments, validation, and state transitions.

create extension if not exists pgcrypto;

create type public.user_role as enum ('administrator', 'cashier', 'medical_technologist', 'pathologist', 'patient');
create type public.request_status as enum ('awaiting_payment', 'paid', 'specimen_collection', 'processing', 'for_validation', 'correction', 'released', 'cancelled');
create type public.request_item_status as enum ('awaiting_specimen', 'specimen_received', 'processing', 'drafted', 'completed', 'submitted', 'returned', 'for_recollection', 'approved', 'released', 'cancelled');
create type public.specimen_status as enum ('expected', 'received', 'accepted', 'rejected', 'for_recollection', 'consumed');
create type public.result_value_type as enum ('numeric', 'text', 'select', 'boolean', 'structured');
create type public.result_status as enum ('draft', 'submitted', 'returned', 'approved');
create type public.review_decision as enum ('approved', 'returned');
create type public.payment_method as enum ('cash', 'waiver');

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  instance_slot smallint not null default 1 unique check (instance_slot = 1),
  code varchar(24) not null unique,
  name varchar(180) not null,
  registration_number varchar(100),
  email varchar(254), phone varchar(32),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  role public.user_role not null,
  staff_number integer generated always as identity,
  username varchar(80), email varchar(254), password_hash varchar(255),
  is_active boolean not null default false,
  must_change_password boolean not null default true,
  last_sign_in_at timestamptz,
  deleted_at timestamptz, deleted_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  unique (clinic_id, username), unique (clinic_id, staff_number), unique (clinic_id, email),
  check ((role = 'patient') or (username is not null and email is not null)),
  foreign key (deleted_by, clinic_id) references public.users(id, clinic_id) on delete restrict,
  check ((deleted_at is null and deleted_by is null)
      or (deleted_at is not null and deleted_by is not null and is_active = false))
);

create function public.set_staff_username() returns trigger language plpgsql as $$
declare role_prefix text;
begin
  if new.role = 'patient' then new.username := null; return new; end if;
  role_prefix := case new.role
    when 'cashier' then 'CSH' when 'medical_technologist' then 'MLT'
    when 'pathologist' then 'PTH' when 'administrator' then 'ADM' end;
  new.username := role_prefix || '-' || lpad(new.staff_number::text, 6, '0');
  return new;
end $$;
create trigger users_set_staff_username before insert or update of role, staff_number
on public.users for each row execute function public.set_staff_username();

create table public.staff_profiles (
  user_id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  first_name varchar(100) not null, middle_name varchar(100), last_name varchar(100) not null,
  date_of_birth date, phone varchar(32), email varchar(254),
  country varchar(100), city varchar(120), house_number varchar(80), street varchar(160),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (user_id, clinic_id) references public.users(id, clinic_id) on delete restrict
);

create table public.account_tokens (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  user_id uuid not null,
  token_hash varchar(64) not null unique,
  purpose varchar(24) not null check (purpose in ('activation', 'password_reset')),
  expires_at timestamptz not null, consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint account_tokens_expiry_by_purpose_check
    check (expires_at is not null),
  foreign key (user_id, clinic_id) references public.users(id, clinic_id) on delete restrict
);
create index account_tokens_user_idx on public.account_tokens(user_id, purpose, expires_at);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  portal_user_id uuid unique,
  pid varchar(32) not null,
  first_name varchar(100) not null, middle_name varchar(100), last_name varchar(100) not null,
  date_of_birth date not null, sex varchar(32) not null,
  email varchar(254), phone varchar(32) not null,
  country varchar(100) not null, city varchar(120) not null,
  house_number varchar(80), street varchar(160),
  valid_id_type varchar(100) not null, valid_id_number varchar(120) not null,
  registered_by uuid not null,
  archived_at timestamptz, archived_by uuid, archive_reason text,
  archived_portal_user_was_active boolean,
  deleted_at timestamptz, deleted_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, clinic_id), unique (clinic_id, pid),
  foreign key (portal_user_id, clinic_id) references public.users(id, clinic_id) on delete restrict,
  foreign key (registered_by, clinic_id) references public.users(id, clinic_id) on delete restrict,
  foreign key (archived_by, clinic_id) references public.users(id, clinic_id) on delete restrict,
  foreign key (deleted_by, clinic_id) references public.users(id, clinic_id) on delete restrict,
  check ((archived_at is null and archived_by is null and archive_reason is null and archived_portal_user_was_active is null)
      or (archived_at is not null and archived_by is not null and archive_reason is not null)),
  check ((deleted_at is null and deleted_by is null)
      or (deleted_at is not null and deleted_by is not null and archived_at is not null))
);
create index patients_name_idx on public.patients(clinic_id, last_name, first_name);

create table public.test_categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  name varchar(120) not null, description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, clinic_id), unique (clinic_id, name)
);

create table public.test_catalog (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  category_id uuid not null,
  code varchar(40) not null, name varchar(160) not null, description text,
  price numeric(10,2) not null check (price >= 0),
  turnaround_minutes integer check (turnaround_minutes is null or turnaround_minutes > 0),
  is_available boolean not null default false,
  current_configuration_version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, clinic_id), unique (clinic_id, code),
  foreign key (category_id, clinic_id) references public.test_categories(id, clinic_id) on delete restrict
);
create index test_catalog_category_idx on public.test_catalog(clinic_id, category_id, is_available);

create table public.test_configuration_versions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  test_id uuid not null,
  version_number integer not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (test_id, version_number),
  unique (test_id, version_number, clinic_id),
  foreign key (test_id, clinic_id) references public.test_catalog(id, clinic_id) on delete restrict,
  foreign key (created_by, clinic_id) references public.users(id, clinic_id) on delete restrict,
  check (version_number > 0)
);

-- A canonical billable test may be browsed under multiple categories. The
-- category_id above remains its primary category for historical snapshots.
create table public.test_category_memberships (
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  test_id uuid not null, category_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (test_id, category_id),
  foreign key (test_id, clinic_id) references public.test_catalog(id, clinic_id) on delete restrict,
  foreign key (category_id, clinic_id) references public.test_categories(id, clinic_id) on delete restrict
);
create index test_category_memberships_category_idx on public.test_category_memberships(clinic_id, category_id, test_id);

-- Tests may require more than one specimen. This relation lets payment create
-- the correct specimen work items for each requested test.
create table public.test_specimen_requirements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  test_id uuid not null, configuration_version integer not null default 1, specimen_type varchar(100) not null,
  collection_instructions text, minimum_quantity numeric(10,2), quantity_unit varchar(40),
  is_required boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (test_id, configuration_version, specimen_type),
  foreign key (test_id, clinic_id) references public.test_catalog(id, clinic_id) on delete restrict,
  foreign key (test_id, configuration_version, clinic_id)
    references public.test_configuration_versions(test_id, version_number, clinic_id) on delete restrict,
  check (minimum_quantity is null or minimum_quantity > 0)
);
create index test_specimen_requirements_test_idx on public.test_specimen_requirements(clinic_id, test_id);

create table public.test_analytes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  test_id uuid not null, configuration_version integer not null default 1,
  key varchar(80) not null, label varchar(160) not null,
  value_type public.result_value_type not null,
  options jsonb not null default '[]'::jsonb,
  unit varchar(40), sort_order integer not null default 0,
  is_required boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, clinic_id), unique (test_id, configuration_version, key),
  foreign key (test_id, clinic_id) references public.test_catalog(id, clinic_id) on delete restrict,
  foreign key (test_id, configuration_version, clinic_id)
    references public.test_configuration_versions(test_id, version_number, clinic_id) on delete restrict,
  check (jsonb_typeof(options) = 'array')
);

create table public.reference_ranges (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  analyte_id uuid not null,
  sex varchar(32), min_age_days integer, max_age_days integer,
  lower_limit numeric(14,4), upper_limit numeric(14,4), unit varchar(40), guidance text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (analyte_id, clinic_id) references public.test_analytes(id, clinic_id) on delete restrict,
  check (min_age_days is null or max_age_days is null or min_age_days <= max_age_days),
  check (lower_limit is null or upper_limit is null or lower_limit <= upper_limit)
);
create index reference_ranges_analyte_idx on public.reference_ranges(analyte_id, is_active);

create function public.require_reference_range_for_available_test()
returns trigger language plpgsql as $$
begin
  if new.is_available and not exists (
    select 1
      from public.test_analytes a
      join public.reference_ranges rr on rr.analyte_id = a.id and rr.clinic_id = a.clinic_id and rr.is_active = true
     where a.test_id = new.id and a.clinic_id = new.clinic_id
       and a.configuration_version = new.current_configuration_version
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'test_catalog_reference_range_required',
      message = 'An active reference range is required before a test can be made available.';
  end if;
  return new;
end;
$$;

create trigger test_catalog_reference_range_required
before insert or update of is_available, current_configuration_version on public.test_catalog
for each row execute function public.require_reference_range_for_available_test();

create function public.prevent_removing_last_range_from_available_test()
returns trigger language plpgsql as $$
declare
  target_test_id uuid;
  test_is_available boolean;
begin
  if old.is_active and (not new.is_active or new.analyte_id is distinct from old.analyte_id) then
    select t.id, t.is_available into target_test_id, test_is_available
      from public.test_analytes a
      join public.test_catalog t on t.id = a.test_id and t.clinic_id = a.clinic_id
     where a.id = old.analyte_id and a.clinic_id = old.clinic_id
       and a.configuration_version = t.current_configuration_version;
    if coalesce(test_is_available, false) and not exists (
      select 1
        from public.test_analytes a
        join public.reference_ranges rr on rr.analyte_id = a.id and rr.clinic_id = a.clinic_id
       where a.test_id = target_test_id and a.clinic_id = old.clinic_id
         and a.configuration_version = (select current_configuration_version from public.test_catalog where id = target_test_id and clinic_id = old.clinic_id)
         and rr.is_active = true and rr.id <> old.id
    ) then
      raise exception using
        errcode = '23514',
        constraint = 'available_test_requires_reference_range',
        message = 'Archive this test before removing its last active reference range.';
    end if;
  end if;
  return new;
end;
$$;

create trigger available_test_requires_reference_range
before update of is_active, analyte_id on public.reference_ranges
for each row execute function public.prevent_removing_last_range_from_available_test();

create table public.test_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  request_number varchar(32) not null,
  patient_id uuid not null,
  created_by uuid not null,
  status public.request_status not null default 'awaiting_payment',
  priority varchar(16) not null default 'routine' check (priority in ('routine','urgent')),
  total_amount numeric(10,2) not null default 0 check (total_amount >= 0),
  assigned_technologist_id uuid,
  assigned_pathologist_id uuid,
  queue_ticket bigint generated always as identity,
  queue_called_at timestamptz,
  queue_called_by uuid,
  requested_at timestamptz not null default now(), paid_at timestamptz,
  released_at timestamptz, cancelled_at timestamptz, cancellation_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, clinic_id), unique (clinic_id, request_number), unique (queue_ticket),
  foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete restrict,
  foreign key (created_by, clinic_id) references public.users(id, clinic_id) on delete restrict,
  foreign key (assigned_technologist_id, clinic_id) references public.users(id, clinic_id) on delete restrict,
  foreign key (assigned_pathologist_id, clinic_id) references public.users(id, clinic_id) on delete restrict,
  foreign key (queue_called_by, clinic_id) references public.users(id, clinic_id) on delete restrict
);

-- Assignment foreign keys prove laboratory membership; this trigger additionally
-- verifies that assigned accounts have the correct active role.
create function public.validate_request_assignments() returns trigger language plpgsql as $$
declare assigned_role public.user_role; assigned_active boolean;
begin
  if new.assigned_technologist_id is not null then
    select role, is_active into assigned_role, assigned_active
      from public.users where id = new.assigned_technologist_id and clinic_id = new.clinic_id;
    if assigned_role <> 'medical_technologist' or not assigned_active then
      raise exception 'Assigned technologist must be an active medical technologist in this clinic';
    end if;
  end if;
  if new.assigned_pathologist_id is not null then
    select role, is_active into assigned_role, assigned_active
      from public.users where id = new.assigned_pathologist_id and clinic_id = new.clinic_id;
    if assigned_role <> 'pathologist' or not assigned_active then
      raise exception 'Assigned pathologist must be an active pathologist in this clinic';
    end if;
  end if;
  return new;
end $$;
create trigger test_requests_validate_assignments before insert or update of assigned_technologist_id, assigned_pathologist_id
on public.test_requests for each row execute function public.validate_request_assignments();
create index test_requests_patient_idx on public.test_requests(patient_id, requested_at desc);
create index test_requests_status_idx on public.test_requests(clinic_id, status, requested_at);
create unique index test_requests_one_unpaid_per_patient
  on public.test_requests(clinic_id, patient_id) where status = 'awaiting_payment';
create unique index test_requests_one_called_per_laboratory
  on public.test_requests(clinic_id)
  where status = 'awaiting_payment' and queue_called_at is not null;
create index test_requests_queue_order_idx
  on public.test_requests(clinic_id, requested_at, queue_ticket)
  where status = 'awaiting_payment';

create table public.request_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  request_id uuid not null, test_id uuid not null, configuration_version integer not null default 1,
  test_code_snapshot varchar(40) not null, test_name_snapshot varchar(160) not null,
  category_name_snapshot varchar(120) not null,
  price_snapshot numeric(10,2) not null check (price_snapshot >= 0),
  status public.request_item_status not null default 'awaiting_specimen',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, clinic_id), unique (id, request_id, clinic_id),
  foreign key (request_id, clinic_id) references public.test_requests(id, clinic_id) on delete restrict,
  foreign key (test_id, clinic_id) references public.test_catalog(id, clinic_id) on delete restrict,
  foreign key (test_id, configuration_version, clinic_id)
    references public.test_configuration_versions(test_id, version_number, clinic_id) on delete restrict
);
create index request_items_request_idx on public.request_items(request_id, status);

-- This is the cashier payment queue. Physical walk-in/service queue is separate
-- and intentionally not conflated with test requests or payment state.
create view public.cashier_payment_queue with (security_invoker = true) as
select r.id, r.clinic_id, r.request_number, r.patient_id, p.pid,
       concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
       r.total_amount, r.priority, r.requested_at
from public.test_requests r join public.patients p on p.id = r.patient_id
where r.status = 'awaiting_payment';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  request_id uuid not null unique,
  amount numeric(10,2) not null check (amount >= 0),
  method public.payment_method not null default 'cash',
  recorded_by uuid not null, paid_at timestamptz not null default now(),
  voided_at timestamptz, voided_by uuid, void_reason text,
  created_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (request_id, clinic_id) references public.test_requests(id, clinic_id) on delete restrict,
  foreign key (recorded_by, clinic_id) references public.users(id, clinic_id) on delete restrict,
  foreign key (voided_by, clinic_id) references public.users(id, clinic_id) on delete restrict
);
create index payments_date_idx on public.payments(clinic_id, paid_at desc);

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  payment_id uuid not null,
  amount numeric(10,2) not null check (amount > 0),
  reason text not null,
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  foreign key (payment_id, clinic_id) references public.payments(id, clinic_id) on delete restrict,
  foreign key (recorded_by, clinic_id) references public.users(id, clinic_id) on delete restrict,
  unique (payment_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  invoice_number varchar(64) not null,
  issued_at timestamptz not null default now(),
  corrected_at timestamptz,
  corrected_by uuid,
  correction_reason text,
  corrected_invoice_id uuid,
  unique (id, clinic_id),
  foreign key (corrected_by, clinic_id) references public.users(id, clinic_id) on delete restrict,
  foreign key (corrected_invoice_id, clinic_id) references public.invoices(id, clinic_id) on delete restrict,
  unique (clinic_id, invoice_number)
);
create index invoices_payment_idx on public.invoices(clinic_id, payment_id, issued_at desc);

create table public.specimens (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  request_id uuid not null,
  specimen_type varchar(100) not null,
  attempt_number integer not null default 1 check (attempt_number > 0),
  replaces_specimen_id uuid,
  status public.specimen_status not null default 'expected',
  collected_at timestamptz, received_at timestamptz, received_by uuid,
  accepted_at timestamptz, rejected_at timestamptz, rejection_reason text,
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, clinic_id), unique (id, request_id, clinic_id),
  unique (request_id, specimen_type, attempt_number),
  foreign key (request_id, clinic_id) references public.test_requests(id, clinic_id) on delete restrict,
  foreign key (replaces_specimen_id, clinic_id) references public.specimens(id, clinic_id) on delete restrict,
  foreign key (received_by, clinic_id) references public.users(id, clinic_id) on delete restrict
);
create index specimens_worklist_idx on public.specimens(clinic_id, status, created_at);

create table public.specimen_request_items (
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  request_id uuid not null, specimen_id uuid not null, request_item_id uuid not null,
  primary key (specimen_id, request_item_id),
  foreign key (specimen_id, request_id, clinic_id) references public.specimens(id, request_id, clinic_id) on delete restrict,
  foreign key (request_item_id, request_id, clinic_id) references public.request_items(id, request_id, clinic_id) on delete restrict
);

create table public.result_submissions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  request_id uuid not null, request_item_id uuid not null, specimen_id uuid not null,
  revision_number integer not null check (revision_number > 0),
  status public.result_status not null default 'draft',
  entered_by uuid not null, entered_at timestamptz not null default now(),
  submitted_at timestamptz, pathologist_interpretation text,
  supersedes_result_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, clinic_id), unique (id, request_id, clinic_id), unique (request_item_id, revision_number),
  foreign key (request_item_id, request_id, clinic_id) references public.request_items(id, request_id, clinic_id) on delete restrict,
  foreign key (specimen_id, request_id, clinic_id) references public.specimens(id, request_id, clinic_id) on delete restrict,
  foreign key (supersedes_result_id, clinic_id) references public.result_submissions(id, clinic_id) on delete restrict,
  foreign key (entered_by, clinic_id) references public.users(id, clinic_id)
);
create index result_submissions_worklist_idx on public.result_submissions(clinic_id, status, submitted_at);

-- A test may require multiple specimen types; this records every specimen used
-- for one test result while specimen_id remains its primary specimen reference.
create table public.result_submission_specimens (
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  request_id uuid not null, result_submission_id uuid not null, specimen_id uuid not null,
  primary key (result_submission_id, specimen_id),
  foreign key (result_submission_id, request_id, clinic_id) references public.result_submissions(id, request_id, clinic_id) on delete restrict,
  foreign key (specimen_id, request_id, clinic_id) references public.specimens(id, request_id, clinic_id) on delete restrict
);

create function public.validate_result_submission_actor() returns trigger language plpgsql as $$
declare assigned_technologist uuid; actor_role public.user_role; actor_active boolean;
begin
  select r.assigned_technologist_id, u.role, u.is_active
    into assigned_technologist, actor_role, actor_active
    from public.test_requests r
    join public.users u on u.id = new.entered_by and u.clinic_id = new.clinic_id
   where r.id = new.request_id and r.clinic_id = new.clinic_id;
  if assigned_technologist is distinct from new.entered_by
     or actor_role <> 'medical_technologist' or not actor_active then
    raise exception 'Only the active assigned medical technologist may enter request results';
  end if;
  return new;
end $$;
create trigger result_submissions_validate_actor before insert or update of entered_by, request_id
on public.result_submissions for each row execute function public.validate_result_submission_actor();

create table public.result_values (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  result_submission_id uuid not null, analyte_id uuid not null,
  numeric_value numeric(14,4), text_value text, select_value text, boolean_value boolean, structured_value jsonb,
  unit_snapshot varchar(40),
  lower_limit_snapshot numeric(14,4), upper_limit_snapshot numeric(14,4),
  is_abnormal boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (result_submission_id, analyte_id),
  foreign key (result_submission_id, clinic_id) references public.result_submissions(id, clinic_id) on delete restrict,
  foreign key (analyte_id, clinic_id) references public.test_analytes(id, clinic_id) on delete restrict,
  check (num_nonnulls(numeric_value, text_value, select_value, boolean_value, structured_value) = 1),
  check (structured_value is null or case when jsonb_typeof(structured_value) = 'array' then jsonb_array_length(structured_value) > 0 else false end),
  check (lower_limit_snapshot is null or upper_limit_snapshot is null or lower_limit_snapshot <= upper_limit_snapshot)
);

-- A result's selected analyte must belong to the test represented by its
-- request item, and its value column must match the catalog analyte's type.
create function public.validate_result_value() returns trigger language plpgsql as $$
declare expected_test uuid; expected_type public.result_value_type; expected_options jsonb;
begin
  select ri.test_id, a.value_type, a.options into expected_test, expected_type, expected_options
    from public.result_submissions rs
    join public.request_items ri on ri.id = rs.request_item_id and ri.clinic_id = rs.clinic_id
    join public.test_analytes a on a.id = new.analyte_id and a.clinic_id = new.clinic_id
   where rs.id = new.result_submission_id and rs.clinic_id = new.clinic_id;
  if expected_test is null or not exists (
    select 1 from public.test_analytes a
     where a.id = new.analyte_id and a.test_id = expected_test and a.clinic_id = new.clinic_id
  ) then
    raise exception 'Result analyte does not belong to the requested test';
  end if;
  if (expected_type = 'numeric' and num_nonnulls(new.numeric_value) <> 1)
     or (expected_type = 'text' and num_nonnulls(new.text_value) <> 1)
     or (expected_type = 'select' and num_nonnulls(new.select_value) <> 1)
     or (expected_type = 'boolean' and num_nonnulls(new.boolean_value) <> 1)
     or (expected_type = 'structured' and (num_nonnulls(new.structured_value) <> 1 or jsonb_typeof(new.structured_value) <> 'array')) then
    raise exception 'Result value does not match the analyte value type';
  end if;
  if expected_type = 'select' and not (expected_options ? new.select_value) then
    raise exception 'Selected result is not one of the analyte options';
  end if;
  if expected_type = 'structured' and exists (
    select 1 from jsonb_array_elements(new.structured_value) as rows(value)
    where jsonb_typeof(rows.value) <> 'object'
       or exists (select 1 from jsonb_object_keys(rows.value) as keys(column_name) where not (expected_options ? keys.column_name))
  ) then
    raise exception 'Structured result rows must use configured columns';
  end if;
  return new;
end $$;
create trigger result_values_validate before insert or update on public.result_values
for each row execute function public.validate_result_value();

create table public.result_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  result_submission_id uuid not null,
  reviewed_by uuid not null, decision public.review_decision not null,
  remarks text, requires_retest boolean not null default false,
  reviewed_at timestamptz not null default now(),
  foreign key (result_submission_id, clinic_id) references public.result_submissions(id, clinic_id) on delete restrict,
  foreign key (reviewed_by, clinic_id) references public.users(id, clinic_id) on delete restrict,
  check (decision <> 'returned' or nullif(btrim(remarks), '') is not null)
);
create index result_reviews_result_time_idx on public.result_reviews(result_submission_id, reviewed_at desc);

create function public.validate_result_reviewer() returns trigger language plpgsql as $$
declare request_id_value uuid; assigned_pathologist uuid; actor_role public.user_role; actor_active boolean;
begin
  select rs.request_id, r.assigned_pathologist_id, u.role, u.is_active
    into request_id_value, assigned_pathologist, actor_role, actor_active
    from public.result_submissions rs
    join public.test_requests r on r.id = rs.request_id and r.clinic_id = rs.clinic_id
    join public.users u on u.id = new.reviewed_by and u.clinic_id = new.clinic_id
   where rs.id = new.result_submission_id and rs.clinic_id = new.clinic_id;
  if assigned_pathologist is distinct from new.reviewed_by
     or actor_role <> 'pathologist' or not actor_active then
    raise exception 'Only the active assigned pathologist may review request results';
  end if;
  return new;
end $$;
create trigger result_reviews_validate_actor before insert or update on public.result_reviews
for each row execute function public.validate_result_reviewer();

create table public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  request_id uuid not null, old_status public.request_status, new_status public.request_status not null,
  changed_by uuid, note text, changed_at timestamptz not null default now(),
  foreign key (request_id, clinic_id) references public.test_requests(id, clinic_id) on delete restrict,
  foreign key (changed_by, clinic_id) references public.users(id, clinic_id) on delete restrict
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  actor_user_id uuid, action varchar(100) not null,
  entity_type varchar(100) not null, entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (actor_user_id, clinic_id) references public.users(id, clinic_id) on delete restrict
);
create index audit_logs_clinic_time_idx on public.audit_logs(clinic_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

-- Keep update timestamps consistent for tables that expose updated_at.
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
do $$
declare target record;
begin
  for target in
    select table_name from information_schema.columns
     where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      target.table_name || '_touch_updated_at', target.table_name);
  end loop;
end $$;

-- Deliberately enable RLS without client policies. Until policies are designed,
-- client-side Supabase Data API access is denied; privileged access stays server-side.
alter table public.clinics enable row level security;
alter table public.users enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.account_tokens enable row level security;
alter table public.patients enable row level security;
alter table public.test_categories enable row level security;
alter table public.test_catalog enable row level security;
alter table public.test_configuration_versions enable row level security;
alter table public.test_category_memberships enable row level security;
alter table public.test_specimen_requirements enable row level security;
alter table public.test_analytes enable row level security;
alter table public.reference_ranges enable row level security;
alter table public.test_requests enable row level security;
alter table public.request_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.invoices enable row level security;
alter table public.specimens enable row level security;
alter table public.specimen_request_items enable row level security;
alter table public.result_submissions enable row level security;
alter table public.result_submission_specimens enable row level security;
alter table public.result_values enable row level security;
alter table public.result_reviews enable row level security;
alter table public.request_status_history enable row level security;
alter table public.audit_logs enable row level security;
