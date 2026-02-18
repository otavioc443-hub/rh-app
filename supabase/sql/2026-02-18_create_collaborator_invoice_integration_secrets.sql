begin;

create table if not exists public.collaborator_invoice_integration_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('sougov', 'portal_estadual', 'portal_municipal', 'custom')),
  secret_ciphertext text not null,
  secret_iv text not null,
  secret_tag text not null,
  key_version smallint not null default 1,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

drop trigger if exists trg_collaborator_invoice_integration_secrets_updated_at on public.collaborator_invoice_integration_secrets;
create trigger trg_collaborator_invoice_integration_secrets_updated_at
before update on public.collaborator_invoice_integration_secrets
for each row execute function public.set_updated_at();

alter table public.collaborator_invoice_integration_secrets enable row level security;

drop policy if exists collaborator_invoice_integration_secrets_admin_select on public.collaborator_invoice_integration_secrets;
create policy collaborator_invoice_integration_secrets_admin_select
on public.collaborator_invoice_integration_secrets
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

commit;
