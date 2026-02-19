begin;

create or replace function public.fanout_notification_to_admins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin record;
begin
  -- Evita recursao ao inserir as copias para admins.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  for v_admin in
    select p.id
    from public.profiles p
    where p.role = 'admin'
      and coalesce(p.active, true) = true
      and p.id is distinct from new.to_user_id
  loop
    insert into public.notifications (to_user_id, title, body, link, type)
    values (v_admin.id, new.title, new.body, new.link, new.type);
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_fanout_notification_to_admins on public.notifications;
create trigger trg_fanout_notification_to_admins
after insert on public.notifications
for each row
execute function public.fanout_notification_to_admins();

commit;
