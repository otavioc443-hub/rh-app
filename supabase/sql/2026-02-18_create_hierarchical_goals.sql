begin;

create table if not exists public.hierarchical_goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text null,
  target_value numeric(12,2) null,
  current_value numeric(12,2) not null default 0,
  unit text null,
  start_date date null,
  due_date date null,
  status text not null default 'active' check (status in ('draft', 'active', 'in_progress', 'completed', 'blocked', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),

  assigned_by uuid not null references auth.users(id) on delete cascade,
  assigned_by_role text not null check (assigned_by_role in ('colaborador', 'coordenador', 'gestor', 'rh', 'financeiro', 'admin')),
  assigned_to uuid not null references auth.users(id) on delete cascade,
  assigned_to_role text not null check (assigned_to_role in ('colaborador', 'coordenador', 'gestor', 'rh', 'financeiro', 'admin')),

  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint hierarchical_goals_positive_current_value check (current_value >= 0),
  constraint hierarchical_goals_due_after_start check (due_date is null or start_date is null or due_date >= start_date)
);

create index if not exists idx_hierarchical_goals_assigned_to
  on public.hierarchical_goals(assigned_to, status, due_date);

create index if not exists idx_hierarchical_goals_assigned_by
  on public.hierarchical_goals(assigned_by, created_at desc);

create index if not exists idx_hierarchical_goals_roles
  on public.hierarchical_goals(assigned_by_role, assigned_to_role, status);

drop trigger if exists trg_hierarchical_goals_updated_at on public.hierarchical_goals;
create trigger trg_hierarchical_goals_updated_at
before update on public.hierarchical_goals
for each row execute function public.set_updated_at();

create or replace function public.goal_can_assign(p_assigner_role text, p_target_role text)
returns boolean
language sql
stable
as $$
  select case
    when p_assigner_role = 'coordenador' and p_target_role = 'colaborador' then true
    when p_assigner_role = 'gestor' and p_target_role = 'coordenador' then true
    when p_assigner_role = 'admin' and p_target_role in ('financeiro', 'rh', 'gestor', 'admin') then true
    else false
  end
$$;

alter table public.hierarchical_goals enable row level security;

drop policy if exists hierarchical_goals_select on public.hierarchical_goals;
create policy hierarchical_goals_select
on public.hierarchical_goals
for select
to authenticated
using (
  public.current_active() = true
  and (
    assigned_by = auth.uid()
    or assigned_to = auth.uid()
    or public.current_role() in ('admin', 'rh')
  )
);

drop policy if exists hierarchical_goals_insert on public.hierarchical_goals;
create policy hierarchical_goals_insert
on public.hierarchical_goals
for insert
to authenticated
with check (
  public.current_active() = true
  and assigned_by = auth.uid()
  and assigned_by_role = public.current_role()
  and public.goal_can_assign(public.current_role(), assigned_to_role)
);

drop policy if exists hierarchical_goals_update on public.hierarchical_goals;
create policy hierarchical_goals_update
on public.hierarchical_goals
for update
to authenticated
using (
  public.current_active() = true
  and (
    assigned_by = auth.uid()
    or assigned_to = auth.uid()
    or public.current_role() = 'admin'
  )
)
with check (
  public.current_active() = true
  and (
    assigned_by = auth.uid()
    or assigned_to = auth.uid()
    or public.current_role() = 'admin'
  )
  and public.goal_can_assign(assigned_by_role, assigned_to_role)
);

drop policy if exists hierarchical_goals_delete on public.hierarchical_goals;
create policy hierarchical_goals_delete
on public.hierarchical_goals
for delete
to authenticated
using (
  public.current_active() = true
  and (assigned_by = auth.uid() or public.current_role() = 'admin')
);

commit;
