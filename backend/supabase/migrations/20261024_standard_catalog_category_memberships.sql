-- Preserve one canonical test record while allowing it to appear in several
-- catalog categories. Run once against an existing database; safe to rerun.
begin;

create table if not exists public.test_category_memberships (
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  test_id uuid not null,
  category_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (test_id, category_id),
  foreign key (test_id, clinic_id) references public.test_catalog(id, clinic_id) on delete restrict,
  foreign key (category_id, clinic_id) references public.test_categories(id, clinic_id) on delete restrict
);

create index if not exists test_category_memberships_category_idx
  on public.test_category_memberships(clinic_id, category_id, test_id);

insert into public.test_category_memberships (clinic_id, test_id, category_id)
select clinic_id, id, category_id from public.test_catalog
on conflict (test_id, category_id) do nothing;

alter table public.test_category_memberships enable row level security;

commit;
