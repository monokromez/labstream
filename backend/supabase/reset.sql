-- DESTRUCTIVE: permanently deletes Labstream application data and objects in public.
-- This does not drop Supabase auth/storage schemas or unrelated public tables.
-- RESTRICT is used: a separate object that depends on a listed object makes the
-- reset stop with an error instead of silently deleting that dependent object.
-- Review the table list before running in SQL Editor. Run schema.sql afterward.

begin;

drop view if exists public.cashier_payment_queue;

drop table if exists
  public.audit_logs,
  public.request_status_history,
  public.result_reviews,
  public.result_values,
  public.result_submission_specimens,
  public.result_submissions,
  public.results,
  public.specimen_request_items,
  public.specimens,
  public.invoices,
  public.payments,
  public.queue_entries,
  public.request_items,
  public.test_requests,
  public.reference_ranges,
  public.test_analytes,
  public.test_specimen_requirements,
  public.test_catalog,
  public.test_categories,
  public.patients,
  public.account_tokens,
  public.staff_profiles,
  public.users,
  public.clinic_branches,
  public.clinics
restrict;

drop function if exists public.assign_staff_username();
drop function if exists public.set_staff_username();
drop function if exists public.validate_request_assignments();
drop function if exists public.validate_result_value();
drop function if exists public.validate_result_submission_actor();
drop function if exists public.validate_result_reviewer();
drop function if exists public.touch_updated_at();

drop type if exists public.queue_status;
drop type if exists public.result_type;
drop type if exists public.review_decision;
drop type if exists public.payment_method;
drop type if exists public.result_status;
drop type if exists public.result_value_type;
drop type if exists public.specimen_status;
drop type if exists public.request_item_status;
drop type if exists public.request_status;
drop type if exists public.user_role;

commit;
