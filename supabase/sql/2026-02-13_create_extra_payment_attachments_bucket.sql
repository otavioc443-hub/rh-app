-- Bucket para anexos/comprovantes de pagamentos extras.
-- Observacao: o app usa getPublicUrl() via endpoint server (service role).
-- Mantemos o bucket como public para simplificar download interno.

begin;

insert into storage.buckets (id, name, public)
select 'extra-payment-attachments', 'extra-payment-attachments', true
where not exists (
  select 1
  from storage.buckets b
  where b.id = 'extra-payment-attachments'
     or b.name = 'extra-payment-attachments'
);

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
where name = 'extra-payment-attachments';

commit;

