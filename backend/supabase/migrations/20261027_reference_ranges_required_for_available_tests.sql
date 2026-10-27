begin;

alter table public.test_catalog alter column is_available set default false;

-- Existing tests without a current active reference range must not remain orderable.
update public.test_catalog t
   set is_available = false, updated_at = now()
 where t.is_available
   and not exists (
     select 1
       from public.test_analytes a
       join public.reference_ranges rr
         on rr.analyte_id = a.id and rr.clinic_id = a.clinic_id and rr.is_active = true
      where a.test_id = t.id and a.clinic_id = t.clinic_id
        and a.configuration_version = t.current_configuration_version
   );

create or replace function public.require_reference_range_for_available_test()
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

drop trigger if exists test_catalog_reference_range_required on public.test_catalog;
create trigger test_catalog_reference_range_required
before insert or update of is_available, current_configuration_version on public.test_catalog
for each row execute function public.require_reference_range_for_available_test();

create or replace function public.prevent_removing_last_range_from_available_test()
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

drop trigger if exists available_test_requires_reference_range on public.reference_ranges;
create trigger available_test_requires_reference_range
before update of is_active, analyte_id on public.reference_ranges
for each row execute function public.prevent_removing_last_range_from_available_test();

commit;
