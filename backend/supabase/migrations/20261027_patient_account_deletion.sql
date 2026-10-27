-- Run against an existing Labstream database before deploying patient account deletion.
-- A deleted patient keeps its row so clinical history stays intact, but is hidden from
-- the registry and its portal login is removed. Only archived patients can be deleted.
alter table public.patients
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'patients_deleted_by_clinic_fk'
      and conrelid = 'public.patients'::regclass
  ) then
    alter table public.patients
      add constraint patients_deleted_by_clinic_fk
      foreign key (deleted_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'patients_deletion_state_check'
      and conrelid = 'public.patients'::regclass
  ) then
    alter table public.patients
      add constraint patients_deletion_state_check
      check ((deleted_at is null and deleted_by is null)
          or (deleted_at is not null and deleted_by is not null and archived_at is not null));
  end if;
end $$;

create index if not exists patients_clinic_registry_idx
  on public.patients (clinic_id, last_name, first_name)
  where deleted_at is null;
