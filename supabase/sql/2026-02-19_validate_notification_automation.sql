-- Validacao tecnica: automacao de notificacoes de aprovacao de entregaveis
-- Script somente leitura.

-- 1) Regras de automacao cadastradas
select
  event_key,
  enabled,
  notify_assigned_user,
  notify_project_owner,
  notify_project_managers,
  notify_project_coordinators,
  notify_actor,
  link_default,
  updated_at
from public.notification_automation_rules
order by event_key;

-- 2) Funcoes necessarias
select
  p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'safe_create_notification',
    'notify_project_deliverable_approval',
    'notify_pd_project_deliverable_approval'
  )
order by p.proname;

-- 3) Triggers de aprovacao ativos
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
    'trg_notify_project_deliverable_approval',
    'trg_notify_pd_project_deliverable_approval'
  )
order by c.relname, t.tgname;

-- 4) Ultimas notificacoes de aprovacao (24h)
select
  n.id,
  n.to_user_id,
  n.type,
  n.title,
  n.created_at
from public.notifications n
where n.created_at >= now() - interval '24 hours'
  and n.type in (
    'deliverable_approved',
    'deliverable_approved_with_comments',
    'pd_deliverable_approved',
    'pd_deliverable_approved_with_comments'
  )
order by n.created_at desc
limit 100;

-- 5) Trigger de auditoria das regras
select
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid) as trigger_def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and t.tgname = 'trg_notification_automation_rules_audit';

-- 6) Ultimas alteracoes das regras de notificacao (auditoria)
select
  a.id,
  a.event_key,
  a.action,
  a.changed_by,
  a.changed_at
from public.notification_automation_rules_audit a
order by a.changed_at desc
limit 100;
