begin;

create table if not exists public.lgpd_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('access', 'correction', 'deletion', 'opposition', 'portability', 'review', 'information', 'other')),
  title text not null,
  details text not null,
  status text not null default 'pending' check (status in ('pending', 'in_review', 'approved', 'rejected', 'implemented', 'cancelled')),
  review_notes text null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lgpd_requests_requester
  on public.lgpd_requests(requester_user_id, created_at desc);

create index if not exists idx_lgpd_requests_status
  on public.lgpd_requests(status, created_at desc);

drop trigger if exists trg_lgpd_requests_updated_at on public.lgpd_requests;
create trigger trg_lgpd_requests_updated_at
before update on public.lgpd_requests
for each row execute function public.set_updated_at();

alter table public.lgpd_requests enable row level security;

drop policy if exists lgpd_requests_select on public.lgpd_requests;
create policy lgpd_requests_select
on public.lgpd_requests
for select
to authenticated
using (
  public.current_active() = true
  and (
    requester_user_id = auth.uid()
    or public.current_role() in ('admin', 'rh')
  )
);

drop policy if exists lgpd_requests_insert on public.lgpd_requests;
create policy lgpd_requests_insert
on public.lgpd_requests
for insert
to authenticated
with check (
  public.current_active() = true
  and requester_user_id = auth.uid()
);

drop policy if exists lgpd_requests_update_reviewer on public.lgpd_requests;
create policy lgpd_requests_update_reviewer
on public.lgpd_requests
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh')
)
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh')
);

drop policy if exists lgpd_requests_update_owner on public.lgpd_requests;
create policy lgpd_requests_update_owner
on public.lgpd_requests
for update
to authenticated
using (
  public.current_active() = true
  and requester_user_id = auth.uid()
  and status = 'pending'
)
with check (
  public.current_active() = true
  and requester_user_id = auth.uid()
  and status in ('pending', 'cancelled')
);

commit;
