begin;

-- O megafone passa a ser uma central direcionada por destinatario.
-- Removemos o espelhamento global para admins para preservar notificacoes individuais.
drop trigger if exists trg_fanout_notification_to_admins on public.notifications;
drop function if exists public.fanout_notification_to_admins();

alter table if exists public.notifications
  add column if not exists category text null,
  add column if not exists severity text not null default 'info',
  add column if not exists action_required boolean not null default false,
  add column if not exists entity_type text null,
  add column if not exists entity_id text null,
  add column if not exists dedup_key text null,
  add column if not exists data jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notifications_severity_check'
  ) then
    alter table public.notifications
      add constraint notifications_severity_check
      check (severity in ('info', 'success', 'warning', 'critical'));
  end if;
end $$;

create unique index if not exists idx_notifications_dedup_key
  on public.notifications(to_user_id, dedup_key);

create index if not exists idx_notifications_user_category_created
  on public.notifications(to_user_id, category, created_at desc);

create index if not exists idx_notifications_user_action_created
  on public.notifications(to_user_id, action_required, created_at desc);

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
  ('home_announcement', true, true, false, false, false, false, '/home'),
  ('pulsehub_announcement', true, true, false, false, false, false, '/institucional/rede-social'),
  ('pulsehub_campaign', true, true, false, false, false, false, '/institucional/rede-social'),
  ('support_ticket_created', true, true, false, true, false, false, '/notificacoes'),
  ('invoice_submitted', true, true, false, false, false, false, '/financeiro/notas-fiscais'),
  ('invoice_approved', true, true, false, false, false, false, '/meu-perfil/nota-fiscal'),
  ('invoice_rejected', true, true, false, false, false, false, '/meu-perfil/nota-fiscal'),
  ('invoice_cancelled', true, true, false, false, false, false, '/meu-perfil/nota-fiscal'),
  ('extra_payment_created', true, true, false, false, false, false, '/financeiro/pagamentos-extras'),
  ('extra_payment_approved', true, true, false, false, false, false, '/meu-perfil/projetos'),
  ('extra_payment_rejected', true, true, false, false, false, false, '/meu-perfil/projetos'),
  ('extra_payment_paid', true, true, false, false, false, false, '/meu-perfil/projetos'),
  ('feedback_submitted', true, true, false, false, false, false, '/meu-perfil/feedback'),
  ('feedback_released', true, true, false, false, false, false, '/meu-perfil/feedback'),
  ('pdi_created', true, true, false, false, false, false, '/meu-perfil/pdi'),
  ('pdi_updated', true, true, false, false, false, false, '/meu-perfil/pdi'),
  ('behavior_invite', true, true, false, false, false, false, '/meu-perfil/mapa-comportamental'),
  ('behavior_completed', true, true, false, false, false, false, '/rh/mapa-comportamental/analises'),
  ('lgpd_request_created', true, true, false, false, false, false, '/rh/lgpd'),
  ('lgpd_request_updated', true, true, false, false, false, false, '/institucional/privacidade'),
  ('ethics_case_created', true, true, false, false, false, false, '/admin/canal-de-etica'),
  ('ethics_case_updated', true, true, false, false, false, false, '/admin/canal-de-etica'),
  ('pd_ticket_created', true, true, false, false, false, false, '/p-d/chamados'),
  ('pd_ticket_updated', true, true, false, false, false, false, '/meu-perfil/chamados'),
  ('institutional_event_created', true, true, false, false, false, false, '/agenda/agenda-institucional'),
  ('lms_assignment', true, true, false, false, false, false, '/lms/meus-treinamentos'),
  ('lms_due_soon', true, true, false, false, false, false, '/lms/meus-treinamentos'),
  ('lms_overdue', true, true, false, false, false, false, '/lms/meus-treinamentos'),
  ('lms_lesson_question', true, true, false, false, false, false, '/rh/lms/interacoes'),
  ('lms_lesson_answer', true, true, false, false, false, false, '/lms/meus-treinamentos'),
  ('lms_quiz_review', true, true, false, false, false, false, '/rh/lms/avaliacoes'),
  ('lms_quiz_reviewed', true, true, false, false, false, false, '/lms/meus-treinamentos'),
  ('lms_manual_reminder', true, true, false, false, false, false, '/lms/meus-treinamentos'),
  ('lms_weekly_summary', true, true, false, false, false, false, '/rh/lms')
on conflict (event_key) do nothing;

create or replace function public.cleanup_old_notifications(p_retention_days integer default 180)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
  v_days integer;
begin
  v_days := greatest(coalesce(p_retention_days, 180), 30);

  delete from public.notifications
  where created_at < now() - make_interval(days => v_days)
    and read_at is not null;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

commit;
