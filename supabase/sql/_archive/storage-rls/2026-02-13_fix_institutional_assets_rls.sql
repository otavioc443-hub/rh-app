-- Fix: permitir upload/alteracao/exclusao no bucket institutional-assets
-- para usuarios RH/Admin mesmo quando a role efetiva vem do mapeamento por cargo
-- (public.current_role()) e nao diretamente de profiles.role.

begin;

-- Remove qualquer policy existente que cite o bucket institutional-assets
-- (evita conflito com policies antigas/criadas via dashboard).
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        (qual is not null and qual ilike '%institutional-assets%')
        or (with_check is not null and with_check ilike '%institutional-assets%')
      )
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "Institutional assets: RH/Admin insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'institutional-assets'
  and owner = auth.uid()
  and public.current_role() in ('rh', 'admin')
  and public.current_active() = true
);

create policy "Institutional assets: RH/Admin update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'institutional-assets'
  and owner = auth.uid()
  and public.current_role() in ('rh', 'admin')
  and public.current_active() = true
)
with check (
  bucket_id = 'institutional-assets'
  and owner = auth.uid()
  and public.current_role() in ('rh', 'admin')
  and public.current_active() = true
);

create policy "Institutional assets: RH/Admin delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'institutional-assets'
  and owner = auth.uid()
  and public.current_role() in ('rh', 'admin')
  and public.current_active() = true
);

commit;

