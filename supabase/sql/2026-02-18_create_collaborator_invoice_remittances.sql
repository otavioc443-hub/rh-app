begin;

create table if not exists public.collaborator_invoice_remittances (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'draft' check (status in ('draft', 'payment_pending', 'paid', 'cancelled')),
  payment_method text not null default 'boleto' check (payment_method in ('boleto', 'pix', 'ted')),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  due_date date null,
  boleto_url text null,
  boleto_barcode text null,
  boleto_digitable_line text null,
  provider_reference text null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  sent_at timestamptz null,
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_collaborator_invoice_remittances_updated_at on public.collaborator_invoice_remittances;
create trigger trg_collaborator_invoice_remittances_updated_at
before update on public.collaborator_invoice_remittances
for each row execute function public.set_updated_at();

create table if not exists public.collaborator_invoice_remittance_items (
  id uuid primary key default gen_random_uuid(),
  remittance_id uuid not null references public.collaborator_invoice_remittances(id) on delete cascade,
  invoice_id uuid not null references public.collaborator_invoices(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  invoice_number text null,
  issue_date date null,
  created_at timestamptz not null default now(),
  unique (invoice_id)
);

create index if not exists idx_collaborator_invoice_remittance_items_remittance
  on public.collaborator_invoice_remittance_items(remittance_id, created_at desc);

create index if not exists idx_collaborator_invoice_remittance_items_user
  on public.collaborator_invoice_remittance_items(user_id, created_at desc);

alter table public.collaborator_invoice_remittances enable row level security;
alter table public.collaborator_invoice_remittance_items enable row level security;

drop policy if exists collaborator_invoice_remittances_select on public.collaborator_invoice_remittances;
create policy collaborator_invoice_remittances_select
on public.collaborator_invoice_remittances
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro')
);

drop policy if exists collaborator_invoice_remittances_insert on public.collaborator_invoice_remittances;
create policy collaborator_invoice_remittances_insert
on public.collaborator_invoice_remittances
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro')
);

drop policy if exists collaborator_invoice_remittances_update on public.collaborator_invoice_remittances;
create policy collaborator_invoice_remittances_update
on public.collaborator_invoice_remittances
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro')
)
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro')
);

drop policy if exists collaborator_invoice_remittance_items_select on public.collaborator_invoice_remittance_items;
create policy collaborator_invoice_remittance_items_select
on public.collaborator_invoice_remittance_items
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro')
);

drop policy if exists collaborator_invoice_remittance_items_insert on public.collaborator_invoice_remittance_items;
create policy collaborator_invoice_remittance_items_insert
on public.collaborator_invoice_remittance_items
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro')
);

commit;
