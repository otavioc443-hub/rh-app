-- Historico de alteracoes do conteudo institucional (rascunho/publicado)
-- Armazena snapshots em JSONB para permitir auditoria e restauracao de rascunho.

begin;

-- Garantia de colunas usadas nos snapshots (idempotente).
alter table public.institutional_content
  add column if not exists hero_focus_x numeric null;

alter table public.institutional_content
  add column if not exists hero_focus_y numeric null;

create table if not exists public.institutional_content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid null references public.institutional_content(id) on delete set null,
  company_id uuid null references public.companies(id) on delete set null,
  status text not null,
  action text not null,
  snapshot jsonb not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists institutional_content_versions_company_created_at_idx
  on public.institutional_content_versions(company_id, created_at desc);

create index if not exists institutional_content_versions_content_created_at_idx
  on public.institutional_content_versions(content_id, created_at desc);

alter table public.institutional_content_versions enable row level security;

drop policy if exists institutional_content_versions_select_rh_admin on public.institutional_content_versions;
create policy institutional_content_versions_select_rh_admin
on public.institutional_content_versions
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin','rh')
);

drop policy if exists institutional_content_versions_write_rh_admin on public.institutional_content_versions;
create policy institutional_content_versions_write_rh_admin
on public.institutional_content_versions
for all
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin','rh')
)
with check (
  public.current_active() = true
  and public.current_role() in ('admin','rh')
);

-- Trigger: ao inserir/atualizar institutional_content, salva snapshot.
create or replace function public.log_institutional_content_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_action text;
  v_snapshot jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := case when new.status = 'published' then 'publish' else 'create_draft' end;
  else
    v_action := case when new.status = 'published' then 'update_published' else 'update_draft' end;
  end if;

  v_snapshot := jsonb_build_object(
    'id', new.id,
    'company_id', new.company_id,
    'status', new.status,
    'title', new.title,
    'subtitle', new.subtitle,
    'hero_image_url', new.hero_image_url,
    'hero_focus_x', new.hero_focus_x,
    'hero_focus_y', new.hero_focus_y,
    'about', new.about,
    'history', new.history,
    'values', new.values,
    'culture', new.culture,
    'published_at', new.published_at,
    'published_by', new.published_by,
    'updated_by', new.updated_by,
    'updated_at', new.updated_at
  );

  insert into public.institutional_content_versions (
    content_id,
    company_id,
    status,
    action,
    snapshot,
    created_by
  ) values (
    new.id,
    new.company_id,
    new.status,
    v_action,
    v_snapshot,
    auth.uid()
  );

  return new;
end $$;

drop trigger if exists trg_institutional_content_versions on public.institutional_content;
create trigger trg_institutional_content_versions
after insert or update on public.institutional_content
for each row execute function public.log_institutional_content_version();

-- Backfill inicial (snapshot do estado atual), apenas se ainda nao houver log do content_id.
insert into public.institutional_content_versions (
  content_id,
  company_id,
  status,
  action,
  snapshot,
  created_by,
  created_at
)
select
  ic.id,
  ic.company_id,
  ic.status,
  'backfill',
  jsonb_build_object(
    'id', ic.id,
    'company_id', ic.company_id,
    'status', ic.status,
    'title', ic.title,
    'subtitle', ic.subtitle,
    'hero_image_url', ic.hero_image_url,
    'hero_focus_x', ic.hero_focus_x,
    'hero_focus_y', ic.hero_focus_y,
    'about', ic.about,
    'history', ic.history,
    'values', ic.values,
    'culture', ic.culture,
    'published_at', ic.published_at,
    'published_by', ic.published_by,
    'updated_by', ic.updated_by,
    'updated_at', ic.updated_at
  ),
  ic.updated_by,
  coalesce(ic.updated_at, now())
from public.institutional_content ic
where not exists (
  select 1
  from public.institutional_content_versions v
  where v.content_id = ic.id
);

-- RPC: restaurar uma versao (snapshot) como rascunho
create or replace function public.restore_institutional_draft(p_version_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v uuid;
  s jsonb;
  cid uuid;
begin
  if public.current_active() is distinct from true or public.current_role() not in ('admin','rh') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select snapshot into s
  from public.institutional_content_versions
  where id = p_version_id
  limit 1;

  if s is null then
    raise exception 'version_not_found' using errcode = 'P0001';
  end if;

  cid := nullif(s->>'company_id','')::uuid;

  if cid is null then
    -- global (company_id null): conflito por status apenas
    insert into public.institutional_content (
      company_id, status,
      title, subtitle, hero_image_url, hero_focus_x, hero_focus_y, about, history, values, culture,
      updated_by
    )
    values (
      null, 'draft',
      coalesce(s->>'title',''),
      nullif(s->>'subtitle',''),
      nullif(s->>'hero_image_url',''),
      nullif(s->>'hero_focus_x','')::numeric,
      nullif(s->>'hero_focus_y','')::numeric,
      nullif(s->>'about',''),
      coalesce(s->'history','[]'::jsonb),
      coalesce(s->'values','[]'::jsonb),
      coalesce(s->'culture','[]'::jsonb),
      auth.uid()
    )
    on conflict (status)
    where company_id is null
    do update set
      title = excluded.title,
      subtitle = excluded.subtitle,
      hero_image_url = excluded.hero_image_url,
      hero_focus_x = excluded.hero_focus_x,
      hero_focus_y = excluded.hero_focus_y,
      about = excluded.about,
      history = excluded.history,
      values = excluded.values,
      culture = excluded.culture,
      updated_by = auth.uid(),
      updated_at = now()
    returning id into v;
  else
    insert into public.institutional_content (
      company_id, status,
      title, subtitle, hero_image_url, hero_focus_x, hero_focus_y, about, history, values, culture,
      updated_by
    )
    values (
      cid, 'draft',
      coalesce(s->>'title',''),
      nullif(s->>'subtitle',''),
      nullif(s->>'hero_image_url',''),
      nullif(s->>'hero_focus_x','')::numeric,
      nullif(s->>'hero_focus_y','')::numeric,
      nullif(s->>'about',''),
      coalesce(s->'history','[]'::jsonb),
      coalesce(s->'values','[]'::jsonb),
      coalesce(s->'culture','[]'::jsonb),
      auth.uid()
    )
    on conflict (company_id, status)
    where company_id is not null
    do update set
      title = excluded.title,
      subtitle = excluded.subtitle,
      hero_image_url = excluded.hero_image_url,
      hero_focus_x = excluded.hero_focus_x,
      hero_focus_y = excluded.hero_focus_y,
      about = excluded.about,
      history = excluded.history,
      values = excluded.values,
      culture = excluded.culture,
      updated_by = auth.uid(),
      updated_at = now()
    returning id into v;
  end if;

  return v;
end $$;

grant execute on function public.restore_institutional_draft(uuid) to authenticated;

commit;
