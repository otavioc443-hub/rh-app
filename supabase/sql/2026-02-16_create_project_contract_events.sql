begin;

-- Eventos contratuais de projetos (aditivos, prorrogacoes, notificacoes e rescisoes).
create table if not exists public.project_contract_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  event_type text not null check (
    event_type in (
      'aditivo_valor',
      'prorrogacao_prazo',
      'aditivo_escopo',
      'notificacao',
      'rescisao',
      'outro'
    )
  ),
  status text not null default 'registrado' check (
    status in ('registrado', 'em_analise', 'aprovado', 'rejeitado', 'executado', 'cancelado')
  ),

  effective_date date not null,
  title text not null,
  description text null,

  additional_amount numeric(12,2) null check (additional_amount is null or additional_amount >= 0),
  from_budget_total numeric(12,2) null,
  to_budget_total numeric(12,2) null,

  from_end_date date null,
  to_end_date date null,

  notified_to text null,
  document_url text null,

  applied_to_project boolean not null default false,
  applied_at timestamptz null,

  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_contract_events_project
  on public.project_contract_events(project_id, effective_date desc, created_at desc);

create index if not exists idx_project_contract_events_type
  on public.project_contract_events(event_type, effective_date desc);

drop trigger if exists trg_project_contract_events_updated_at on public.project_contract_events;
create trigger trg_project_contract_events_updated_at
before update on public.project_contract_events
for each row execute function public.set_updated_at();

alter table public.project_contract_events enable row level security;

-- Leitura: membros do projeto ou papeis administrativos.
drop policy if exists project_contract_events_select on public.project_contract_events;
create policy project_contract_events_select
on public.project_contract_events
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro')
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_contract_events.project_id
        and pr.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_contract_events.project_id
        and pm.user_id = auth.uid()
    )
  )
);

-- Escrita: somente admin (diretoria).
drop policy if exists project_contract_events_insert on public.project_contract_events;
create policy project_contract_events_insert
on public.project_contract_events
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists project_contract_events_update on public.project_contract_events;
create policy project_contract_events_update
on public.project_contract_events
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
)
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists project_contract_events_delete on public.project_contract_events;
create policy project_contract_events_delete
on public.project_contract_events
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

commit;

