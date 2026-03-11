begin;

alter table if exists public.feedback_cycles
  add column if not exists one_on_one_warn_days integer not null default 2,
  add column if not exists one_on_one_danger_days integer not null default 5,
  add column if not exists collaborator_ack_warn_days integer not null default 3,
  add column if not exists collaborator_ack_danger_days integer not null default 7;

alter table if exists public.feedback_cycles
  drop constraint if exists feedback_cycles_one_on_one_warn_days_check,
  drop constraint if exists feedback_cycles_one_on_one_danger_days_check,
  drop constraint if exists feedback_cycles_collaborator_ack_warn_days_check,
  drop constraint if exists feedback_cycles_collaborator_ack_danger_days_check;

alter table if exists public.feedback_cycles
  add constraint feedback_cycles_one_on_one_warn_days_check
    check (one_on_one_warn_days >= 1 and one_on_one_warn_days <= 60),
  add constraint feedback_cycles_one_on_one_danger_days_check
    check (one_on_one_danger_days >= one_on_one_warn_days and one_on_one_danger_days <= 90),
  add constraint feedback_cycles_collaborator_ack_warn_days_check
    check (collaborator_ack_warn_days >= 1 and collaborator_ack_warn_days <= 60),
  add constraint feedback_cycles_collaborator_ack_danger_days_check
    check (collaborator_ack_danger_days >= collaborator_ack_warn_days and collaborator_ack_danger_days <= 90);

commit;

