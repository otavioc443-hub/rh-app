begin;

insert into storage.buckets (id, name, public)
select 'finance-remittance-documents', 'finance-remittance-documents', false
where not exists (
  select 1
  from storage.buckets b
  where b.id = 'finance-remittance-documents'
     or b.name = 'finance-remittance-documents'
);

create table if not exists public.collaborator_invoice_remittance_files (
  id uuid primary key default gen_random_uuid(),
  remittance_id uuid not null references public.collaborator_invoice_remittances(id) on delete cascade,
  uploaded_by uuid null references auth.users(id) on delete set null,
  file_kind text not null check (file_kind in ('pdf', 'image', 'other')),
  storage_bucket text not null default 'finance-remittance-documents',
  storage_path text not null,
  file_name text null,
  content_type text null,
  size_bytes bigint null,
  created_at timestamptz not null default now()
);

create index if not exists idx_collaborator_invoice_remittance_files_remittance
  on public.collaborator_invoice_remittance_files(remittance_id, created_at desc);

alter table public.collaborator_invoice_remittance_files enable row level security;

drop policy if exists collaborator_invoice_remittance_files_select on public.collaborator_invoice_remittance_files;
create policy collaborator_invoice_remittance_files_select
on public.collaborator_invoice_remittance_files
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro')
);

drop policy if exists collaborator_invoice_remittance_files_insert on public.collaborator_invoice_remittance_files;
create policy collaborator_invoice_remittance_files_insert
on public.collaborator_invoice_remittance_files
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro')
);

commit;
