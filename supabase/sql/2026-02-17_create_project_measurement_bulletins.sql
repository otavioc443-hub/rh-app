begin;

-- Medicoes/boletins para faturamento ao cliente e acompanhamento de pagamento.
create table if not exists public.project_measurement_bulletins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  reference_month date not null,
  bulletin_number text null,
  invoice_number text null,

  amount_total numeric(14,2) not null check (amount_total >= 0),
  paid_amount numeric(14,2) null check (paid_amount is null or paid_amount >= 0),

  status text not null default 'em_analise' check (
    status in (
      'em_analise',
      'faturado',
      'enviado_cliente',
      'previsao_pagamento',
      'pago',
      'parcialmente_pago',
      'atrasado',
      'cancelado',
      'outro'
    )
  ),

  issue_date date null,
  expected_payment_date date null,
  paid_at date null,

  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_measurement_bulletins_project
  on public.project_measurement_bulletins(project_id, reference_month desc, created_at desc);

create index if not exists idx_project_measurement_bulletins_status
  on public.project_measurement_bulletins(status, expected_payment_date, created_at desc);

drop trigger if exists trg_project_measurement_bulletins_updated_at on public.project_measurement_bulletins;
create trigger trg_project_measurement_bulletins_updated_at
before update on public.project_measurement_bulletins
for each row execute function public.set_updated_at();

alter table public.project_measurement_bulletins enable row level security;

-- Leitura: admin, financeiro, rh e membros do projeto.
drop policy if exists project_measurement_bulletins_select on public.project_measurement_bulletins;
create policy project_measurement_bulletins_select
on public.project_measurement_bulletins
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'financeiro', 'rh')
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_measurement_bulletins.project_id
        and pm.user_id = auth.uid()
    )
  )
);

-- Escrita: admin (diretoria) e financeiro.
drop policy if exists project_measurement_bulletins_insert on public.project_measurement_bulletins;
create policy project_measurement_bulletins_insert
on public.project_measurement_bulletins
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro')
);

drop policy if exists project_measurement_bulletins_update on public.project_measurement_bulletins;
create policy project_measurement_bulletins_update
on public.project_measurement_bulletins
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro')
)
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro')
);

drop policy if exists project_measurement_bulletins_delete on public.project_measurement_bulletins;
create policy project_measurement_bulletins_delete
on public.project_measurement_bulletins
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

commit;

