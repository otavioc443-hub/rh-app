begin;

create table if not exists public.portal_feature_visibility_audit (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null,
  route_path text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  hidden_before boolean null,
  hidden_after boolean null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_portal_feature_visibility_audit_changed_at
  on public.portal_feature_visibility_audit(changed_at desc);

create index if not exists idx_portal_feature_visibility_audit_feature
  on public.portal_feature_visibility_audit(feature_key, changed_at desc);

alter table public.portal_feature_visibility_audit enable row level security;

drop policy if exists portal_feature_visibility_audit_select on public.portal_feature_visibility_audit;
create policy portal_feature_visibility_audit_select
on public.portal_feature_visibility_audit
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists portal_feature_visibility_audit_insert on public.portal_feature_visibility_audit;
create policy portal_feature_visibility_audit_insert
on public.portal_feature_visibility_audit
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists portal_feature_visibility_audit_delete on public.portal_feature_visibility_audit;
create policy portal_feature_visibility_audit_delete
on public.portal_feature_visibility_audit
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

create or replace function public.log_portal_feature_visibility_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.portal_feature_visibility_audit (
      feature_key,
      route_path,
      action,
      hidden_before,
      hidden_after,
      actor_user_id
    )
    values (
      new.feature_key,
      new.route_path,
      'insert',
      null,
      new.hidden,
      auth.uid()
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    insert into public.portal_feature_visibility_audit (
      feature_key,
      route_path,
      action,
      hidden_before,
      hidden_after,
      actor_user_id
    )
    values (
      new.feature_key,
      new.route_path,
      'update',
      old.hidden,
      new.hidden,
      auth.uid()
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.portal_feature_visibility_audit (
      feature_key,
      route_path,
      action,
      hidden_before,
      hidden_after,
      actor_user_id
    )
    values (
      old.feature_key,
      old.route_path,
      'delete',
      old.hidden,
      null,
      auth.uid()
    );
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_portal_feature_visibility_audit on public.portal_feature_visibility;
create trigger trg_portal_feature_visibility_audit
after insert or update or delete on public.portal_feature_visibility
for each row
execute function public.log_portal_feature_visibility_change();

commit;
