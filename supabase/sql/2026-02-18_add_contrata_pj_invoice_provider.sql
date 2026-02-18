begin;

alter table if exists public.collaborator_invoices
  drop constraint if exists collaborator_invoices_integration_provider_check;

alter table if exists public.collaborator_invoices
  add constraint collaborator_invoices_integration_provider_check
  check (
    integration_provider in ('sougov', 'portal_estadual', 'portal_municipal', 'contrata_pj', 'custom')
  );

commit;
