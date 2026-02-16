-- Fix definitivo para "new row violates row-level security policy" no upload do Storage.
-- Causa comum: existir policy RESTRICTIVE em storage.objects (INSERT/UPDATE/DELETE),
-- que bloqueia o bucket `institutional-assets` mesmo com policies permissive corretas.
--
-- O que este script faz:
-- 1) garante a funcao public.current_active() (sem RLS) para checar se o perfil esta ativo
-- 2) remove policies RESTRICTIVE de escrita em storage.objects (INSERT/UPDATE/DELETE)
-- 3) cria policies de escrita por RH/Admin (role efetiva via public.current_role()) para
--    buckets permitidos: company-logos e institutional-assets

begin;

-- 1) Helper (sem RLS) para checar ativo (idempotente)
create or replace function public.current_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select coalesce(p.active, true)
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_active() to authenticated;

-- 2) Remove policies RESTRICTIVE de escrita (se existirem)
do $$
declare
  r record;
begin
  for r in
    -- Usamos pg_policy (catalog) pois pg_policies (view) pode variar tipo/formatacao por versao.
    select pol.polname as policyname
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
      and pol.polpermissive = false
      and pol.polcmd in ('a', 'w', 'd', '*') -- a=INSERT, w=UPDATE, d=DELETE, *=ALL
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- 3) (Re)cria policies permissive para escrita nos buckets permitidos
drop policy if exists "RH/Admin can write allowed buckets (insert)" on storage.objects;
drop policy if exists "RH/Admin can write allowed buckets (update)" on storage.objects;
drop policy if exists "RH/Admin can write allowed buckets (delete)" on storage.objects;

create policy "RH/Admin can write allowed buckets (insert)"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('company-logos', 'institutional-assets')
  and (owner is null or owner = auth.uid())
  and public.current_active() = true
  and public.current_role() in ('rh', 'admin')
);

create policy "RH/Admin can write allowed buckets (update)"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('company-logos', 'institutional-assets')
  and (owner is null or owner = auth.uid())
  and public.current_active() = true
  and public.current_role() in ('rh', 'admin')
)
with check (
  bucket_id in ('company-logos', 'institutional-assets')
  and (owner is null or owner = auth.uid())
  and public.current_active() = true
  and public.current_role() in ('rh', 'admin')
);

create policy "RH/Admin can write allowed buckets (delete)"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('company-logos', 'institutional-assets')
  and (owner is null or owner = auth.uid())
  and public.current_active() = true
  and public.current_role() in ('rh', 'admin')
);

commit;

