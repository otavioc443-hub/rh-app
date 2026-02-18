begin;

-- Configuracao CNAB (Bradesco) para geracao de remessa de pagamento em massa.
create table if not exists public.finance_cnab_settings (
  config_key text primary key,
  bank_code text not null default '237',
  layout_version text not null default '240',
  company_name text null,
  company_cnpj text null,
  agreement_code text null,
  debit_agency text null,
  debit_agency_digit text null,
  debit_account text null,
  debit_account_digit text null,
  transmission_code text null,
  next_file_sequence integer not null default 1 check (next_file_sequence > 0),
  enabled boolean not null default true,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.finance_cnab_settings (config_key, bank_code, layout_version, enabled)
values ('bradesco_cnab240_pagamentos', '237', '240', true)
on conflict (config_key) do nothing;

drop trigger if exists trg_finance_cnab_settings_updated_at on public.finance_cnab_settings;
create trigger trg_finance_cnab_settings_updated_at
before update on public.finance_cnab_settings
for each row execute function public.set_updated_at();

alter table public.finance_cnab_settings enable row level security;

drop policy if exists finance_cnab_settings_select on public.finance_cnab_settings;
create policy finance_cnab_settings_select
on public.finance_cnab_settings
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro')
);

drop policy if exists finance_cnab_settings_insert on public.finance_cnab_settings;
create policy finance_cnab_settings_insert
on public.finance_cnab_settings
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro')
);

drop policy if exists finance_cnab_settings_update on public.finance_cnab_settings;
create policy finance_cnab_settings_update
on public.finance_cnab_settings
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

drop policy if exists finance_cnab_settings_delete on public.finance_cnab_settings;
create policy finance_cnab_settings_delete
on public.finance_cnab_settings
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

commit;
