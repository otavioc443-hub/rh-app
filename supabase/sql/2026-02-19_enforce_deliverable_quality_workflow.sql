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
    return p_to in ('in_progress', 'pending', 'approved', 'cancelled');
  end if;
  if p_from = 'approved' then
    return p_to in ('approved_with_comments');
  end if;
  if p_from = 'blocked' then
    return p_to in ('in_progress', 'pending', 'cancelled');
  end if;
  if p_from = 'cancelled' then
    return false;
  end if;

  return false;
end;
$$;

alter table if exists public.project_deliverables
  add column if not exists review_due_at timestamptz null,
  add column if not exists approved_at timestamptz null,
  add column if not exists approved_on_time boolean not null default false,
  add column if not exists approved_without_rework boolean not null default false,
  add column if not exists rework_count integer not null default 0,
  add column if not exists quality_expected_score numeric(5,2) null,
  add column if not exists quality_achieved_score numeric(5,2) null;

alter table if exists public.pd_project_deliverables
  add column if not exists review_due_at timestamptz null,
  add column if not exists approved_at timestamptz null,
  add column if not exists approved_on_time boolean not null default false,
  add column if not exists approved_without_rework boolean not null default false,
  add column if not exists rework_count integer not null default 0,
  add column if not exists quality_expected_score numeric(5,2) null,
  add column if not exists quality_achieved_score numeric(5,2) null;

alter table if exists public.project_deliverable_timeline
  drop constraint if exists ck_project_deliverable_timeline_rework_comment;
alter table if exists public.project_deliverable_timeline
  add constraint ck_project_deliverable_timeline_rework_comment
  check (
    event_type <> 'returned_for_rework'
    or coalesce(btrim(comment), '') <> ''
  );

alter table if exists public.pd_project_deliverable_timeline
  drop constraint if exists ck_pd_project_deliverable_timeline_rework_comment;
alter table if exists public.pd_project_deliverable_timeline
  add constraint ck_pd_project_deliverable_timeline_rework_comment
  check (
    event_type <> 'returned_for_rework'
    or coalesce(btrim(comment), '') <> ''
  );

create or replace function public.validate_project_deliverable_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not public.deliverable_status_transition_allowed(old.status, new.status) then
      raise exception 'transicao de status invalida: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_project_deliverable_status_transition on public.project_deliverables;
create trigger trg_validate_project_deliverable_status_transition
before update on public.project_deliverables
for each row
execute function public.validate_project_deliverable_status_transition();

create or replace function public.validate_pd_project_deliverable_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not public.deliverable_status_transition_allowed(old.status, new.status) then
      raise exception 'transicao de status invalida: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_pd_project_deliverable_status_transition on public.pd_project_deliverables;
create trigger trg_validate_pd_project_deliverable_status_transition
before update on public.pd_project_deliverables
for each row
execute function public.validate_pd_project_deliverable_status_transition();

create or replace function public.refresh_project_deliverable_quality_kpis(p_deliverable_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due_date date;
  v_review_due_at timestamptz;
  v_quality_expected numeric(5,2);
  v_approved_at timestamptz;
  v_rework_count integer;
  v_has_comments boolean;
  v_approved_on_time boolean;
  v_approved_without_rework boolean;
  v_quality_achieved numeric(5,2);
  v_deadline timestamptz;
begin
  select d.due_date, d.review_due_at, d.quality_expected_score
    into v_due_date, v_review_due_at, v_quality_expected
  from public.project_deliverables d
  where d.id = p_deliverable_id;

  if not found then
    return;
  end if;

  select max(t.created_at) filter (where t.status_to = 'approved'),
         count(*) filter (
           where t.event_type = 'returned_for_rework'
             or (
               t.status_to in ('pending', 'in_progress')
               and t.status_from in ('sent', 'approved_with_comments')
             )
         )::int,
         bool_or(t.status_to = 'approved_with_comments')
    into v_approved_at, v_rework_count, v_has_comments
  from public.project_deliverable_timeline t
  where t.deliverable_id = p_deliverable_id;

  v_deadline := coalesce(v_review_due_at, case when v_due_date is not null then (v_due_date::timestamptz + interval '1 day' - interval '1 millisecond') else null end);
  v_approved_on_time := v_approved_at is not null and (v_deadline is null or v_approved_at <= v_deadline);
  v_approved_without_rework := v_approved_at is not null and coalesce(v_rework_count, 0) = 0 and coalesce(v_has_comments, false) = false;

  if v_approved_without_rework then
    v_quality_achieved := coalesce(v_quality_expected, 100);
  elsif v_approved_at is null then
    v_quality_achieved := 0;
  else
    v_quality_achieved := greatest(0, coalesce(v_quality_expected, 100) - (coalesce(v_rework_count, 0) * 20) - (case when coalesce(v_has_comments, false) then 10 else 0 end));
  end if;

  update public.project_deliverables
  set approved_at = v_approved_at,
      approved_on_time = v_approved_on_time,
      approved_without_rework = v_approved_without_rework,
      rework_count = coalesce(v_rework_count, 0),
      quality_achieved_score = v_quality_achieved
  where id = p_deliverable_id;
end;
$$;

create or replace function public.refresh_pd_project_deliverable_quality_kpis(p_deliverable_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due_date date;
  v_review_due_at timestamptz;
  v_quality_expected numeric(5,2);
  v_approved_at timestamptz;
  v_rework_count integer;
  v_has_comments boolean;
  v_approved_on_time boolean;
  v_approved_without_rework boolean;
  v_quality_achieved numeric(5,2);
  v_deadline timestamptz;
begin
  select d.due_date, d.review_due_at, d.quality_expected_score
    into v_due_date, v_review_due_at, v_quality_expected
  from public.pd_project_deliverables d
  where d.id = p_deliverable_id;

  if not found then
    return;
  end if;

  select max(t.created_at) filter (where t.status_to = 'approved'),
         count(*) filter (
           where t.event_type = 'returned_for_rework'
             or (
               t.status_to in ('pending', 'in_progress')
               and t.status_from in ('sent', 'approved_with_comments')
             )
         )::int,
         bool_or(t.status_to = 'approved_with_comments')
    into v_approved_at, v_rework_count, v_has_comments
  from public.pd_project_deliverable_timeline t
  where t.deliverable_id = p_deliverable_id;

  v_deadline := coalesce(v_review_due_at, case when v_due_date is not null then (v_due_date::timestamptz + interval '1 day' - interval '1 millisecond') else null end);
  v_approved_on_time := v_approved_at is not null and (v_deadline is null or v_approved_at <= v_deadline);
  v_approved_without_rework := v_approved_at is not null and coalesce(v_rework_count, 0) = 0 and coalesce(v_has_comments, false) = false;

  if v_approved_without_rework then
    v_quality_achieved := coalesce(v_quality_expected, 100);
  elsif v_approved_at is null then
    v_quality_achieved := 0;
  else
    v_quality_achieved := greatest(0, coalesce(v_quality_expected, 100) - (coalesce(v_rework_count, 0) * 20) - (case when coalesce(v_has_comments, false) then 10 else 0 end));
  end if;

  update public.pd_project_deliverables
  set approved_at = v_approved_at,
      approved_on_time = v_approved_on_time,
      approved_without_rework = v_approved_without_rework,
      rework_count = coalesce(v_rework_count, 0),
      quality_achieved_score = v_quality_achieved
  where id = p_deliverable_id;
end;
$$;

create or replace function public.trg_refresh_project_deliverable_quality_kpis()
returns trigger
language plpgsql
as $$
declare
  v_id uuid;
begin
  v_id := coalesce(new.deliverable_id, old.deliverable_id, new.id, old.id);
  if v_id is not null then
    perform public.refresh_project_deliverable_quality_kpis(v_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_project_deliverable_quality_kpis_timeline on public.project_deliverable_timeline;
create trigger trg_refresh_project_deliverable_quality_kpis_timeline
after insert or update or delete on public.project_deliverable_timeline
for each row
execute function public.trg_refresh_project_deliverable_quality_kpis();

drop trigger if exists trg_refresh_project_deliverable_quality_kpis_deliverable on public.project_deliverables;
create trigger trg_refresh_project_deliverable_quality_kpis_deliverable
after update of due_date, review_due_at, status, quality_expected_score on public.project_deliverables
for each row
execute function public.trg_refresh_project_deliverable_quality_kpis();

create or replace function public.trg_refresh_pd_project_deliverable_quality_kpis()
returns trigger
language plpgsql
as $$
declare
  v_id uuid;
begin
  v_id := coalesce(new.deliverable_id, old.deliverable_id, new.id, old.id);
  if v_id is not null then
    perform public.refresh_pd_project_deliverable_quality_kpis(v_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_pd_project_deliverable_quality_kpis_timeline on public.pd_project_deliverable_timeline;
create trigger trg_refresh_pd_project_deliverable_quality_kpis_timeline
after insert or update or delete on public.pd_project_deliverable_timeline
for each row
execute function public.trg_refresh_pd_project_deliverable_quality_kpis();

drop trigger if exists trg_refresh_pd_project_deliverable_quality_kpis_deliverable on public.pd_project_deliverables;
create trigger trg_refresh_pd_project_deliverable_quality_kpis_deliverable
after update of due_date, review_due_at, status, quality_expected_score on public.pd_project_deliverables
for each row
execute function public.trg_refresh_pd_project_deliverable_quality_kpis();

do $$
declare
  r record;
begin
  for r in select id from public.project_deliverables loop
    perform public.refresh_project_deliverable_quality_kpis(r.id);
  end loop;
  for r in select id from public.pd_project_deliverables loop
    perform public.refresh_pd_project_deliverable_quality_kpis(r.id);
  end loop;
end;
$$;

commit;
