begin;

-- Controle mensal de caixa por projeto (saldo inicial, cobertura, deficit).
create table if not exists public.finance_monthly_cash_ledger (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  month_ref date not null,
  opening_balance numeric(14,2) not null default 0,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, month_ref)
);

create index if not exists idx_finance_monthly_cash_ledger_project
  on public.finance_monthly_cash_ledger(project_id, month_ref desc);

drop trigger if exists trg_finance_monthly_cash_ledger_updated_at on public.finance_monthly_cash_ledger;
create trigger trg_finance_monthly_cash_ledger_updated_at
before update on public.finance_monthly_cash_ledger
for each row execute function public.set_updated_at();

alter table public.finance_monthly_cash_ledger enable row level security;

-- Leitura: admin, financeiro, rh e membros do projeto.
drop policy if exists finance_monthly_cash_ledger_select on public.finance_monthly_cash_ledger;
create policy finance_monthly_cash_ledger_select
on public.finance_monthly_cash_ledger
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'financeiro', 'rh')
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = finance_monthly_cash_ledger.project_id
        and pm.user_id = auth.uid()
    )
  )
);

-- Escrita: admin e financeiro.
drop policy if exists finance_monthly_cash_ledger_insert on public.finance_monthly_cash_ledger;
create policy finance_monthly_cash_ledger_insert
on public.finance_monthly_cash_ledger
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro')
);

drop policy if exists finance_monthly_cash_ledger_update on public.finance_monthly_cash_ledger;
create policy finance_monthly_cash_ledger_update
on public.finance_monthly_cash_ledger
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

drop policy if exists finance_monthly_cash_ledger_delete on public.finance_monthly_cash_ledger;
create policy finance_monthly_cash_ledger_delete
on public.finance_monthly_cash_ledger
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

commit;
