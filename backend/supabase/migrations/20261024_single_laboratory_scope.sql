-- Align an existing Labstream database with the proposal's initial single-laboratory scope.
-- This migration does not merge or delete clinic records. It stops if the database
-- contains more than one lab or any branch records/assignments that require review.
-- Back up the database before applying any schema migration.

begin;

do $$
begin
  if (select count(*) from public.clinics) > 1 then
    raise exception 'Single-laboratory migration stopped: more than one clinic record exists. Export and consolidate data into the intended laboratory before retrying.';
  end if;
  if to_regclass('public.clinic_branches') is not null
     and exists (select 1 from public.clinic_branches) then
    raise exception 'Single-laboratory migration stopped: branch records exist. Review/export branch data before retrying.';
  end if;
  if exists (select 1 from public.users where branch_id is not null)
     or exists (select 1 from public.patients where branch_id is not null)
     or exists (select 1 from public.test_requests where branch_id is not null) then
    raise exception 'Single-laboratory migration stopped: records have branch assignments. Review/export them before retrying.';
  end if;
end $$;

alter table public.clinics
  add column if not exists instance_slot smallint not null default 1;
alter table public.clinics
  add constraint clinics_single_instance_slot check (instance_slot = 1);
create unique index if not exists clinics_one_laboratory_per_database_uidx
  on public.clinics(instance_slot);

drop index if exists public.test_requests_one_called_per_queue_scope;
drop index if exists public.test_requests_queue_order_idx;

drop trigger if exists test_requests_validate_assignments on public.test_requests;
drop function if exists public.validate_request_assignments();

alter table public.users drop constraint if exists users_branch_id_clinic_id_fkey;
alter table public.patients drop constraint if exists patients_branch_id_clinic_id_fkey;
alter table public.test_requests drop constraint if exists test_requests_branch_id_clinic_id_fkey;
alter table public.users drop column if exists branch_id;
alter table public.patients drop column if exists branch_id;
alter table public.test_requests drop column if exists branch_id;
drop table if exists public.clinic_branches;

create unique index if not exists test_requests_one_called_per_laboratory
  on public.test_requests(clinic_id)
  where status = 'awaiting_payment' and queue_called_at is not null;
create index if not exists test_requests_queue_order_idx
  on public.test_requests(clinic_id, requested_at, queue_ticket)
  where status = 'awaiting_payment';

create function public.validate_request_assignments() returns trigger language plpgsql as $$
declare assigned_role public.user_role; assigned_active boolean;
begin
  if new.assigned_technologist_id is not null then
    select role, is_active into assigned_role, assigned_active
      from public.users where id = new.assigned_technologist_id and clinic_id = new.clinic_id;
    if assigned_role <> 'medical_technologist' or not assigned_active then
      raise exception 'Assigned technologist must be an active medical technologist in this laboratory';
    end if;
  end if;
  if new.assigned_pathologist_id is not null then
    select role, is_active into assigned_role, assigned_active
      from public.users where id = new.assigned_pathologist_id and clinic_id = new.clinic_id;
    if assigned_role <> 'pathologist' or not assigned_active then
      raise exception 'Assigned pathologist must be an active pathologist in this laboratory';
    end if;
  end if;
  return new;
end $$;
create trigger test_requests_validate_assignments
  before insert or update of assigned_technologist_id, assigned_pathologist_id
  on public.test_requests for each row execute function public.validate_request_assignments();

commit;
