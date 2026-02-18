begin;

create table if not exists public.notification_automation_rules_audit (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by uuid null references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  before_data jsonb null,
  after_data jsonb null
);

create index if not exists idx_notification_automation_rules_audit_event
  on public.notification_automation_rules_audit(event_key, changed_at desc);

create index if not exists idx_notification_automation_rules_audit_changed_at
  on public.notification_automation_rules_audit(changed_at desc);

alter table public.notification_automation_rules_audit enable row level security;

drop policy if exists notification_automation_rules_audit_select on public.notification_automation_rules_audit;
create policy notification_automation_rules_audit_select
on public.notification_automation_rules_audit
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists notification_automation_rules_audit_insert on public.notification_automation_rules_audit;
create policy notification_automation_rules_audit_insert
on public.notification_automation_rules_audit
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

create or replace function public.log_notification_automation_rule_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notification_automation_rules_audit (
      event_key,
      action,
      changed_by,
      before_data,
      after_data
    )
    values (
      new.event_key,
      'insert',
      auth.uid(),
      null,
      to_jsonb(new)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    insert into public.notification_automation_rules_audit (
      event_key,
      action,
      changed_by,
      before_data,
      after_data
    )
    values (
      new.event_key,
      'update',
      auth.uid(),
      to_jsonb(old),
      to_jsonb(new)
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.notification_automation_rules_audit (
      event_key,
      action,
      changed_by,
      before_data,
      after_data
    )
    values (
      old.event_key,
      'delete',
      auth.uid(),
      to_jsonb(old),
      null
    );
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_notification_automation_rules_audit on public.notification_automation_rules;
create trigger trg_notification_automation_rules_audit
after insert or update or delete on public.notification_automation_rules
for each row
execute function public.log_notification_automation_rule_change();

commit;

