begin;

insert into storage.buckets (id, name, public)
select 'collaborator-invoice-documents', 'collaborator-invoice-documents', false
where not exists (
  select 1
  from storage.buckets b
  where b.id = 'collaborator-invoice-documents'
     or b.name = 'collaborator-invoice-documents'
);

create table if not exists public.collaborator_invoice_files (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.collaborator_invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_kind text not null check (file_kind in ('xml', 'pdf', 'other')),
  storage_bucket text not null default 'collaborator-invoice-documents',
  storage_path text not null,
  file_name text null,
  content_type text null,
  size_bytes bigint null,
  uploaded_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_collaborator_invoice_files_invoice
  on public.collaborator_invoice_files(invoice_id, created_at desc);

alter table public.collaborator_invoice_files enable row level security;

drop policy if exists collaborator_invoice_files_select on public.collaborator_invoice_files;
create policy collaborator_invoice_files_select
on public.collaborator_invoice_files
for select
to authenticated
using (
  public.current_active() = true
  and exists (
    select 1
    from public.collaborator_invoices i
    where i.id = collaborator_invoice_files.invoice_id
      and (
        i.user_id = auth.uid()
        or public.current_role() in ('admin', 'rh', 'financeiro')
      )
  )
);

drop policy if exists collaborator_invoice_files_insert on public.collaborator_invoice_files;
create policy collaborator_invoice_files_insert
on public.collaborator_invoice_files
for insert
to authenticated
with check (
  public.current_active() = true
  and exists (
    select 1
    from public.collaborator_invoices i
    where i.id = collaborator_invoice_files.invoice_id
      and (
        i.user_id = auth.uid()
        or public.current_role() in ('admin', 'rh', 'financeiro')
      )
  )
);

drop policy if exists collaborator_invoice_files_delete on public.collaborator_invoice_files;
create policy collaborator_invoice_files_delete
on public.collaborator_invoice_files
for delete
to authenticated
using (
  public.current_active() = true
  and exists (
    select 1
    from public.collaborator_invoices i
    where i.id = collaborator_invoice_files.invoice_id
      and (
        i.user_id = auth.uid()
        or public.current_role() in ('admin', 'rh', 'financeiro')
      )
  )
);

commit;
