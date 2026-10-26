-- Run once against an existing Labstream database before deploying this version.
alter table public.result_values add column if not exists structured_value jsonb;
alter table public.result_values drop constraint if exists result_values_check;
alter table public.result_values add constraint result_values_one_value_check
  check (num_nonnulls(numeric_value, text_value, select_value, boolean_value, structured_value) = 1);
alter table public.result_values add constraint result_values_structured_array_check
  check (structured_value is null or case when jsonb_typeof(structured_value) = 'array' then jsonb_array_length(structured_value) > 0 else false end);

alter table public.account_tokens drop constraint if exists account_tokens_expiry_by_purpose_check;
update public.account_tokens
   set expires_at = created_at + interval '24 hours'
 where expires_at is null;
alter table public.account_tokens alter column expires_at set not null;
alter table public.account_tokens add constraint account_tokens_expiry_by_purpose_check
  check (expires_at is not null);

create or replace function public.validate_result_value() returns trigger language plpgsql as $$
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
  ) then raise exception 'Result analyte does not belong to the requested test'; end if;
  if (expected_type = 'numeric' and num_nonnulls(new.numeric_value) <> 1)
     or (expected_type = 'text' and num_nonnulls(new.text_value) <> 1)
     or (expected_type = 'select' and num_nonnulls(new.select_value) <> 1)
     or (expected_type = 'boolean' and num_nonnulls(new.boolean_value) <> 1)
     or (expected_type = 'structured' and (num_nonnulls(new.structured_value) <> 1 or jsonb_typeof(new.structured_value) <> 'array')) then
    raise exception 'Result value does not match the analyte value type';
  end if;
  if expected_type = 'select' and not (expected_options ? new.select_value) then raise exception 'Selected result is not one of the analyte options'; end if;
  if expected_type = 'structured' and exists (
    select 1 from jsonb_array_elements(new.structured_value) as rows(value)
    where jsonb_typeof(rows.value) <> 'object'
       or exists (select 1 from jsonb_object_keys(rows.value) as keys(column_name) where not (expected_options ? keys.column_name))
  ) then raise exception 'Structured result rows must use configured columns'; end if;
  return new;
end $$;

