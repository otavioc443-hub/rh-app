begin;

alter table if exists public.collaborator_invoice_integration_profiles
  alter column preferred_provider set default 'sougov';

alter table if exists public.collaborator_invoices
  alter column integration_provider set default 'sougov';

commit;
