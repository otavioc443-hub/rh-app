begin;

alter table public.hierarchical_goal_deleted_items
  add column if not exists restored_at timestamptz null,
  add column if not exists restored_by uuid null references auth.users(id) on delete set null,
  add column if not exists restored_goal_id uuid null references public.hierarchical_goals(id) on delete set null;

create index if not exists idx_hierarchical_goal_deleted_items_restored
  on public.hierarchical_goal_deleted_items(restored_at desc);

create or replace function public.restore_deleted_hierarchical_goal(p_deleted_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_role text;
  v_status text;
  v_new_goal_id uuid;
  v_item public.hierarchical_goal_deleted_items%rowtype;
begin
  if p_deleted_item_id is null then
    raise exception 'id da meta excluida e obrigatorio';
  end if;

  if public.current_active() is distinct from true then
    raise exception 'usuario inativo';
  end if;

  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'usuario nao autenticado';
  end if;

  v_role := public.current_role();

  select *
  into v_item
  from public.hierarchical_goal_deleted_items d
  where d.id = p_deleted_item_id
  for update;

  if not found then
    raise exception 'meta excluida nao encontrada';
  end if;

  if v_item.restored_at is not null then
    raise exception 'meta excluida ja foi restaurada';
  end if;

  if v_role <> 'admin' and v_item.assigned_by is distinct from v_uid then
    raise exception 'sem permissao para restaurar esta meta';
  end if;

  if v_item.assigned_by is null
    or v_item.assigned_to is null
    or v_item.assigned_by_role is null
    or v_item.assigned_to_role is null
  then
    raise exception 'dados da meta excluida incompletos para restauracao';
  end if;

  if not public.goal_can_assign(v_item.assigned_by_role, v_item.assigned_to_role) then
    raise exception 'hierarquia atual nao permite restaurar esta meta';
  end if;

  if v_item.status in ('draft', 'active', 'in_progress', 'completed', 'blocked', 'cancelled') then
    v_status := v_item.status;
  else
    v_status := 'active';
  end if;

  insert into public.hierarchical_goals (
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
    assigned_to_role
  )
  values (
    coalesce(v_item.title, 'Meta restaurada'),
    v_item.description,
    v_item.target_value,
    coalesce(v_item.current_value, 0),
    v_item.unit,
    v_item.due_date,
    v_status,
    case when v_item.priority in ('low', 'medium', 'high', 'critical') then v_item.priority else 'medium' end,
    v_item.assigned_by,
    v_item.assigned_by_role,
    v_item.assigned_to,
    v_item.assigned_to_role
  )
  returning id into v_new_goal_id;

  update public.hierarchical_goal_deleted_items
  set restored_at = now(),
      restored_by = v_uid,
      restored_goal_id = v_new_goal_id
  where id = v_item.id
    and restored_at is null;

  if not found then
    raise exception 'meta excluida ja foi restaurada';
  end if;

  insert into public.hierarchical_goal_updates (
    goal_id,
    actor_user_id,
    actor_role,
    status_from,
    status_to,
    current_value_from,
    current_value_to,
    comment
  )
  values (
    v_new_goal_id,
    v_uid,
    v_role,
    null,
    v_status,
    null,
    coalesce(v_item.current_value, 0),
    'Meta restaurada a partir de item excluido'
  );

  return v_new_goal_id;
end;
$$;

grant execute on function public.restore_deleted_hierarchical_goal(uuid) to authenticated;

commit;
