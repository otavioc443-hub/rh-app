begin;

-- Garante que a soma de allocation_pct por colaborador nao ultrapasse 100%.
create or replace function public.enforce_project_member_allocation_total()
returns trigger
language plpgsql
as $$
declare
  v_user_id uuid;
  v_total numeric(10,2);
begin
  v_user_id := coalesce(new.user_id, old.user_id);

  select coalesce(sum(a.allocation_pct), 0)
    into v_total
  from public.project_member_allocations a
  where a.user_id = v_user_id;

  if v_total > 100 then
    raise exception using
      errcode = '23514',
      message = format('Soma de rateio invalida para usuario %s: %.2f%% (maximo 100%%).', v_user_id, v_total);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_project_member_allocations_total_guard on public.project_member_allocations;
create constraint trigger trg_project_member_allocations_total_guard
after insert or update or delete on public.project_member_allocations
deferrable initially immediate
for each row execute function public.enforce_project_member_allocation_total();

commit;