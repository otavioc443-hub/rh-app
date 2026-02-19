begin;

update public.notification_automation_rules
set
  enabled = true,
  notify_actor = true,
  updated_at = now()
where event_key in (
  'project_updated',
  'deliverable_updated',
  'pd_deliverable_updated'
);

commit;
