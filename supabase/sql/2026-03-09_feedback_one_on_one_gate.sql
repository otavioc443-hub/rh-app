begin;

alter table if exists public.feedbacks
  add column if not exists one_on_one_completed_at timestamptz null,
  add column if not exists one_on_one_completed_by uuid null references auth.users(id) on delete set null;

create index if not exists idx_feedbacks_one_on_one_completed_at
  on public.feedbacks(one_on_one_completed_at);

commit;

