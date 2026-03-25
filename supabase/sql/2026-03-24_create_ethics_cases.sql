begin;

create table if not exists public.ethics_cases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  protocol text not null unique,
  subject text not null,
  description text not null,
  category text not null,
  risk_level text not null default 'Médio' check (risk_level in ('Baixo', 'Médio', 'Alto', 'Crítico')),
  status text not null default 'Recebido' check (status in ('Recebido', 'Em triagem', 'Em análise', 'Em investigação', 'Concluído', 'Encerrado', 'Reaberto')),
  is_anonymous boolean not null default true,
  reporter_name text null,
  reporter_email text null,
  assigned_to uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz null
);

create table if not exists public.ethics_case_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.ethics_cases(id) on delete cascade,
  previous_status text null,
  new_status text not null check (new_status in ('Recebido', 'Em triagem', 'Em análise', 'Em investigação', 'Concluído', 'Encerrado', 'Reaberto')),
  comment text null,
  changed_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ethics_cases_company_created
  on public.ethics_cases(company_id, created_at desc);

create index if not exists idx_ethics_cases_company_status
  on public.ethics_cases(company_id, status, created_at desc);

create index if not exists idx_ethics_cases_assigned_to
  on public.ethics_cases(assigned_to);

create index if not exists idx_ethics_case_history_case_created
  on public.ethics_case_history(case_id, created_at desc);

drop trigger if exists trg_ethics_cases_updated_at on public.ethics_cases;
create trigger trg_ethics_cases_updated_at
before update on public.ethics_cases
for each row execute function public.set_updated_at();

alter table public.ethics_cases enable row level security;
alter table public.ethics_case_history enable row level security;

drop policy if exists ethics_cases_select_privileged on public.ethics_cases;
create policy ethics_cases_select_privileged
on public.ethics_cases
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'compliance')
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id is null
    )
    or company_id = (
      select p.company_id
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    )
  )
);

drop policy if exists ethics_cases_update_privileged on public.ethics_cases;
create policy ethics_cases_update_privileged
on public.ethics_cases
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'compliance')
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id is null
    )
    or company_id = (
      select p.company_id
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    )
  )
)
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'compliance')
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id is null
    )
    or company_id = (
      select p.company_id
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    )
  )
);

drop policy if exists ethics_case_history_select_privileged on public.ethics_case_history;
create policy ethics_case_history_select_privileged
on public.ethics_case_history
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'compliance')
  and exists (
    select 1
    from public.ethics_cases c
    join public.profiles p on p.id = auth.uid()
    where c.id = ethics_case_history.case_id
      and (
        p.company_id is null
        or c.company_id = p.company_id
      )
  )
);

drop policy if exists ethics_case_history_insert_privileged on public.ethics_case_history;
create policy ethics_case_history_insert_privileged
on public.ethics_case_history
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'compliance')
  and exists (
    select 1
    from public.ethics_cases c
    join public.profiles p on p.id = auth.uid()
    where c.id = ethics_case_history.case_id
      and (
        p.company_id is null
        or c.company_id = p.company_id
      )
  )
);

commit;
