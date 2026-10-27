-- Run against an existing Labstream database before deploying patient archiving.
alter table public.patients
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists archive_reason text,
  add column if not exists archived_portal_user_was_active boolean;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'patients_archived_by_clinic_fk'
      and conrelid = 'public.patients'::regclass
  ) then
    alter table public.patients
      add constraint patients_archived_by_clinic_fk
      foreign key (archived_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'patients_archive_state_check'
      and conrelid = 'public.patients'::regclass
  ) then
    alter table public.patients
      add constraint patients_archive_state_check
      check ((archived_at is null and archived_by is null and archive_reason is null and archived_portal_user_was_active is null)
          or (archived_at is not null and archived_by is not null and archive_reason is not null));
  end if;
end $$;
