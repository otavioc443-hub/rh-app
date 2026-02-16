-- Reset completo das policies de escrita (INSERT/UPDATE/DELETE) do Storage.
-- Uso: quando uploads continuam falhando com "new row violates row-level security policy"
-- por causa de policies antigas/RESTRICTIVE ou conflitantes.
--
-- Este script:
-- 1) remove TODAS as policies de escrita em storage.objects (inclusive ALL='*')
-- 2) recria policies minimalistas para os buckets usados pelo app:
--    - avatars: qualquer authenticated pode escrever apenas no seu proprio folder (uid/*)
--    - company-logos + institutional-assets: apenas RH/Admin (role efetiva via public.current_role())

begin;

-- Helper: ativo (sem RLS), tratando ausencia de profile como ativo por default.
create or replace function public.current_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select coalesce(
    (select p.active from public.profiles p where p.id = auth.uid() limit 1),
    true
  );
$$;

grant execute on function public.current_active() to authenticated;

-- 1) Drop geral das policies de escrita em storage.objects
do $$
declare
  r record;
begin
  for r in
    select pol.polname as policyname
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
      and pol.polcmd in ('a', 'w', 'd', '*') -- insert/update/delete/all
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- 2) Recria policies (write)

-- Avatars: cada usuario escreve apenas no seu proprio diretorio (uid/*)
create policy "avatars: user insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
  and (owner is null or owner = auth.uid())
);

create policy "avatars: user update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
  and (owner is null or owner = auth.uid())
)
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
  and (owner is null or owner = auth.uid())
);

create policy "avatars: user delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
  and (owner is null or owner = auth.uid())
);

-- RH/Admin: escrita em buckets institucionais e logos
create policy "rh/admin: insert company assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('company-logos', 'institutional-assets')
  and public.current_active() = true
  and public.current_role() in ('rh', 'admin')
  and (owner is null or owner = auth.uid())
);

create policy "rh/admin: update company assets"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('company-logos', 'institutional-assets')
  and public.current_active() = true
  and public.current_role() in ('rh', 'admin')
  and (owner is null or owner = auth.uid())
)
with check (
  bucket_id in ('company-logos', 'institutional-assets')
  and public.current_active() = true
  and public.current_role() in ('rh', 'admin')
  and (owner is null or owner = auth.uid())
);

create policy "rh/admin: delete company assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('company-logos', 'institutional-assets')
  and public.current_active() = true
  and public.current_role() in ('rh', 'admin')
  and (owner is null or owner = auth.uid())
);

commit;

