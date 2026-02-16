begin;

-- Configuracao de SLA para filas operacionais.
create table if not exists public.request_sla_settings (
  config_key text primary key,
  sla_hours integer not null check (sla_hours > 0 and sla_hours <= 720),
  description text null,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.request_sla_settings (config_key, sla_hours, description)
values (
  'profile_update_requests',
  72,
  'SLA em horas para solicitacoes de adequacao de dados (RH e Financeiro).'
)
on conflict (config_key) do nothing;

drop trigger if exists trg_request_sla_settings_updated_at on public.request_sla_settings;
create trigger trg_request_sla_settings_updated_at
before update on public.request_sla_settings
for each row execute function public.set_updated_at();

alter table public.request_sla_settings enable row level security;

-- Leitura: usuarios ativos autenticados.
drop policy if exists request_sla_settings_select on public.request_sla_settings;
create policy request_sla_settings_select
on public.request_sla_settings
for select
to authenticated
using (
  public.current_active() = true
);

-- Escrita: apenas admin.
drop policy if exists request_sla_settings_insert on public.request_sla_settings;
create policy request_sla_settings_insert
on public.request_sla_settings
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists request_sla_settings_update on public.request_sla_settings;
create policy request_sla_settings_update
on public.request_sla_settings
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

drop policy if exists request_sla_settings_delete on public.request_sla_settings;
create policy request_sla_settings_delete
on public.request_sla_settings
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

commit;
