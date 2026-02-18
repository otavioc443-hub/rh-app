begin;

create table if not exists public.hierarchical_goal_deleted_items (
  id uuid primary key default gen_random_uuid(),
  goal_ref_id uuid not null,
  title text null,
  description text null,
  target_value numeric(12,2) null,
  current_value numeric(12,2) null,
  unit text null,
  due_date date null,
  status text null,
  priority text null,
  assigned_by uuid null references auth.users(id) on delete set null,
  assigned_by_role text null,
  assigned_to uuid null references auth.users(id) on delete set null,
  assigned_to_role text null,
  deleted_by uuid null references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists idx_hierarchical_goal_deleted_items_deleted_at
  on public.hierarchical_goal_deleted_items(deleted_at desc);

create index if not exists idx_hierarchical_goal_deleted_items_assigned_to
  on public.hierarchical_goal_deleted_items(assigned_to, deleted_at desc);

create index if not exists idx_hierarchical_goal_deleted_items_assigned_by
  on public.hierarchical_goal_deleted_items(assigned_by, deleted_at desc);

create or replace function public.log_hierarchical_goal_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.hierarchical_goal_deleted_items (
    goal_ref_id,
    title,
    description,
    target_value,
    current_value,
    unit,
    due_date,
    status,
    priority,
    assigned_by,
    assigned_by_role,
    assigned_to,
    assigned_to_role,
    deleted_by,
    snapshot
  )
  values (
    old.id,
    old.title,
    old.description,
    old.target_value,
    old.current_value,
    old.unit,
    old.due_date,
    old.status,
    old.priority,
    old.assigned_by,
    old.assigned_by_role,
    old.assigned_to,
    old.assigned_to_role,
    auth.uid(),
    to_jsonb(old)
  );
  return old;
end;
$$;

drop trigger if exists trg_log_hierarchical_goal_delete on public.hierarchical_goals;
create trigger trg_log_hierarchical_goal_delete
before delete on public.hierarchical_goals
for each row execute function public.log_hierarchical_goal_delete();

alter table public.hierarchical_goal_deleted_items enable row level security;

drop policy if exists hierarchical_goal_deleted_items_select on public.hierarchical_goal_deleted_items;
create policy hierarchical_goal_deleted_items_select
on public.hierarchical_goal_deleted_items
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

commit;
