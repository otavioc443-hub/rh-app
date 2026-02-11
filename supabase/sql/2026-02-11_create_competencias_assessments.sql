-- Estrutura inicial para modulo de Competencias (autoavaliacao)

begin;

create table if not exists public.competencias_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scores jsonb not null,
  comment text null,
  created_at timestamptz not null default now()
);

alter table public.competencias_assessments enable row level security;

drop policy if exists competencias_assessments_select_own on public.competencias_assessments;
create policy competencias_assessments_select_own
on public.competencias_assessments
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists competencias_assessments_insert_own on public.competencias_assessments;
create policy competencias_assessments_insert_own
on public.competencias_assessments
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists competencias_assessments_update_own on public.competencias_assessments;
create policy competencias_assessments_update_own
on public.competencias_assessments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists competencias_assessments_delete_own on public.competencias_assessments;
create policy competencias_assessments_delete_own
on public.competencias_assessments
for delete
to authenticated
using (user_id = auth.uid());

create index if not exists idx_competencias_assessments_user_created
  on public.competencias_assessments(user_id, created_at desc);

commit;
