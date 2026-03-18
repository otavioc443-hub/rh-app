begin;

update storage.buckets
set public = false
where id = 'internal-social-media'
   or name = 'internal-social-media';

commit;
