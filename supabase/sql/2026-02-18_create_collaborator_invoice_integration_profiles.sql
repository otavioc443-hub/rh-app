begin;

create table if not exists public.collaborator_invoice_integration_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  preferred_provider text not null default 'portal_municipal'
    check (preferred_provider in ('sougov', 'portal_estadual', 'portal_municipal', 'custom')),
  cnpj_prestador text not null,
  simples_nacional boolean not null default false,
  inscricao_municipal text null,
  nfs_password_set boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_collaborator_invoice_integration_profiles_updated_at on public.collaborator_invoice_integration_profiles;
create trigger trg_collaborator_invoice_integration_profiles_updated_at
before update on public.collaborator_invoice_integration_profiles
for each row execute function public.set_updated_at();

alter table public.collaborator_invoice_integration_profiles enable row level security;

drop policy if exists collaborator_invoice_integration_profiles_select on public.collaborator_invoice_integration_profiles;
create policy collaborator_invoice_integration_profiles_select
on public.collaborator_invoice_integration_profiles
for select
to authenticated
using (
  public.current_active() = true
  and (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
);

drop policy if exists collaborator_invoice_integration_profiles_insert on public.collaborator_invoice_integration_profiles;
create policy collaborator_invoice_integration_profiles_insert
on public.collaborator_invoice_integration_profiles
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
);

drop policy if exists collaborator_invoice_integration_profiles_update on public.collaborator_invoice_integration_profiles;
create policy collaborator_invoice_integration_profiles_update
on public.collaborator_invoice_integration_profiles
for update
to authenticated
using (
  public.current_active() = true
  and (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
)
with check (
  public.current_active() = true
  and (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
);

commit;
