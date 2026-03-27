begin;

alter table public.lms_assignments
  add column if not exists recurring_every_days integer null check (recurring_every_days is null or recurring_every_days > 0),
  add column if not exists auto_reassign_on_expiry boolean not null default false,
  add column if not exists assignment_group uuid null;

update public.lms_assignments
set assignment_group = gen_random_uuid()
where assignment_group is null;

create index if not exists idx_lms_assignments_recurring
  on public.lms_assignments(auto_reassign_on_expiry, expires_at, recurring_every_days);

create index if not exists idx_lms_assignments_group
  on public.lms_assignments(assignment_group, assigned_at desc);

commit;
