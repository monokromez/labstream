-- Apply once to an existing Labstream database after reviewing the backup.
-- Adds durable queue tickets/calling state and distinguishes zero-fee waivers
-- from cash actually received.

alter type public.payment_method add value if not exists 'waiver';

alter table public.test_requests
  add column if not exists queue_ticket bigint generated always as identity,
  add column if not exists queue_called_at timestamptz,
  add column if not exists queue_called_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'test_requests_queue_called_by_clinic_fk'
      and conrelid = 'public.test_requests'::regclass
  ) then
    alter table public.test_requests
      add constraint test_requests_queue_called_by_clinic_fk
      foreign key (queue_called_by, clinic_id)
      references public.users(id, clinic_id) on delete restrict;
  end if;
end $$;

create unique index if not exists test_requests_one_called_per_queue_scope
  on public.test_requests (clinic_id, (coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  where status = 'awaiting_payment' and queue_called_at is not null;

create unique index if not exists test_requests_queue_ticket_uidx
  on public.test_requests (queue_ticket);

create index if not exists test_requests_queue_order_idx
  on public.test_requests (clinic_id, branch_id, requested_at, queue_ticket)
  where status = 'awaiting_payment';
