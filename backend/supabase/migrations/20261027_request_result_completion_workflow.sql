-- Run once against an existing Labstream database before deploying this version.
-- A request item is marked completed by the technologist, then all request tests
-- are submitted together for pathologist validation.
alter type public.request_item_status add value if not exists 'completed' after 'drafted';

-- Repair in-flight mixed decisions from the former per-test return workflow.
-- Prior result submissions and review decisions remain unchanged in history.
update public.request_items ri
   set status = 'returned', updated_at = now()
  from public.test_requests r
 where r.id = ri.request_id and r.clinic_id = ri.clinic_id
   and r.status = 'correction'
   and ri.status in ('approved', 'drafted');
