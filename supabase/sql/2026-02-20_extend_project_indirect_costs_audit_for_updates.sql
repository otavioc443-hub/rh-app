begin;

alter table if exists public.project_indirect_costs_audit
  drop constraint if exists project_indirect_costs_audit_action_check;

alter table if exists public.project_indirect_costs_audit
  add constraint project_indirect_costs_audit_action_check
  check (action in ('delete', 'update'));

alter table if exists public.project_indirect_costs_audit
  add column if not exists new_row jsonb null;

commit;
