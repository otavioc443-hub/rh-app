-- Hardening de policies do storage.objects para bucket company-logos
-- Objetivo: escrita apenas por RH/Admin; leitura publica mantida para logos.

begin;

drop policy if exists "Authenticated users can upload company logos" on storage.objects;
drop policy if exists "Authenticated users can update company logos" on storage.objects;
drop policy if exists "Authenticated users can delete company logos" on storage.objects;

create policy "RH/Admin can upload company logos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'company-logos'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('rh', 'admin')
  )
);

create policy "RH/Admin can update company logos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'company-logos'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('rh', 'admin')
  )
)
with check (
  bucket_id = 'company-logos'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('rh', 'admin')
  )
);

create policy "RH/Admin can delete company logos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'company-logos'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('rh', 'admin')
  )
);

commit;
