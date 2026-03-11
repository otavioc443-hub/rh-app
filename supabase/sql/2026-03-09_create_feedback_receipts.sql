begin;

create table if not exists public.feedback_receipts (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedbacks(id) on delete cascade,
  collaborator_user_id uuid not null references auth.users(id) on delete cascade,
  collaborator_comment text null,
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint feedback_receipts_unique unique (feedback_id, collaborator_user_id),
  constraint feedback_receipts_comment_len_check check (
    collaborator_comment is null or char_length(collaborator_comment) <= 1000
  )
);

create index if not exists idx_feedback_receipts_collaborator
  on public.feedback_receipts(collaborator_user_id, acknowledged_at desc);

alter table if exists public.feedback_receipts enable row level security;

drop policy if exists feedback_receipts_select_own_or_rh_admin on public.feedback_receipts;
create policy feedback_receipts_select_own_or_rh_admin
on public.feedback_receipts
for select
to authenticated
using (
  collaborator_user_id = auth.uid()
  or public.current_role() in ('rh', 'admin')
);

drop policy if exists feedback_receipts_insert_own_collaborator on public.feedback_receipts;
create policy feedback_receipts_insert_own_collaborator
on public.feedback_receipts
for insert
to authenticated
with check (
  collaborator_user_id = auth.uid()
  and public.current_role() = 'colaborador'
);

commit;

