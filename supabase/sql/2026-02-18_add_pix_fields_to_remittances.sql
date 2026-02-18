begin;

alter table if exists public.collaborator_invoice_remittances
  add column if not exists pix_qr_code text null,
  add column if not exists pix_qr_code_url text null,
  add column if not exists pix_copy_paste text null;

commit;
