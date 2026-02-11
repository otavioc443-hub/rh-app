-- Estrutura inicial para modulo de Avaliacao de Desempenho (autoavaliacao)

begin;

create table if not exists public.performance_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_label text not null,
  goals_score smallint not null check (goals_score between 1 and 5),
  quality_score smallint not null check (quality_score between 1 and 5),
  productivity_score smallint not null check (productivity_score between 1 and 5),
  behavior_score smallint not null check (behavior_score between 1 and 5),
  manager_feedback text null,
  self_comment text null,
  created_at timestamptz not null default now()
);

alter table public.performance_assessments enable row level security;

drop policy if exists performance_assessments_select_own on public.performance_assessments;
create policy performance_assessments_select_own
on public.performance_assessments
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists performance_assessments_insert_own on public.performance_assessments;
create policy performance_assessments_insert_own
on public.performance_assessments
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists performance_assessments_update_own on public.performance_assessments;
create policy performance_assessments_update_own
on public.performance_assessments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists performance_assessments_delete_own on public.performance_assessments;
create policy performance_assessments_delete_own
on public.performance_assessments
for delete
to authenticated
using (user_id = auth.uid());

create index if not exists idx_performance_assessments_user_created
  on public.performance_assessments(user_id, created_at desc);

commit;
