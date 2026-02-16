begin;

-- Fluxo de aprovacao financeira para eventos contratuais de projeto.
alter table if exists public.project_contract_events
  add column if not exists requested_by uuid null references auth.users(id) on delete set null;

alter table if exists public.project_contract_events
  add column if not exists apply_on_approval boolean not null default false;

alter table if exists public.project_contract_events
  add column if not exists finance_decision_note text null;

alter table if exists public.project_contract_events
  add column if not exists finance_decided_by uuid null references auth.users(id) on delete set null;

alter table if exists public.project_contract_events
  add column if not exists finance_decided_at timestamptz null;

create index if not exists idx_project_contract_events_status
  on public.project_contract_events(status, effective_date desc, created_at desc);

create index if not exists idx_project_contract_events_requested_by
  on public.project_contract_events(requested_by, created_at desc);

commit;

