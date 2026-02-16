begin;

-- Garante bucket de avatars publico para renderizacao em Sidebar, Home e chips de pessoas.
insert into storage.buckets (id, name, public)
select 'avatars', 'avatars', true
where not exists (
  select 1
  from storage.buckets b
  where b.id = 'avatars'
     or b.name = 'avatars'
);

update storage.buckets
set
  public = true,
  file_size_limit = 3145728, -- 3MB
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
where id = 'avatars' or name = 'avatars';

commit;
