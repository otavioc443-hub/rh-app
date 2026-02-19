begin;

insert into public.notification_automation_rules (
  event_key,
  enabled,
  notify_assigned_user,
  notify_project_owner,
  notify_project_managers,
  notify_project_coordinators,
  notify_actor,
  link_default
)
values
  ('deliverable_updated', true, true, true, true, true, false, '/gestor/projetos'),
  ('pd_deliverable_updated', true, true, true, true, true, false, '/p-d/projetos')
on conflict (event_key) do nothing;

create or replace function public.notify_project_deliverable_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed boolean := false;
  v_rule public.notification_automation_rules%rowtype;
  v_has_rule boolean := false;
  v_owner_id uuid;
  v_actor uuid;
  v_title text := 'Documento atualizado';
  v_body text;
  v_link text := '/gestor/projetos';
  v_rec record;
begin
  v_changed :=
    new.status is distinct from old.status
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.due_date is distinct from old.due_date
    or new.approval_comment is distinct from old.approval_comment
    or new.document_url is distinct from old.document_url
    or new.document_path is distinct from old.document_path
    or new.document_file_name is distinct from old.document_file_name;

  if not v_changed then
    return new;
  end if;

  v_actor := auth.uid();

  select *
    into v_rule
  from public.notification_automation_rules r
  where r.event_key = 'deliverable_updated';
  v_has_rule := found;

  if v_has_rule and coalesce(v_rule.enabled, true) = false then
    return new;
  end if;

  select p.owner_user_id into v_owner_id
  from public.projects p
  where p.id = new.project_id;

  v_body := format(
    'O entregavel "%s" foi atualizado (status: %s -> %s).',
    coalesce(nullif(trim(new.title), ''), new.id::text),
    coalesce(old.status, '-'),
    coalesce(new.status, '-')
  );
  v_link := coalesce(v_rule.link_default, '/gestor/projetos');

  for v_rec in
    with recipients as (
      select new.assigned_to as user_id
      where (not v_has_rule or coalesce(v_rule.notify_assigned_user, true))
        and new.assigned_to is not null

      union

      select old.assigned_to as user_id
      where (not v_has_rule or coalesce(v_rule.notify_assigned_user, true))
        and old.assigned_to is not null

      union

      select v_owner_id as user_id
      where (not v_has_rule or coalesce(v_rule.notify_project_owner, true))
        and v_owner_id is not null

      union

      select pm.user_id
      from public.project_members pm
      where pm.project_id = new.project_id
        and pm.member_role = 'gestor'
        and (not v_has_rule or coalesce(v_rule.notify_project_managers, true))

      union

      select pm.user_id
      from public.project_members pm
      where pm.project_id = new.project_id
        and pm.member_role = 'coordenador'
        and (not v_has_rule or coalesce(v_rule.notify_project_coordinators, true))
    )
    select distinct r.user_id
    from recipients r
    where r.user_id is not null
      and (coalesce(v_rule.notify_actor, false) = true or r.user_id is distinct from v_actor)
  loop
    perform public.safe_create_notification(
      v_rec.user_id,
      v_title,
      v_body,
      case when v_rec.user_id = new.assigned_to then '/meu-perfil/projetos' else v_link end,
      'deliverable_updated'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_project_deliverable_updated on public.project_deliverables;
create trigger trg_notify_project_deliverable_updated
after update on public.project_deliverables
for each row
execute function public.notify_project_deliverable_updated();

create or replace function public.notify_pd_project_deliverable_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed boolean := false;
  v_rule public.notification_automation_rules%rowtype;
  v_has_rule boolean := false;
  v_owner_id uuid;
  v_actor uuid;
  v_title text := 'Entregavel P&D atualizado';
  v_body text;
  v_link text := '/p-d/projetos';
  v_rec record;
begin
  v_changed :=
    new.status is distinct from old.status
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.due_date is distinct from old.due_date
    or new.approval_comment is distinct from old.approval_comment;

  if not v_changed then
    return new;
  end if;

  v_actor := auth.uid();

  select *
    into v_rule
  from public.notification_automation_rules r
  where r.event_key = 'pd_deliverable_updated';
  v_has_rule := found;

  if v_has_rule and coalesce(v_rule.enabled, true) = false then
    return new;
  end if;

  select p.owner_user_id into v_owner_id
  from public.pd_projects p
  where p.id = new.project_id;

  v_body := format(
    'O entregavel P&D "%s" foi atualizado (status: %s -> %s).',
    coalesce(nullif(trim(new.title), ''), new.id::text),
    coalesce(old.status, '-'),
    coalesce(new.status, '-')
  );
  v_link := coalesce(v_rule.link_default, '/p-d/projetos');

  for v_rec in
    with recipients as (
      select new.assigned_to as user_id
      where (not v_has_rule or coalesce(v_rule.notify_assigned_user, true))
        and new.assigned_to is not null

      union

      select old.assigned_to as user_id
      where (not v_has_rule or coalesce(v_rule.notify_assigned_user, true))
        and old.assigned_to is not null

      union

      select v_owner_id as user_id
      where (not v_has_rule or coalesce(v_rule.notify_project_owner, true))
        and v_owner_id is not null

      union

      select pm.user_id
      from public.pd_project_members pm
      where pm.project_id = new.project_id
        and pm.member_role = 'gestor_pd'
        and pm.is_active = true
        and (not v_has_rule or coalesce(v_rule.notify_project_managers, true))

      union

      select pm.user_id
      from public.pd_project_members pm
      where pm.project_id = new.project_id
        and pm.member_role = 'coordenador_pd'
        and pm.is_active = true
        and (not v_has_rule or coalesce(v_rule.notify_project_coordinators, true))
    )
    select distinct r.user_id
    from recipients r
    where r.user_id is not null
      and (coalesce(v_rule.notify_actor, false) = true or r.user_id is distinct from v_actor)
  loop
    perform public.safe_create_notification(
      v_rec.user_id,
      v_title,
      v_body,
      v_link,
      'pd_deliverable_updated'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_pd_project_deliverable_updated on public.pd_project_deliverables;
create trigger trg_notify_pd_project_deliverable_updated
after update on public.pd_project_deliverables
for each row
execute function public.notify_pd_project_deliverable_updated();

commit;
