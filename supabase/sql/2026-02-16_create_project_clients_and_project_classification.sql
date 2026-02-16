begin;

-- Cadastro central de clientes para uso nos projetos.
create table if not exists public.project_clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete set null,
  name text not null,
  legal_name text null,
  document text null,
  contact_name text null,
  contact_email text null,
  contact_phone text null,
  notes text null,
  active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_clients_company on public.project_clients(company_id);
create index if not exists idx_project_clients_active on public.project_clients(active);

drop trigger if exists trg_project_clients_updated_at on public.project_clients;
create trigger trg_project_clients_updated_at
before update on public.project_clients
for each row execute function public.set_updated_at();

alter table public.project_clients enable row level security;

-- Leitura: usuarios ativos.
drop policy if exists project_clients_select_active_users on public.project_clients;
create policy project_clients_select_active_users
on public.project_clients
for select
to authenticated
using (
  public.current_active() = true
);

-- Escrita: apenas admin.
drop policy if exists project_clients_insert_admin on public.project_clients;
create policy project_clients_insert_admin
on public.project_clients
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists project_clients_update_admin on public.project_clients;
create policy project_clients_update_admin
on public.project_clients
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
)
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists project_clients_delete_admin on public.project_clients;
create policy project_clients_delete_admin
on public.project_clients
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

-- Classificacao de cliente/tipo/disciplina no projeto.
alter table if exists public.projects
  add column if not exists client_id uuid null references public.project_clients(id) on delete set null;

alter table if exists public.projects
  add column if not exists project_type text null
  check (
    project_type is null
    or project_type in ('hv', 'rmt', 'basico', 'estrutural', 'civil', 'eletromecanico', 'eletrico', 'hidraulico', 'outro')
  );

alter table if exists public.projects
  add column if not exists project_scopes text[] not null default '{}';

create index if not exists idx_projects_client_id on public.projects(client_id);
create index if not exists idx_projects_project_type on public.projects(project_type);

commit;
