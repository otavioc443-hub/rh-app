begin;

create table if not exists public.lgpd_request_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.lgpd_requests(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_role text null,
  status_from text null,
  status_to text not null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lgpd_request_audit_request
  on public.lgpd_request_audit(request_id, created_at desc);

alter table public.lgpd_request_audit enable row level security;

drop policy if exists lgpd_request_audit_select on public.lgpd_request_audit;
create policy lgpd_request_audit_select
on public.lgpd_request_audit
for select
to authenticated
using (
  public.current_active() = true
  and (
    requester_user_id = auth.uid()
    or public.current_role() in ('admin', 'rh')
  )
);

drop policy if exists lgpd_request_audit_insert on public.lgpd_request_audit;
create policy lgpd_request_audit_insert
on public.lgpd_request_audit
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh')
);

commit;
