begin;

-- Auditoria detalhada de eventos contratuais (criacao, decisao financeira, aplicacao).
create table if not exists public.project_contract_event_audit (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.project_contract_events(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_role text null,
  action_type text not null check (
    action_type in (
      'created',
      'status_changed',
      'finance_decision',
      'applied_to_project',
      'notification_dispatched',
      'updated'
    )
  ),
  status_from text null,
  status_to text null,
  notes text null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_contract_event_audit_event
  on public.project_contract_event_audit(event_id, created_at desc);

create index if not exists idx_project_contract_event_audit_project
  on public.project_contract_event_audit(project_id, created_at desc);

alter table public.project_contract_event_audit enable row level security;

-- Leitura: membros do projeto e papeis administrativos.
drop policy if exists project_contract_event_audit_select on public.project_contract_event_audit;
create policy project_contract_event_audit_select
on public.project_contract_event_audit
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro')
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_contract_event_audit.project_id
        and pr.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_contract_event_audit.project_id
        and pm.user_id = auth.uid()
    )
  )
);

-- Escrita via app: admin/financeiro (service role tambem pode inserir).
drop policy if exists project_contract_event_audit_insert on public.project_contract_event_audit;
create policy project_contract_event_audit_insert
on public.project_contract_event_audit
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro')
);

commit;

