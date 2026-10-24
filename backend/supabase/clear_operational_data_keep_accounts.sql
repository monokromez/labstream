-- Clear Labstream operational/configuration data while retaining accounts.
-- Run only when you intentionally want to reset a practice clinic's workflow.
-- Keeps: clinics, clinic_branches, users, staff_profiles, account_tokens.
-- Patient rows linked to portal accounts are retained because login resolves
-- patient PID through patients; unlinked walk-in patient records are removed.
-- This does not drop tables, types, functions, views, triggers, or RLS settings.

begin;

delete from public.result_reviews;
delete from public.result_values;
delete from public.result_submission_specimens;
delete from public.result_submissions;

delete from public.specimen_request_items;
delete from public.specimens;

delete from public.invoices;
delete from public.payments;
delete from public.request_status_history;
delete from public.request_items;
delete from public.test_requests;

delete from public.audit_logs;

delete from public.patients
 where portal_user_id is null;

delete from public.reference_ranges;
delete from public.test_analytes;
delete from public.test_specimen_requirements;
delete from public.test_catalog;
delete from public.test_categories;

commit;
