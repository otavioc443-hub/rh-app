begin;

-- Auditoria de exclusoes de custos indiretos de projetos.
create table if not exists public.project_indirect_costs_audit (
  id uuid primary key default gen_random_uuid(),
  indirect_cost_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  action text not null check (action in ('delete')),
  reason text not null,
  old_row jsonb not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_role text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_indirect_costs_audit_project
  on public.project_indirect_costs_audit(project_id, created_at desc);

create index if not exists idx_project_indirect_costs_audit_actor
  on public.project_indirect_costs_audit(actor_user_id, created_at desc);

alter table public.project_indirect_costs_audit enable row level security;

-- Leitura: financeiro e admin.
drop policy if exists project_indirect_costs_audit_select on public.project_indirect_costs_audit;
create policy project_indirect_costs_audit_select
on public.project_indirect_costs_audit
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro')
);

-- Escrita: apenas admin.
drop policy if exists project_indirect_costs_audit_insert on public.project_indirect_costs_audit;
create policy project_indirect_costs_audit_insert
on public.project_indirect_costs_audit
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

commit;

