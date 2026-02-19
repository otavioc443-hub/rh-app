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
values (
  'project_updated',
  true,
  false,
  true,
  true,
  true,
  false,
  '/diretoria/projetos'
)
on conflict (event_key) do nothing;

create or replace function public.notify_project_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_title text;
  v_body text;
  v_link text := '/diretoria/projetos';
  v_rec record;
  v_changed boolean := false;
  v_rule public.notification_automation_rules%rowtype;
  v_has_rule boolean := false;
begin
  v_changed :=
    new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.owner_user_id is distinct from old.owner_user_id
    or new.start_date is distinct from old.start_date
    or new.end_date is distinct from old.end_date
    or new.status is distinct from old.status
    or new.project_stage is distinct from old.project_stage
    or new.budget_total is distinct from old.budget_total
    or new.client_id is distinct from old.client_id
    or new.project_type is distinct from old.project_type
    or new.project_scopes is distinct from old.project_scopes;

  if not v_changed then
    return new;
  end if;

  v_actor := auth.uid();
  v_title := 'Projeto atualizado';
  v_body := format(
    'O projeto "%s" teve informacoes atualizadas.',
    coalesce(nullif(trim(new.name), ''), new.id::text)
  );

  select *
    into v_rule
  from public.notification_automation_rules r
  where r.event_key = 'project_updated';
  v_has_rule := found;

  if v_has_rule and coalesce(v_rule.enabled, true) = false then
    return new;
  end if;

  v_link := coalesce(v_rule.link_default, '/diretoria/projetos');

  for v_rec in
    with recipients as (
      select new.owner_user_id as user_id
      where (not v_has_rule or coalesce(v_rule.notify_project_owner, true))
        and new.owner_user_id is not null

      union

      select old.owner_user_id as user_id
      where (not v_has_rule or coalesce(v_rule.notify_project_owner, true))
        and old.owner_user_id is not null

      union

      select pm.user_id
      from public.project_members pm
      where pm.project_id = new.id
        and pm.member_role = 'gestor'
        and (not v_has_rule or coalesce(v_rule.notify_project_managers, true))

      union

      select pm.user_id
      from public.project_members pm
      where pm.project_id = new.id
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
      v_link,
      'project_updated'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_project_updated on public.projects;
create trigger trg_notify_project_updated
after update on public.projects
for each row
execute function public.notify_project_updated();

commit;
