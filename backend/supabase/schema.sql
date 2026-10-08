-- Labstream initial schema for a NEW, EMPTY Supabase PostgreSQL project.
-- Paste into Supabase Dashboard > SQL Editor > New query, then run once.

create type public.user_role as enum (
  'cashier',
  'medical_technologist',
  'pathologist',
  'administrator',
  'patient'
);

create type public.result_type as enum ('numeric', 'text');

create type public.request_status as enum (
  'queued',
  'paid',
  'specimen_received',
  'processing',
  'for_validation',
  'released',
  'cancelled'
);

create type public.queue_status as enum (
  'waiting',
  'called',
  'serving',
  'completed',
  'cancelled'
);

create type public.payment_method as enum ('cash', 'card', 'other');
create type public.review_decision as enum ('approved', 'returned');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email varchar(254) unique,
  password_hash varchar(255) not null,
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_staff_email_required
    check (role = 'patient' or email is not null)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete restrict,
  pid varchar(32) not null unique,
  first_name varchar(100) not null,
  last_name varchar(100) not null,
  date_of_birth date,
  sex varchar(32),
  phone varchar(32),
  address text,
  registered_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patients_name_idx on public.patients(last_name, first_name);

create table public.test_catalog (
  id uuid primary key default gen_random_uuid(),
  code varchar(40) not null unique,
  name varchar(160) not null,
  description text,
  result_type public.result_type not null,
  unit varchar(40),
  price numeric(10, 2) not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reference_ranges (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.test_catalog(id) on delete restrict,
  min_age_days integer,
  max_age_days integer,
  sex varchar(32),
  numeric_min numeric(14, 4),
  numeric_max numeric(14, 4),
  text_guidance text,
  unit varchar(40),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reference_ranges_age_order
    check (min_age_days is null or max_age_days is null or min_age_days <= max_age_days),
  constraint reference_ranges_numeric_order
    check (numeric_min is null or numeric_max is null or numeric_min <= numeric_max)
);

create index reference_ranges_test_active_idx
  on public.reference_ranges(test_id, is_active);

create table public.test_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  created_by uuid not null references public.users(id) on delete restrict,
  status public.request_status not null default 'queued',
  total_amount numeric(10, 2) not null default 0 check (total_amount >= 0),
  paid_at timestamptz,
  released_at timestamptz,
  released_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index test_requests_patient_created_idx
  on public.test_requests(patient_id, created_at);
create index test_requests_status_created_idx
  on public.test_requests(status, created_at);

create table public.request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.test_requests(id) on delete restrict,
  test_id uuid not null references public.test_catalog(id) on delete restrict,
  test_name_snapshot varchar(160) not null,
  price_snapshot numeric(10, 2) not null check (price_snapshot >= 0),
  result_type_snapshot public.result_type not null,
  unit_snapshot varchar(40),
  created_at timestamptz not null default now()
);

create index request_items_request_idx on public.request_items(request_id);

create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.test_requests(id) on delete restrict,
  queue_date date not null default current_date,
  queue_number integer not null check (queue_number > 0),
  status public.queue_status not null default 'waiting',
  called_at timestamptz,
  completed_at timestamptz,
  called_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint queue_entries_date_number_unique unique (queue_date, queue_number)
);

create index queue_entries_date_status_idx
  on public.queue_entries(queue_date, status);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.test_requests(id) on delete restrict,
  amount numeric(10, 2) not null check (amount > 0),
  method public.payment_method not null,
  receipt_number varchar(64) not null unique,
  recorded_by uuid not null references public.users(id) on delete restrict,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index payments_request_idx on public.payments(request_id);
create index payments_paid_at_idx on public.payments(paid_at);

create table public.specimens (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.test_requests(id) on delete restrict,
  specimen_type varchar(100) not null,
  received_by uuid not null references public.users(id) on delete restrict,
  received_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index specimens_request_idx on public.specimens(request_id);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  request_item_id uuid not null unique references public.request_items(id) on delete restrict,
  numeric_value numeric(14, 4),
  text_value text,
  unit varchar(40),
  reference_min_snapshot numeric(14, 4),
  reference_max_snapshot numeric(14, 4),
  is_abnormal boolean not null default false,
  remarks text,
  encoded_by uuid not null references public.users(id) on delete restrict,
  encoded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint results_exactly_one_value
    check (num_nonnulls(numeric_value, text_value) = 1),
  constraint results_reference_order
    check (
      reference_min_snapshot is null
      or reference_max_snapshot is null
      or reference_min_snapshot <= reference_max_snapshot
    )
);

create table public.result_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.test_requests(id) on delete restrict,
  reviewed_by uuid not null references public.users(id) on delete restrict,
  decision public.review_decision not null,
  comments text,
  reviewed_at timestamptz not null default now()
);

create index result_reviews_request_time_idx
  on public.result_reviews(request_id, reviewed_at);

create table public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.test_requests(id) on delete restrict,
  old_status public.request_status,
  new_status public.request_status not null,
  changed_by uuid references public.users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  note text
);

create index request_status_history_request_time_idx
  on public.request_status_history(request_id, changed_at);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  action varchar(100) not null,
  entity_type varchar(100) not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_time_idx
  on public.audit_logs(actor_user_id, created_at);
create index audit_logs_entity_idx
  on public.audit_logs(entity_type, entity_id);

-- Defense in depth: deny direct Supabase Data API access until policies are
-- deliberately designed. The server-side backend must still enforce roles.
alter table public.users enable row level security;
alter table public.patients enable row level security;
alter table public.test_catalog enable row level security;
alter table public.reference_ranges enable row level security;
alter table public.test_requests enable row level security;
alter table public.request_items enable row level security;
alter table public.queue_entries enable row level security;
alter table public.payments enable row level security;
alter table public.specimens enable row level security;
alter table public.results enable row level security;
alter table public.result_reviews enable row level security;
alter table public.request_status_history enable row level security;
alter table public.audit_logs enable row level security;
