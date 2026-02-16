-- Add role mapping per cargo + RLS hardening
-- Execute no Supabase SQL Editor com permissao de owner/admin.

begin;

-- 1) Column to map a job title (cargo) to an app role (optional)
alter table if exists public.cargos
  add column if not exists portal_role text null;

alter table if exists public.cargos
  drop constraint if exists cargos_portal_role_check;

alter table if exists public.cargos
  add constraint cargos_portal_role_check
  check (
    portal_role is null
    or portal_role in ('colaborador', 'coordenador', 'gestor', 'rh', 'admin')
  );

-- 2) RLS: anyone authenticated can read cargos; only RH/Admin can write
alter table if exists public.cargos enable row level security;

drop policy if exists cargos_select_authenticated on public.cargos;
create policy cargos_select_authenticated
on public.cargos
for select
to authenticated
using (true);

drop policy if exists cargos_write_rh_admin on public.cargos;
create policy cargos_write_rh_admin
on public.cargos
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('rh', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('rh', 'admin')
  )
);

commit;

