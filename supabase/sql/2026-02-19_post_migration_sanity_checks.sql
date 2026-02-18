-- Checklist tecnico de validacao apos aplicar as migrations de qualidade/retrabalho.
-- Script somente leitura.

-- 1) Estrutura: colunas novas em project_deliverables
select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'project_deliverables'
  and column_name in (
    'review_due_at',
    'approved_at',
    'approved_on_time',
    'approved_without_rework',
    'rework_count',
    'quality_expected_score',
    'quality_achieved_score'
  )
order by column_name;

-- 2) Estrutura: colunas novas em pd_project_deliverables
select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'pd_project_deliverables'
  and column_name in (
    'review_due_at',
    'approved_at',
    'approved_on_time',
    'approved_without_rework',
    'rework_count',
    'quality_expected_score',
    'quality_achieved_score'
  )
order by column_name;

-- 3) Funcoes criticas existentes
select
  p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'deliverable_status_transition_allowed',
    'validate_project_deliverable_status_transition',
    'validate_pd_project_deliverable_status_transition',
    'refresh_project_deliverable_quality_kpis',
    'refresh_pd_project_deliverable_quality_kpis',
    'notify_project_deliverable_rework',
    'notify_pd_project_deliverable_rework',
    'safe_create_notification'
  )
order by p.proname;

-- 4) Triggers criticos
select
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid) as trigger_def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and t.tgname in (
    'trg_validate_project_deliverable_status_transition',
    'trg_validate_pd_project_deliverable_status_transition',
    'trg_refresh_project_deliverable_quality_kpis_timeline',
    'trg_refresh_project_deliverable_quality_kpis_deliverable',
    'trg_refresh_pd_project_deliverable_quality_kpis_timeline',
    'trg_refresh_pd_project_deliverable_quality_kpis_deliverable',
    'trg_notify_project_deliverable_rework',
    'trg_notify_pd_project_deliverable_rework'
  )
order by c.relname, t.tgname;

-- 5) Dados: consistencia de KPI derivado (projetos padrao)
-- Esperado: qtd_inconsistente = 0.
with calc as (
  select
    d.id,
    coalesce((
      select count(*)
      from public.project_deliverable_timeline t
      where t.deliverable_id = d.id
        and (
          t.event_type = 'returned_for_rework'
          or (
            t.status_to in ('pending', 'in_progress')
            and t.status_from in ('sent', 'approved_with_comments')
          )
        )
    ), 0) as expected_rework_count
  from public.project_deliverables d
)
select count(*) as qtd_inconsistente
from calc c
join public.project_deliverables d on d.id = c.id
where coalesce(d.rework_count, 0) <> c.expected_rework_count;

-- 6) Dados: consistencia de KPI derivado (P&D)
-- Esperado: qtd_inconsistente = 0.
with calc as (
  select
    d.id,
    coalesce((
      select count(*)
      from public.pd_project_deliverable_timeline t
      where t.deliverable_id = d.id
        and (
          t.event_type = 'returned_for_rework'
          or (
            t.status_to in ('pending', 'in_progress')
            and t.status_from in ('sent', 'approved_with_comments')
          )
        )
    ), 0) as expected_rework_count
  from public.pd_project_deliverables d
)
select count(*) as qtd_inconsistente
from calc c
join public.pd_project_deliverables d on d.id = c.id
where coalesce(d.rework_count, 0) <> c.expected_rework_count;

-- 7) Alertas/notificacoes de retrabalho recentes (ultimas 24h)
-- Esperado: eventos -> notificacoes correspondentes.
select
  n.id,
  n.to_user_id,
  n.title,
  n.type,
  n.created_at
from public.notifications n
where n.type = 'deliverable_rework'
  and n.created_at >= now() - interval '24 hours'
order by n.created_at desc
limit 100;

-- 8) Ranking: usuarios com possivel impacto (base para validacao manual da UI)
select
  d.assigned_to as user_id,
  count(*) as total_entregaveis,
  count(*) filter (where d.approved_on_time is true and d.approved_without_rework is true) as aprovados_no_prazo_sem_retrabalho,
  count(*) filter (where coalesce(d.rework_count, 0) > 0) as com_retrabalho
from public.project_deliverables d
where d.assigned_to is not null
group by d.assigned_to
order by aprovados_no_prazo_sem_retrabalho desc, total_entregaveis desc
limit 30;
