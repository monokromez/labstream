-- Run once against an existing Labstream database before deploying this version.
alter table public.test_catalog
  add column if not exists current_configuration_version integer not null default 1;

create table if not exists public.test_configuration_versions (
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
alter table public.test_configuration_versions enable row level security;

insert into public.test_configuration_versions (clinic_id, test_id, version_number)
select clinic_id, id, 1 from public.test_catalog
on conflict (test_id, version_number) do nothing;

alter table public.test_specimen_requirements
  add column if not exists configuration_version integer not null default 1;
alter table public.test_analytes
  add column if not exists configuration_version integer not null default 1;
alter table public.request_items
  add column if not exists configuration_version integer not null default 1;

alter table public.test_specimen_requirements
  drop constraint if exists test_specimen_requirements_test_id_specimen_type_key;
alter table public.test_specimen_requirements
  add constraint test_specimen_requirements_version_type_key
  unique (test_id, configuration_version, specimen_type);
alter table public.test_analytes
  drop constraint if exists test_analytes_test_id_key_key;
alter table public.test_analytes
  add constraint test_analytes_version_key
  unique (test_id, configuration_version, key);

alter table public.test_specimen_requirements
  add constraint test_specimen_requirements_configuration_version_fk
  foreign key (test_id, configuration_version, clinic_id)
  references public.test_configuration_versions(test_id, version_number, clinic_id) on delete restrict;
alter table public.test_analytes
  add constraint test_analytes_configuration_version_fk
  foreign key (test_id, configuration_version, clinic_id)
  references public.test_configuration_versions(test_id, version_number, clinic_id) on delete restrict;
alter table public.request_items
  add constraint request_items_configuration_version_fk
  foreign key (test_id, configuration_version, clinic_id)
  references public.test_configuration_versions(test_id, version_number, clinic_id) on delete restrict;

update public.test_catalog set current_configuration_version = 1;
update public.request_items set configuration_version = 1;

alter table public.payments add constraint payments_id_clinic_key unique (id, clinic_id);
create table if not exists public.payment_refunds (
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
alter table public.payment_refunds enable row level security;

alter table public.invoices drop constraint if exists invoices_payment_id_key;
alter table public.invoices add constraint invoices_id_clinic_key unique (id, clinic_id);
alter table public.invoices
  add column if not exists corrected_at timestamptz,
  add column if not exists corrected_by uuid,
  add column if not exists correction_reason text,
  add column if not exists corrected_invoice_id uuid;
alter table public.invoices
  add constraint invoices_corrected_by_clinic_fk
  foreign key (corrected_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
alter table public.invoices
  add constraint invoices_corrected_invoice_fk
  foreign key (corrected_invoice_id, clinic_id) references public.invoices(id, clinic_id) on delete restrict;
create index if not exists invoices_payment_idx on public.invoices(clinic_id, payment_id, issued_at desc);
