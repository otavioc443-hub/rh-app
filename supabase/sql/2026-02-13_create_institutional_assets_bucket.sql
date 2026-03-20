-- Bucket para imagens do conteúdo institucional (RH > Institucional).
-- Observação: o front usa getPublicUrl(), então o bucket precisa ser public.

begin;

-- 1) Garantir bucket
insert into storage.buckets (id, name, public)
select 'institutional-assets', 'institutional-assets', true
where not exists (
  select 1
  from storage.buckets b
  where b.id = 'institutional-assets'
     or b.name = 'institutional-assets'
);

-- 2) Restrições básicas
update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
where name = 'institutional-assets';

-- 3) Policies: escrita apenas por RH/Admin
drop policy if exists "RH/Admin can upload institutional assets" on storage.objects;
drop policy if exists "RH/Admin can update institutional assets" on storage.objects;
drop policy if exists "RH/Admin can delete institutional assets" on storage.objects;

create policy "RH/Admin can upload institutional assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'institutional-assets'
  and owner = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.active, true) = true
      and p.role in ('rh', 'admin')
  )
);

create policy "RH/Admin can update institutional assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'institutional-assets'
  and owner = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.active, true) = true
      and p.role in ('rh', 'admin')
  )
)
with check (
  bucket_id = 'institutional-assets'
  and owner = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.active, true) = true
      and p.role in ('rh', 'admin')
  )
);

create policy "RH/Admin can delete institutional assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'institutional-assets'
  and owner = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.active, true) = true
      and p.role in ('rh', 'admin')
  )
);

commit;
