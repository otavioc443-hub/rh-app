-- Smoke test de qualidade/retrabalho com rollback (nao persiste dados).
-- Uso:
-- 1) Ajuste os UUIDs no bloco "params".
-- 2) Rode no SQL Editor.
-- 3) Confira os SELECTs finais.
-- 4) O script termina com ROLLBACK.

begin;

do $$
declare
  v_project_id uuid := '00000000-0000-0000-0000-000000000000';
  v_actor_user_id uuid := '00000000-0000-0000-0000-000000000000';
  v_assignee_user_id uuid := '00000000-0000-0000-0000-000000000000';
  v_ok_deliverable_id uuid;
  v_rework_deliverable_id uuid;
begin
  if v_project_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Preencha v_project_id no script.';
  end if;
  if v_actor_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Preencha v_actor_user_id no script.';
  end if;
  if v_assignee_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Preencha v_assignee_user_id no script.';
  end if;

  -- 1) Cria 2 entregaveis de teste
  insert into public.project_deliverables (
    project_id,
    title,
    description,
    due_date,
    assigned_to,
    status
  )
  values
    (v_project_id, 'SMOKE_TEST_OK', 'Fluxo sem retrabalho', current_date + 1, v_assignee_user_id, 'pending'),
    (v_project_id, 'SMOKE_TEST_REWORK', 'Fluxo com retrabalho', current_date + 1, v_assignee_user_id, 'pending')
  returning id
  into v_ok_deliverable_id;

  select id
  into v_rework_deliverable_id
  from public.project_deliverables
  where project_id = v_project_id
    and title = 'SMOKE_TEST_REWORK'
  order by created_at desc
  limit 1;

  if v_ok_deliverable_id is null or v_rework_deliverable_id is null then
    raise exception 'Falha ao criar entregaveis de teste.';
  end if;

  -- 2) Fluxo OK: pending -> in_progress -> sent -> approved
  update public.project_deliverables
  set status = 'in_progress'
  where id = v_ok_deliverable_id;
  insert into public.project_deliverable_timeline
    (deliverable_id, project_id, event_type, status_from, status_to, comment, actor_user_id)
  values
    (v_ok_deliverable_id, v_project_id, 'status_changed', 'pending', 'in_progress', null, v_actor_user_id);

  update public.project_deliverables
  set status = 'sent'
  where id = v_ok_deliverable_id;
  insert into public.project_deliverable_timeline
    (deliverable_id, project_id, event_type, status_from, status_to, comment, actor_user_id)
  values
    (v_ok_deliverable_id, v_project_id, 'status_changed', 'in_progress', 'sent', null, v_actor_user_id);

  update public.project_deliverables
  set status = 'approved'
  where id = v_ok_deliverable_id;
  insert into public.project_deliverable_timeline
    (deliverable_id, project_id, event_type, status_from, status_to, comment, actor_user_id)
  values
    (v_ok_deliverable_id, v_project_id, 'status_changed', 'sent', 'approved', null, v_actor_user_id);

  -- 3) Fluxo REWORK: pending -> in_progress -> sent -> returned_for_rework -> in_progress -> sent -> approved
  update public.project_deliverables
  set status = 'in_progress'
  where id = v_rework_deliverable_id;
  insert into public.project_deliverable_timeline
    (deliverable_id, project_id, event_type, status_from, status_to, comment, actor_user_id)
  values
    (v_rework_deliverable_id, v_project_id, 'status_changed', 'pending', 'in_progress', null, v_actor_user_id);

  update public.project_deliverables
  set status = 'sent'
  where id = v_rework_deliverable_id;
  insert into public.project_deliverable_timeline
    (deliverable_id, project_id, event_type, status_from, status_to, comment, actor_user_id)
  values
    (v_rework_deliverable_id, v_project_id, 'status_changed', 'in_progress', 'sent', null, v_actor_user_id);

  update public.project_deliverables
  set status = 'in_progress'
  where id = v_rework_deliverable_id;
  insert into public.project_deliverable_timeline
    (deliverable_id, project_id, event_type, status_from, status_to, comment, actor_user_id)
  values
    (v_rework_deliverable_id, v_project_id, 'returned_for_rework', 'sent', 'in_progress', 'Ajustar documento no smoke test', v_actor_user_id);

  update public.project_deliverables
  set status = 'sent'
  where id = v_rework_deliverable_id;
  insert into public.project_deliverable_timeline
    (deliverable_id, project_id, event_type, status_from, status_to, comment, actor_user_id)
  values
    (v_rework_deliverable_id, v_project_id, 'status_changed', 'in_progress', 'sent', null, v_actor_user_id);

  update public.project_deliverables
  set status = 'approved'
  where id = v_rework_deliverable_id;
  insert into public.project_deliverable_timeline
    (deliverable_id, project_id, event_type, status_from, status_to, comment, actor_user_id)
  values
    (v_rework_deliverable_id, v_project_id, 'status_changed', 'sent', 'approved', null, v_actor_user_id);

  raise notice 'OK_DELIVERABLE_ID: %', v_ok_deliverable_id;
  raise notice 'REWORK_DELIVERABLE_ID: %', v_rework_deliverable_id;
end;
$$;

-- 4) Validacao KPI derivado (esperado: OK com sem retrabalho=true, REWORK com rework_count>0)
select
  id,
  title,
  status,
  approved_at,
  approved_on_time,
  approved_without_rework,
  rework_count,
  quality_expected_score,
  quality_achieved_score
from public.project_deliverables
where title in ('SMOKE_TEST_OK', 'SMOKE_TEST_REWORK')
order by title;

-- 5) Validacao notificacao de retrabalho (se tabela notifications existir)
select
  id,
  to_user_id,
  title,
  type,
  created_at
from public.notifications
where type = 'deliverable_rework'
  and created_at >= now() - interval '10 minutes'
order by created_at desc
limit 50;

rollback;
