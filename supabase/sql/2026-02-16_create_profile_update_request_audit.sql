begin;

-- Auditoria de analise/decisao das solicitacoes de adequacao de dados.
create table if not exists public.profile_update_request_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.profile_update_requests(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_role text null,
  status_from text null,
  status_to text not null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profile_update_request_audit_request
  on public.profile_update_request_audit(request_id, created_at desc);

alter table public.profile_update_request_audit enable row level security;

-- Leitura: solicitante dono da request + RH/Admin/Financeiro.
drop policy if exists profile_update_request_audit_select on public.profile_update_request_audit;
create policy profile_update_request_audit_select
on public.profile_update_request_audit
for select
to authenticated
using (
  public.current_active() = true
  and (
    requester_user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
);

-- Escrita: RH/Admin/Financeiro.
drop policy if exists profile_update_request_audit_insert on public.profile_update_request_audit;
create policy profile_update_request_audit_insert
on public.profile_update_request_audit
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro')
);

commit;
