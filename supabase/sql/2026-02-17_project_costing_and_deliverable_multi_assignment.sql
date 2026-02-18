begin;

-- 1) Rateio de custo de colaborador por projeto (percentual de participacao).
create table if not exists public.project_member_allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  allocation_pct numeric(5,2) not null check (allocation_pct > 0 and allocation_pct <= 100),
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists idx_project_member_allocations_project on public.project_member_allocations(project_id);
create index if not exists idx_project_member_allocations_user on public.project_member_allocations(user_id);

drop trigger if exists trg_project_member_allocations_updated_at on public.project_member_allocations;
create trigger trg_project_member_allocations_updated_at
before update on public.project_member_allocations
for each row execute function public.set_updated_at();

alter table public.project_member_allocations enable row level security;

drop policy if exists project_member_allocations_select on public.project_member_allocations;
create policy project_member_allocations_select
on public.project_member_allocations
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'financeiro', 'rh')
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_member_allocations.project_id
        and pm.user_id = auth.uid()
    )
  )
);

drop policy if exists project_member_allocations_insert on public.project_member_allocations;
create policy project_member_allocations_insert
on public.project_member_allocations
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'financeiro')
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_member_allocations.project_id
        and pr.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_member_allocations.project_id
        and pm.user_id = auth.uid()
        and pm.member_role in ('gestor', 'coordenador')
    )
  )
);

drop policy if exists project_member_allocations_update on public.project_member_allocations;
create policy project_member_allocations_update
on public.project_member_allocations
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'financeiro')
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_member_allocations.project_id
        and pr.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_member_allocations.project_id
        and pm.user_id = auth.uid()
        and pm.member_role in ('gestor', 'coordenador')
    )
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'financeiro')
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_member_allocations.project_id
        and pr.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_member_allocations.project_id
        and pm.user_id = auth.uid()
        and pm.member_role in ('gestor', 'coordenador')
    )
  )
);

drop policy if exists project_member_allocations_delete on public.project_member_allocations;
create policy project_member_allocations_delete
on public.project_member_allocations
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'financeiro')
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_member_allocations.project_id
        and pr.owner_user_id = auth.uid()
    )
  )
);

-- 2) Multipla atribuicao por entregavel com medida de contribuicao.
create table if not exists public.project_deliverable_assignees (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.project_deliverables(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  contribution_unit text not null default 'hours' check (contribution_unit in ('hours', 'percent', 'points')),
  contribution_value numeric(10,2) null check (contribution_value is null or contribution_value >= 0),
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deliverable_id, user_id)
);

create index if not exists idx_project_deliverable_assignees_project on public.project_deliverable_assignees(project_id);
create index if not exists idx_project_deliverable_assignees_deliverable on public.project_deliverable_assignees(deliverable_id);
create index if not exists idx_project_deliverable_assignees_user on public.project_deliverable_assignees(user_id);

drop trigger if exists trg_project_deliverable_assignees_updated_at on public.project_deliverable_assignees;
create trigger trg_project_deliverable_assignees_updated_at
before update on public.project_deliverable_assignees
for each row execute function public.set_updated_at();

alter table public.project_deliverable_assignees enable row level security;

drop policy if exists project_deliverable_assignees_select on public.project_deliverable_assignees;
create policy project_deliverable_assignees_select
on public.project_deliverable_assignees
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'financeiro', 'rh')
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_deliverable_assignees.project_id
        and pm.user_id = auth.uid()
    )
    or user_id = auth.uid()
  )
);

drop policy if exists project_deliverable_assignees_insert on public.project_deliverable_assignees;
create policy project_deliverable_assignees_insert
on public.project_deliverable_assignees
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro')
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_deliverable_assignees.project_id
        and pr.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_deliverable_assignees.project_id
        and pm.user_id = auth.uid()
        and pm.member_role in ('gestor', 'coordenador')
    )
  )
);

drop policy if exists project_deliverable_assignees_update on public.project_deliverable_assignees;
create policy project_deliverable_assignees_update
on public.project_deliverable_assignees
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro')
    or user_id = auth.uid()
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_deliverable_assignees.project_id
        and pr.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_deliverable_assignees.project_id
        and pm.user_id = auth.uid()
        and pm.member_role in ('gestor', 'coordenador')
    )
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro')
    or user_id = auth.uid()
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_deliverable_assignees.project_id
        and pr.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_deliverable_assignees.project_id
        and pm.user_id = auth.uid()
        and pm.member_role in ('gestor', 'coordenador')
    )
  )
);

drop policy if exists project_deliverable_assignees_delete on public.project_deliverable_assignees;
create policy project_deliverable_assignees_delete
on public.project_deliverable_assignees
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro')
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_deliverable_assignees.project_id
        and pr.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_deliverable_assignees.project_id
        and pm.user_id = auth.uid()
        and pm.member_role in ('gestor', 'coordenador')
    )
  )
);

-- 3) Custos indiretos por projeto.
create table if not exists public.project_indirect_costs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  cost_category text not null check (cost_category in ('rh', 'financeiro', 'adm', 'ti', 'juridico', 'outros')),
  cost_type text not null default 'monthly' check (cost_type in ('monthly', 'one_time', 'percentage_payroll')),
  amount numeric(14,2) not null check (amount >= 0),
  notes text null,
  start_date date null,
  end_date date null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_indirect_costs_project on public.project_indirect_costs(project_id);
create index if not exists idx_project_indirect_costs_category on public.project_indirect_costs(cost_category);

drop trigger if exists trg_project_indirect_costs_updated_at on public.project_indirect_costs;
create trigger trg_project_indirect_costs_updated_at
before update on public.project_indirect_costs
for each row execute function public.set_updated_at();

alter table public.project_indirect_costs enable row level security;

drop policy if exists project_indirect_costs_select on public.project_indirect_costs;
create policy project_indirect_costs_select
on public.project_indirect_costs
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'financeiro', 'rh')
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_indirect_costs.project_id
        and pm.user_id = auth.uid()
    )
  )
);

drop policy if exists project_indirect_costs_insert on public.project_indirect_costs;
create policy project_indirect_costs_insert
on public.project_indirect_costs
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro')
);

drop policy if exists project_indirect_costs_update on public.project_indirect_costs;
create policy project_indirect_costs_update
on public.project_indirect_costs
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro')
)
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro')
);

drop policy if exists project_indirect_costs_delete on public.project_indirect_costs;
create policy project_indirect_costs_delete
on public.project_indirect_costs
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro')
);

commit;
