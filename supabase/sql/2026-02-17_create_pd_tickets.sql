begin;

-- Chamados P&D para demandas de sistemas, infraestrutura e equipamentos.
create table if not exists public.pd_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_role text null,

  title text not null,
  request_type text not null check (
    request_type in (
      'solidarvt',
      'solides',
      'server_access',
      'equipment',
      'system_improvement',
      'other'
    )
  ),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  description text not null,

  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_user', 'resolved', 'cancelled')),
  assigned_to uuid null references auth.users(id) on delete set null,
  resolution_notes text null,

  opened_at timestamptz not null default now(),
  due_at timestamptz null,
  resolved_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pd_tickets_requester on public.pd_tickets(requester_user_id, created_at desc);
create index if not exists idx_pd_tickets_status on public.pd_tickets(status, created_at desc);
create index if not exists idx_pd_tickets_type on public.pd_tickets(request_type, created_at desc);

drop trigger if exists trg_pd_tickets_updated_at on public.pd_tickets;
create trigger trg_pd_tickets_updated_at
before update on public.pd_tickets
for each row execute function public.set_updated_at();

alter table public.pd_tickets enable row level security;

-- Leitura: dono do chamado + papeis de atendimento.
drop policy if exists pd_tickets_select on public.pd_tickets;
create policy pd_tickets_select
on public.pd_tickets
for select
to authenticated
using (
  public.current_active() = true
  and (
    requester_user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
  )
);

-- Abertura: qualquer usuario ativo para si proprio.
drop policy if exists pd_tickets_insert on public.pd_tickets;
create policy pd_tickets_insert
on public.pd_tickets
for insert
to authenticated
with check (
  public.current_active() = true
  and requester_user_id = auth.uid()
);

-- Atualizacao: equipe de atendimento (Admin/RH/Financeiro/Gestor).
drop policy if exists pd_tickets_update_support on public.pd_tickets;
create policy pd_tickets_update_support
on public.pd_tickets
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
)
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
);

-- Exclusao: apenas Admin.
drop policy if exists pd_tickets_delete_admin on public.pd_tickets;
create policy pd_tickets_delete_admin
on public.pd_tickets
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

commit;
