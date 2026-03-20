begin;

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
where name = 'institutional-assets';

commit;
