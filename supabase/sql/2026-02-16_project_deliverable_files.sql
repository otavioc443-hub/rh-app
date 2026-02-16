begin;

-- Bucket privado para documentos de entregaveis.
-- Upload e URL assinada sao feitos via API server-side (service role).
insert into storage.buckets (id, name, public)
select 'deliverable-documents', 'deliverable-documents', false
where not exists (
  select 1
  from storage.buckets b
  where b.id = 'deliverable-documents'
     or b.name = 'deliverable-documents'
);

update storage.buckets
set
  file_size_limit = 20971520, -- 20MB
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
where name = 'deliverable-documents';

-- Colunas para registrar ultimo arquivo (storage path) do entregavel
alter table public.project_deliverables
  add column if not exists document_path text null;

alter table public.project_deliverables
  add column if not exists document_file_name text null;

alter table public.project_deliverables
  add column if not exists document_content_type text null;

alter table public.project_deliverables
  add column if not exists document_size bigint null;

-- Historico/versionamento de uploads por entregavel
create table if not exists public.project_deliverable_files (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.project_deliverables(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  version integer not null,
  storage_bucket text not null default 'deliverable-documents',
  storage_path text not null,
  file_name text null,
  content_type text null,
  size_bytes bigint null,
  uploaded_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (deliverable_id, version)
);

create index if not exists idx_project_deliverable_files_project on public.project_deliverable_files(project_id);
create index if not exists idx_project_deliverable_files_deliverable on public.project_deliverable_files(deliverable_id, created_at desc);

alter table public.project_deliverable_files enable row level security;

-- Leitura: membros do projeto, ou admin/rh/financeiro
drop policy if exists deliverable_files_select_project_member on public.project_deliverable_files;
create policy deliverable_files_select_project_member
on public.project_deliverable_files
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin','rh','financeiro')
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_deliverable_files.project_id
        and pm.user_id = auth.uid()
    )
  )
);

commit;

