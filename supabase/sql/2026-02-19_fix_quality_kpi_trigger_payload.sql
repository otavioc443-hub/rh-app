begin;

create or replace function public.trg_refresh_project_deliverable_quality_kpis()
returns trigger
language plpgsql
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_id uuid;
begin
  v_new := to_jsonb(new);
  v_old := to_jsonb(old);

  v_id := coalesce(
    nullif(v_new ->> 'deliverable_id', '')::uuid,
    nullif(v_old ->> 'deliverable_id', '')::uuid,
    nullif(v_new ->> 'id', '')::uuid,
    nullif(v_old ->> 'id', '')::uuid
  );

  if v_id is not null then
    perform public.refresh_project_deliverable_quality_kpis(v_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.trg_refresh_pd_project_deliverable_quality_kpis()
returns trigger
language plpgsql
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_id uuid;
begin
  v_new := to_jsonb(new);
  v_old := to_jsonb(old);

  v_id := coalesce(
    nullif(v_new ->> 'deliverable_id', '')::uuid,
    nullif(v_old ->> 'deliverable_id', '')::uuid,
    nullif(v_new ->> 'id', '')::uuid,
    nullif(v_old ->> 'id', '')::uuid
  );

  if v_id is not null then
    perform public.refresh_pd_project_deliverable_quality_kpis(v_id);
  end if;

  return coalesce(new, old);
end;
$$;

commit;
