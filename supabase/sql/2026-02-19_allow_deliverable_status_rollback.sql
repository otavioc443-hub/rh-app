begin;

create or replace function public.deliverable_status_transition_allowed(p_from text, p_to text)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_from is null or p_to is null then
    return false;
  end if;
  if p_from = p_to then
    return true;
  end if;

  if p_from = 'pending' then
    return p_to in ('in_progress', 'sent', 'cancelled', 'blocked');
  end if;
  if p_from = 'in_progress' then
    return p_to in ('pending', 'sent', 'blocked', 'cancelled');
  end if;
  if p_from = 'sent' then
    return p_to in ('approved', 'approved_with_comments', 'in_progress', 'pending', 'blocked');
  end if;
  if p_from = 'approved_with_comments' then
    return p_to in ('in_progress', 'pending', 'sent', 'approved', 'cancelled');
  end if;
  if p_from = 'approved' then
    -- Permite retroacao operacional quando necessario (revisao/reabertura).
    return p_to in ('approved_with_comments', 'sent', 'in_progress', 'pending');
  end if;
  if p_from = 'blocked' then
    return p_to in ('in_progress', 'pending', 'sent', 'cancelled');
  end if;
  if p_from = 'cancelled' then
    return false;
  end if;

  return false;
end;
$$;

commit;
