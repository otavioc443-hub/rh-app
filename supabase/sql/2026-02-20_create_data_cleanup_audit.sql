begin;

create table if not exists public.data_cleanup_audit (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('colaborador', 'coordenador', 'gestor', 'rh', 'financeiro', 'pd', 'admin', 'super_admin')),
  company_id uuid null references public.companies(id) on delete set null,
  operation_key text not null,
  status text not null check (status in ('success', 'failed')),
  operation_payload jsonb null,
  operation_result jsonb null,
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_data_cleanup_audit_created_at
  on public.data_cleanup_audit(created_at desc);

create index if not exists idx_data_cleanup_audit_company_created_at
  on public.data_cleanup_audit(company_id, created_at desc);

create index if not exists idx_data_cleanup_audit_actor_created_at
  on public.data_cleanup_audit(actor_user_id, created_at desc);

alter table public.data_cleanup_audit enable row level security;

drop policy if exists data_cleanup_audit_select on public.data_cleanup_audit;
create policy data_cleanup_audit_select
on public.data_cleanup_audit
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'super_admin'
    or (
      public.current_role() = 'admin'
      and public.current_company_id() is not null
      and public.current_company_id() = data_cleanup_audit.company_id
    )
  )
);

drop policy if exists data_cleanup_audit_insert on public.data_cleanup_audit;
create policy data_cleanup_audit_insert
on public.data_cleanup_audit
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() = 'super_admin'
    or (
      public.current_role() = 'admin'
      and public.current_company_id() is not null
      and public.current_company_id() = data_cleanup_audit.company_id
    )
  )
);

commit;

