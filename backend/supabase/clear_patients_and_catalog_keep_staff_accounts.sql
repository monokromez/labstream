-- Destructive workflow/catalog reset for the single-laboratory deployment.
-- Keeps: the laboratory record, non-patient user accounts, staff profiles, and staff tokens.
-- Deletes: all patient records and patient portal accounts, all patient-linked workflow
-- data, all audit history, and all test/catalog/reference-range configuration.
-- Run only when you intentionally want this data removed. This is not a schema reset.

begin;

delete from public.result_reviews;
delete from public.result_values;
delete from public.result_submission_specimens;
delete from public.result_submissions;

delete from public.specimen_request_items;
delete from public.specimens;

delete from public.invoices;
delete from public.payment_refunds;
delete from public.payments;
delete from public.request_status_history;
delete from public.request_items;
delete from public.test_requests;

-- Audit details can contain patient/request identifiers, so clear the audit trail too.
delete from public.audit_logs;

-- Remove patient rows before patient users because the patient row references its portal user.
delete from public.patients;
delete from public.account_tokens
 where user_id in (select id from public.users where role = 'patient');
delete from public.staff_profiles
 where user_id in (select id from public.users where role = 'patient');
delete from public.users where role = 'patient';

delete from public.reference_ranges;
delete from public.test_analytes;
delete from public.test_specimen_requirements;
delete from public.test_category_memberships;
delete from public.test_configuration_versions;
delete from public.test_catalog;
delete from public.test_categories;

commit;
