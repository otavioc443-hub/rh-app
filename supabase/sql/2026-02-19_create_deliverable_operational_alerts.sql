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
      -- Nao interrompe fluxo principal por erro de notificacao.
      return;
  end;
end;
$$;

create or replace function public.notify_project_deliverable_rework()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_owner_id uuid;
  v_title text;
  v_body text;
  v_link text;
  v_rec record;
begin
  if new.event_type is distinct from 'returned_for_rework' then
    return new;
  end if;

  v_project_id := new.project_id;
  v_title := 'Entregavel retornou para ajuste';
  v_body := format('Documento %s retornou para ajuste. Motivo: %s', new.deliverable_id, coalesce(new.comment, 'sem motivo informado'));
  v_link := '/coordenador/projetos';

  select p.owner_user_id into v_owner_id
  from public.projects p
  where p.id = v_project_id;

  perform public.safe_create_notification(v_owner_id, v_title, v_body, v_link, 'deliverable_rework');

  for v_rec in
    select distinct a.user_id
    from public.project_deliverable_assignees a
    where a.deliverable_id = new.deliverable_id
    union
    select d.assigned_to
    from public.project_deliverables d
    where d.id = new.deliverable_id and d.assigned_to is not null
  loop
    perform public.safe_create_notification(v_rec.user_id, v_title, v_body, '/meu-perfil/projetos', 'deliverable_rework');
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_project_deliverable_rework on public.project_deliverable_timeline;
create trigger trg_notify_project_deliverable_rework
after insert on public.project_deliverable_timeline
for each row
execute function public.notify_project_deliverable_rework();

create or replace function public.notify_pd_project_deliverable_rework()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_title text;
  v_body text;
  v_rec record;
begin
  if new.event_type is distinct from 'returned_for_rework' then
    return new;
  end if;

  v_title := 'Entregavel P&D retornou para ajuste';
  v_body := format('Documento %s retornou para ajuste. Motivo: %s', new.deliverable_id, coalesce(new.comment, 'sem motivo informado'));

  select p.owner_user_id into v_owner_id
  from public.pd_projects p
  where p.id = new.project_id;

  perform public.safe_create_notification(v_owner_id, v_title, v_body, '/p-d/projetos', 'deliverable_rework');

  for v_rec in
    select d.assigned_to as user_id
    from public.pd_project_deliverables d
    where d.id = new.deliverable_id
      and d.assigned_to is not null
    union
    select m.user_id
    from public.pd_project_members m
    where m.project_id = new.project_id
      and m.is_active = true
  loop
    perform public.safe_create_notification(v_rec.user_id, v_title, v_body, '/p-d/projetos', 'deliverable_rework');
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_pd_project_deliverable_rework on public.pd_project_deliverable_timeline;
create trigger trg_notify_pd_project_deliverable_rework
after insert on public.pd_project_deliverable_timeline
for each row
execute function public.notify_pd_project_deliverable_rework();

commit;
