begin;

insert into storage.buckets (id, name, public)
select 'request-attachments', 'request-attachments', false
where not exists (
  select 1
  from storage.buckets b
  where b.id = 'request-attachments'
     or b.name = 'request-attachments'
);

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
where id = 'request-attachments'
   or name = 'request-attachments';

commit;
