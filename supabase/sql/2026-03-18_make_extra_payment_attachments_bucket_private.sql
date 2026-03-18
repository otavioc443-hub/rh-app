begin;

insert into storage.buckets (id, name, public)
select 'extra-payment-attachments', 'extra-payment-attachments', false
where not exists (
  select 1
  from storage.buckets b
  where b.id = 'extra-payment-attachments'
     or b.name = 'extra-payment-attachments'
);

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
where id = 'extra-payment-attachments'
   or name = 'extra-payment-attachments';

commit;
