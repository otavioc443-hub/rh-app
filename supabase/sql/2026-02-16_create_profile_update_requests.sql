begin;

-- Solicitacoes de adequacao de dados cadastrais/financeiros/contratuais do colaborador.
create table if not exists public.profile_update_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  collaborator_id uuid null references public.colaboradores(id) on delete set null,

  request_type text not null check (request_type in ('financial', 'personal', 'contractual', 'avatar', 'other')),
  title text not null,
  details text not null,
  requested_changes jsonb null,

  status text not null default 'pending' check (status in ('pending', 'in_review', 'approved', 'rejected', 'implemented', 'cancelled')),
  review_notes text null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profile_update_requests_requester
  on public.profile_update_requests(requester_user_id, created_at desc);

create index if not exists idx_profile_update_requests_status
  on public.profile_update_requests(status, created_at desc);

drop trigger if exists trg_profile_update_requests_updated_at on public.profile_update_requests;
create trigger trg_profile_update_requests_updated_at
before update on public.profile_update_requests
for each row execute function public.set_updated_at();

alter table public.profile_update_requests enable row level security;

-- Leitura: proprio solicitante, RH/Admin/Financeiro.
drop policy if exists profile_update_requests_select on public.profile_update_requests;
create policy profile_update_requests_select
on public.profile_update_requests
for select
to authenticated
using (
  public.current_active() = true
  and (
    requester_user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
);

-- Criacao: proprio usuario autenticado.
drop policy if exists profile_update_requests_insert on public.profile_update_requests;
create policy profile_update_requests_insert
on public.profile_update_requests
for insert
to authenticated
with check (
  public.current_active() = true
  and requester_user_id = auth.uid()
);

-- Atualizacao/decisao: RH/Admin/Financeiro.
drop policy if exists profile_update_requests_update on public.profile_update_requests;
create policy profile_update_requests_update
on public.profile_update_requests
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro')
)
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro')
);

-- Cancelamento pelo proprio solicitante.
drop policy if exists profile_update_requests_delete on public.profile_update_requests;
create policy profile_update_requests_delete
on public.profile_update_requests
for delete
to authenticated
using (
  public.current_active() = true
  and requester_user_id = auth.uid()
);

commit;
