begin;

alter table if exists public.collaborator_invoices
  add column if not exists provider_external_id text null,
  add column if not exists provider_status text null,
  add column if not exists provider_last_error text null,
  add column if not exists provider_synced_at timestamptz null;

create table if not exists public.collaborator_invoice_jobs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.collaborator_invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('sougov', 'portal_estadual', 'portal_municipal', 'custom')),
  job_kind text not null check (job_kind in ('issue', 'sync_status', 'download_pdf', 'download_xml', 'cancel')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  result jsonb null,
  last_error text null,
  locked_at timestamptz null,
  locked_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collaborator_invoice_jobs_queue
  on public.collaborator_invoice_jobs(status, run_after, created_at)
  where status = 'queued';

create index if not exists idx_collaborator_invoice_jobs_invoice
  on public.collaborator_invoice_jobs(invoice_id, created_at desc);

drop trigger if exists trg_collaborator_invoice_jobs_updated_at on public.collaborator_invoice_jobs;
create trigger trg_collaborator_invoice_jobs_updated_at
before update on public.collaborator_invoice_jobs
for each row execute function public.set_updated_at();

create table if not exists public.collaborator_invoice_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.collaborator_invoice_jobs(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'started', 'attempt_failed', 'succeeded', 'failed', 'cancelled')),
  message text null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_collaborator_invoice_job_events_job
  on public.collaborator_invoice_job_events(job_id, created_at desc);

alter table public.collaborator_invoice_jobs enable row level security;
alter table public.collaborator_invoice_job_events enable row level security;

drop policy if exists collaborator_invoice_jobs_select on public.collaborator_invoice_jobs;
create policy collaborator_invoice_jobs_select
on public.collaborator_invoice_jobs
for select
to authenticated
using (
  public.current_active() = true
  and (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
);

drop policy if exists collaborator_invoice_jobs_insert on public.collaborator_invoice_jobs;
create policy collaborator_invoice_jobs_insert
on public.collaborator_invoice_jobs
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
);

drop policy if exists collaborator_invoice_jobs_update on public.collaborator_invoice_jobs;
create policy collaborator_invoice_jobs_update
on public.collaborator_invoice_jobs
for update
to authenticated
using (
  public.current_active() = true
  and (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
)
with check (
  public.current_active() = true
  and (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
);

drop policy if exists collaborator_invoice_job_events_select on public.collaborator_invoice_job_events;
create policy collaborator_invoice_job_events_select
on public.collaborator_invoice_job_events
for select
to authenticated
using (
  public.current_active() = true
  and exists (
    select 1
    from public.collaborator_invoice_jobs j
    where j.id = collaborator_invoice_job_events.job_id
      and (
        j.user_id = auth.uid()
        or public.current_role() in ('admin', 'rh', 'financeiro')
      )
  )
);

drop policy if exists collaborator_invoice_job_events_insert on public.collaborator_invoice_job_events;
create policy collaborator_invoice_job_events_insert
on public.collaborator_invoice_job_events
for insert
to authenticated
with check (
  public.current_active() = true
  and exists (
    select 1
    from public.collaborator_invoice_jobs j
    where j.id = collaborator_invoice_job_events.job_id
      and (
        j.user_id = auth.uid()
        or public.current_role() in ('admin', 'rh', 'financeiro')
      )
  )
);

commit;
