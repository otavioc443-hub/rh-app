begin;

create table if not exists public.feedback_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  collect_start timestamptz not null,
  collect_end timestamptz not null,
  release_start timestamptz not null,
  release_end timestamptz not null,
  active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table if exists public.feedback_cycles enable row level security;

drop policy if exists feedback_cycles_select_auth on public.feedback_cycles;
create policy feedback_cycles_select_auth
on public.feedback_cycles
for select
to authenticated
using (true);

drop policy if exists feedback_cycles_write_rh_admin on public.feedback_cycles;
create policy feedback_cycles_write_rh_admin
on public.feedback_cycles
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('rh', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('rh', 'admin')
  )
);

alter table if exists public.feedbacks
  add column if not exists target_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists evaluator_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists source_role text null,
  add column if not exists cycle_id uuid null references public.feedback_cycles(id) on delete set null,
  add column if not exists released_to_collaborator boolean not null default false,
  add column if not exists details_json jsonb not null default '{}'::jsonb,
  add column if not exists final_score numeric(4,2) null,
  add column if not exists final_classification text null,
  add column if not exists status text not null default 'sent';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedbacks_status_check'
  ) then
    alter table public.feedbacks
      add constraint feedbacks_status_check
      check (status in ('draft', 'sent'));
  end if;
end $$;

create index if not exists idx_feedbacks_target_created
  on public.feedbacks(target_user_id, created_at desc);

create index if not exists idx_feedbacks_cycle
  on public.feedbacks(cycle_id);

commit;
