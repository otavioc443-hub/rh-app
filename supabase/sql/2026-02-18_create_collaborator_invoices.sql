begin;

create table if not exists public.collaborator_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference_month date not null,
  invoice_number text null,
  issue_date date null,
  due_date date null,
  gross_amount numeric(14,2) null check (gross_amount is null or gross_amount >= 0),
  integration_provider text not null default 'custom' check (integration_provider in ('sougov', 'portal_estadual', 'portal_municipal', 'custom')),
  integration_url text null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
  notes text null,
  project_allocation_snapshot jsonb not null default '[]'::jsonb,
  sent_at timestamptz null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  review_comment text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collaborator_invoices_user_month
  on public.collaborator_invoices(user_id, reference_month desc);

drop trigger if exists trg_collaborator_invoices_updated_at on public.collaborator_invoices;
create trigger trg_collaborator_invoices_updated_at
before update on public.collaborator_invoices
for each row execute function public.set_updated_at();

alter table public.collaborator_invoices enable row level security;

drop policy if exists collaborator_invoices_select on public.collaborator_invoices;
create policy collaborator_invoices_select
on public.collaborator_invoices
for select
to authenticated
using (
  public.current_active() = true
  and (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
);

drop policy if exists collaborator_invoices_insert on public.collaborator_invoices;
create policy collaborator_invoices_insert
on public.collaborator_invoices
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
);

drop policy if exists collaborator_invoices_update on public.collaborator_invoices;
create policy collaborator_invoices_update
on public.collaborator_invoices
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

drop policy if exists collaborator_invoices_delete on public.collaborator_invoices;
create policy collaborator_invoices_delete
on public.collaborator_invoices
for delete
to authenticated
using (
  public.current_active() = true
  and (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
);

commit;
