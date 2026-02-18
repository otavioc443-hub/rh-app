begin;

create table if not exists public.portal_feature_visibility (
  feature_key text primary key,
  label text not null,
  area text not null,
  route_path text not null unique,
  hidden boolean not null default false,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_portal_feature_visibility_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_portal_feature_visibility_updated_at on public.portal_feature_visibility;
create trigger trg_portal_feature_visibility_updated_at
before update on public.portal_feature_visibility
for each row
execute function public.set_portal_feature_visibility_updated_at();

alter table public.portal_feature_visibility enable row level security;

drop policy if exists portal_feature_visibility_select on public.portal_feature_visibility;
create policy portal_feature_visibility_select
on public.portal_feature_visibility
for select
to authenticated
using (
  public.current_active() = true
);

drop policy if exists portal_feature_visibility_insert on public.portal_feature_visibility;
create policy portal_feature_visibility_insert
on public.portal_feature_visibility
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists portal_feature_visibility_update on public.portal_feature_visibility;
create policy portal_feature_visibility_update
on public.portal_feature_visibility
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
)
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists portal_feature_visibility_delete on public.portal_feature_visibility;
create policy portal_feature_visibility_delete
on public.portal_feature_visibility
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

commit;
