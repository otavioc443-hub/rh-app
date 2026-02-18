begin;

create table if not exists public.hierarchical_goal_updates (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.hierarchical_goals(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_role text not null check (actor_role in ('colaborador', 'coordenador', 'gestor', 'rh', 'financeiro', 'admin')),
  status_from text null,
  status_to text not null,
  current_value_from numeric(12,2) null,
  current_value_to numeric(12,2) null,
  comment text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_hierarchical_goal_updates_goal
  on public.hierarchical_goal_updates(goal_id, created_at desc);

alter table public.hierarchical_goal_updates enable row level security;

drop policy if exists hierarchical_goal_updates_select on public.hierarchical_goal_updates;
create policy hierarchical_goal_updates_select
on public.hierarchical_goal_updates
for select
to authenticated
using (
  public.current_active() = true
  and exists (
    select 1
    from public.hierarchical_goals g
    where g.id = goal_id
      and (
        g.assigned_by = auth.uid()
        or g.assigned_to = auth.uid()
        or public.current_role() in ('admin', 'rh')
      )
  )
);

drop policy if exists hierarchical_goal_updates_insert on public.hierarchical_goal_updates;
create policy hierarchical_goal_updates_insert
on public.hierarchical_goal_updates
for insert
to authenticated
with check (
  public.current_active() = true
  and actor_user_id = auth.uid()
  and actor_role = public.current_role()
  and exists (
    select 1
    from public.hierarchical_goals g
    where g.id = goal_id
      and (
        g.assigned_by = auth.uid()
        or g.assigned_to = auth.uid()
        or public.current_role() = 'admin'
      )
  )
);

commit;
