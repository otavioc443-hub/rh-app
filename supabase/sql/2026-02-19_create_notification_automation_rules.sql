begin;

create or replace function public.safe_create_notification(
  p_to_user_id uuid,
  p_title text,
  p_body text,
  p_link text,
  p_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_to_user_id is null then
    return;
  end if;

  if to_regclass('public.notifications') is null then
    return;
  end if;

  begin
    insert into public.notifications (to_user_id, title, body, link, type)
    values (p_to_user_id, p_title, p_body, p_link, p_type);
  exception
    when others then
      return;
  end;
end;
$$;

create table if not exists public.notification_automation_rules (
  event_key text primary key,
  enabled boolean not null default true,
  notify_assigned_user boolean not null default true,
  notify_project_owner boolean not null default true,
  notify_project_managers boolean not null default true,
  notify_project_coordinators boolean not null default true,
  notify_actor boolean not null default false,
  link_default text null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_notification_automation_rules_updated_at on public.notification_automation_rules;
create trigger trg_notification_automation_rules_updated_at
before update on public.notification_automation_rules
for each row execute function public.set_updated_at();

alter table public.notification_automation_rules enable row level security;

drop policy if exists notification_automation_rules_select on public.notification_automation_rules;
create policy notification_automation_rules_select
on public.notification_automation_rules
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists notification_automation_rules_insert on public.notification_automation_rules;
create policy notification_automation_rules_insert
on public.notification_automation_rules
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists notification_automation_rules_update on public.notification_automation_rules;
create policy notification_automation_rules_update
on public.notification_automation_rules
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
  ('deliverable_approved', true, true, true, true, true, false, '/gestor/projetos'),
  ('deliverable_approved_with_comments', true, true, true, true, true, false, '/coordenador/projetos'),
  ('pd_deliverable_approved', true, true, true, true, true, false, '/p-d/projetos'),
  ('pd_deliverable_approved_with_comments', true, true, true, true, true, false, '/p-d/projetos')
on conflict (event_key) do nothing;

create or replace function public.notify_project_deliverable_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_key text;
  v_rule public.notification_automation_rules%rowtype;
  v_has_rule boolean := false;
  v_deliverable record;
  v_owner_id uuid;
  v_title text;
  v_body text;
  v_link text;
  v_rec record;
begin
  if new.status_to not in ('approved', 'approved_with_comments') then
    return new;
  end if;

  v_event_key := case when new.status_to = 'approved_with_comments' then 'deliverable_approved_with_comments' else 'deliverable_approved' end;

  select *
    into v_rule
  from public.notification_automation_rules r
  where r.event_key = v_event_key;
  v_has_rule := found;

  if v_has_rule and coalesce(v_rule.enabled, true) = false then
    return new;
  end if;

  select d.id, d.title, d.assigned_to, d.project_id
    into v_deliverable
  from public.project_deliverables d
  where d.id = new.deliverable_id;

  if not found then
    return new;
  end if;

  select p.owner_user_id into v_owner_id
  from public.projects p
  where p.id = v_deliverable.project_id;

  v_title := case when new.status_to = 'approved_with_comments'
    then 'Documento aprovado com comentarios'
    else 'Documento aprovado'
  end;

  v_body := format(
    'Entregavel "%s" foi %s.',
    coalesce(nullif(trim(v_deliverable.title), ''), v_deliverable.id::text),
    case when new.status_to = 'approved_with_comments' then 'aprovado com comentarios' else 'aprovado' end
  );

  if new.comment is not null and btrim(new.comment) <> '' then
    v_body := v_body || ' Comentario: ' || new.comment;
  end if;

  v_link := coalesce(v_rule.link_default, '/coordenador/projetos');

  for v_rec in
    with recipients as (
      select v_deliverable.assigned_to as user_id
      where (not v_has_rule or coalesce(v_rule.notify_assigned_user, true)) and v_deliverable.assigned_to is not null

      union

      select v_owner_id as user_id
      where (not v_has_rule or coalesce(v_rule.notify_project_owner, true)) and v_owner_id is not null

      union

      select pm.user_id
      from public.project_members pm
      where pm.project_id = v_deliverable.project_id
        and pm.member_role = 'gestor'
        and (not v_has_rule or coalesce(v_rule.notify_project_managers, true))

      union

      select pm.user_id
      from public.project_members pm
      where pm.project_id = v_deliverable.project_id
        and pm.member_role = 'coordenador'
        and (not v_has_rule or coalesce(v_rule.notify_project_coordinators, true))
    )
    select distinct r.user_id
    from recipients r
    where r.user_id is not null
      and (coalesce(v_rule.notify_actor, false) = true or r.user_id is distinct from new.actor_user_id)
  loop
    perform public.safe_create_notification(
      v_rec.user_id,
      v_title,
      v_body,
      case when v_rec.user_id = v_deliverable.assigned_to then '/meu-perfil/projetos' else v_link end,
      v_event_key
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_project_deliverable_approval on public.project_deliverable_timeline;
create trigger trg_notify_project_deliverable_approval
after insert on public.project_deliverable_timeline
for each row
execute function public.notify_project_deliverable_approval();

create or replace function public.notify_pd_project_deliverable_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_key text;
  v_rule public.notification_automation_rules%rowtype;
  v_has_rule boolean := false;
  v_deliverable record;
  v_owner_id uuid;
  v_title text;
  v_body text;
  v_rec record;
begin
  if new.status_to not in ('approved', 'approved_with_comments') then
    return new;
  end if;

  v_event_key := case when new.status_to = 'approved_with_comments' then 'pd_deliverable_approved_with_comments' else 'pd_deliverable_approved' end;

  select *
    into v_rule
  from public.notification_automation_rules r
  where r.event_key = v_event_key;
  v_has_rule := found;

  if v_has_rule and coalesce(v_rule.enabled, true) = false then
    return new;
  end if;

  select d.id, d.title, d.assigned_to, d.project_id
    into v_deliverable
  from public.pd_project_deliverables d
  where d.id = new.deliverable_id;

  if not found then
    return new;
  end if;

  select p.owner_user_id into v_owner_id
  from public.pd_projects p
  where p.id = v_deliverable.project_id;

  v_title := case when new.status_to = 'approved_with_comments'
    then 'Entregavel P&D aprovado com comentarios'
    else 'Entregavel P&D aprovado'
  end;

  v_body := format(
    'Entregavel "%s" foi %s.',
    coalesce(nullif(trim(v_deliverable.title), ''), v_deliverable.id::text),
    case when new.status_to = 'approved_with_comments' then 'aprovado com comentarios' else 'aprovado' end
  );

  if new.comment is not null and btrim(new.comment) <> '' then
    v_body := v_body || ' Comentario: ' || new.comment;
  end if;

  for v_rec in
    with recipients as (
      select v_deliverable.assigned_to as user_id
      where (not v_has_rule or coalesce(v_rule.notify_assigned_user, true)) and v_deliverable.assigned_to is not null

      union

      select v_owner_id as user_id
      where (not v_has_rule or coalesce(v_rule.notify_project_owner, true)) and v_owner_id is not null

      union

      select pm.user_id
      from public.pd_project_members pm
      where pm.project_id = v_deliverable.project_id
        and pm.member_role = 'gestor_pd'
        and pm.is_active = true
        and (not v_has_rule or coalesce(v_rule.notify_project_managers, true))

      union

      select pm.user_id
      from public.pd_project_members pm
      where pm.project_id = v_deliverable.project_id
        and pm.member_role = 'coordenador_pd'
        and pm.is_active = true
        and (not v_has_rule or coalesce(v_rule.notify_project_coordinators, true))
    )
    select distinct r.user_id
    from recipients r
    where r.user_id is not null
      and (coalesce(v_rule.notify_actor, false) = true or r.user_id is distinct from new.actor_user_id)
  loop
    perform public.safe_create_notification(
      v_rec.user_id,
      v_title,
      v_body,
      '/p-d/projetos',
      v_event_key
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_pd_project_deliverable_approval on public.pd_project_deliverable_timeline;
create trigger trg_notify_pd_project_deliverable_approval
after insert on public.pd_project_deliverable_timeline
for each row
execute function public.notify_pd_project_deliverable_approval();

commit;
