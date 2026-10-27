-- Run against an existing Labstream database before deploying staff account deletion.
-- Deleting a staff account keeps the users row (audit history references it) but
-- hides it from the staff list and erases the personal details stored in staff_profiles.
alter table public.users
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_deleted_by_clinic_fk'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_deleted_by_clinic_fk
      foreign key (deleted_by, clinic_id) references public.users(id, clinic_id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'users_deletion_state_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_deletion_state_check
      check ((deleted_at is null and deleted_by is null)
          or (deleted_at is not null and deleted_by is not null and is_active = false));
  end if;
end $$;

create index if not exists users_clinic_active_idx
  on public.users (clinic_id, role)
  where deleted_at is null;
