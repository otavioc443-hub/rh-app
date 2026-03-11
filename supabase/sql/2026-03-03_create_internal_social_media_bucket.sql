begin;

insert into storage.buckets (id, name, public)
select 'internal-social-media', 'internal-social-media', true
where not exists (
  select 1
  from storage.buckets b
  where b.id = 'internal-social-media'
     or b.name = 'internal-social-media'
);

update storage.buckets
set public = true
where id = 'internal-social-media'
   or name = 'internal-social-media';

commit;
