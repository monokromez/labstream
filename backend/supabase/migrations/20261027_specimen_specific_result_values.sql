-- Run once on an existing Labstream database before deploying this version.
-- Existing values are assigned to the result submission's primary specimen.
-- We do not duplicate legacy values across additional specimens because that
-- would falsely imply that each sample was independently measured.

insert into public.result_submission_specimens (clinic_id, request_id, result_submission_id, specimen_id)
select rs.clinic_id, rs.request_id, rs.id, rs.specimen_id
  from public.result_submissions rs
on conflict (result_submission_id, specimen_id) do nothing;

alter table public.result_submission_specimens
  add constraint result_submission_specimens_result_specimen_clinic_uidx
  unique (result_submission_id, specimen_id, clinic_id);

alter table public.result_values add column specimen_id uuid;

update public.result_values rv
   set specimen_id = rs.specimen_id
  from public.result_submissions rs
 where rs.id = rv.result_submission_id and rs.clinic_id = rv.clinic_id;

alter table public.result_values alter column specimen_id set not null;
alter table public.result_values drop constraint if exists result_values_result_submission_id_analyte_id_key;
alter table public.result_values
  add constraint result_values_submission_specimen_analyte_key
  unique (result_submission_id, specimen_id, analyte_id);
alter table public.result_values
  add constraint result_values_submission_specimen_clinic_fk
  foreign key (result_submission_id, specimen_id, clinic_id)
  references public.result_submission_specimens(result_submission_id, specimen_id, clinic_id)
  on delete restrict;

create index result_values_specimen_idx
  on public.result_values(result_submission_id, specimen_id, analyte_id);
