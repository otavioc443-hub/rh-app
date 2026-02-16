-- Publicacao do conteudo institucional: rascunho (draft) vs publicado (published)
-- Estrategia:
-- - institutional_content passa a ter coluna status ('draft'|'published')
-- - RH/Admin edita sempre o 'draft'
-- - /institucional mostra sempre o 'published' (com fallbacks)
-- - Publicar = copiar draft -> published via RPC (security definer)

begin;

-- 0) Helpers (idempotente)
create or replace function public.current_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select coalesce(p.active, true)
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_active() to authenticated;

-- 1) Campos novos
alter table public.institutional_content
  add column if not exists status text not null default 'draft';

alter table public.institutional_content
  add column if not exists published_at timestamptz null;

alter table public.institutional_content
  add column if not exists published_by uuid null references auth.users(id) on delete set null;

-- 2) Constraint de status (idempotente)
do $$
begin
  alter table public.institutional_content
    add constraint institutional_content_status_check
    check (status in ('draft','published'));
exception
  when duplicate_object then null;
end $$;

-- 3) Unicidade por escopo+status
-- Company: 1 row por (company_id,status)
create unique index if not exists institutional_content_company_status_uq
  on public.institutional_content(company_id, status)
  where company_id is not null;

-- Global (company_id null): 1 row por status
create unique index if not exists institutional_content_global_status_uq
  on public.institutional_content(status)
  where company_id is null;

-- 4) Ajuste de policies: colaboradores veem apenas published; RH/Admin veem ambos.
drop policy if exists institutional_content_select_active on public.institutional_content;
create policy institutional_content_select_active
on public.institutional_content
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin','rh')
    or institutional_content.status = 'published'
  )
  and (
    institutional_content.company_id is null
    or institutional_content.company_id = public.current_company_id()
    or public.current_role() in ('admin','rh')
  )
);

drop policy if exists institutional_content_write_rh_admin on public.institutional_content;
create policy institutional_content_write_rh_admin
on public.institutional_content
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

-- 5) RPC: publicar draft -> published (upsert)
create or replace function public.publish_institutional_content(p_company_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_id uuid;
  v_draft record;
begin
  if public.current_active() is distinct from true or public.current_role() not in ('admin','rh') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select
    ic.title,
    ic.subtitle,
    ic.hero_image_url,
    ic.hero_focus_x,
    ic.hero_focus_y,
    ic.about,
    ic.history,
    ic.values,
    ic.culture
  into v_draft
  from public.institutional_content ic
  where ic.company_id is not distinct from p_company_id
    and ic.status = 'draft'
  order by ic.updated_at desc
  limit 1;

  if not found then
    raise exception 'draft_not_found' using errcode = 'P0001';
  end if;

  if p_company_id is null then
    insert into public.institutional_content (
      company_id, status,
      title, subtitle, hero_image_url, hero_focus_x, hero_focus_y, about, history, values, culture,
      updated_by,
      published_at, published_by
    )
    values (
      null, 'published',
      v_draft.title, v_draft.subtitle, v_draft.hero_image_url, v_draft.hero_focus_x, v_draft.hero_focus_y, v_draft.about, v_draft.history, v_draft.values, v_draft.culture,
      auth.uid(),
      now(), auth.uid()
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
      updated_at = now(),
      published_at = now(),
      published_by = auth.uid()
    returning id into v_id;
  else
    insert into public.institutional_content (
      company_id, status,
      title, subtitle, hero_image_url, hero_focus_x, hero_focus_y, about, history, values, culture,
      updated_by,
      published_at, published_by
    )
    values (
      p_company_id, 'published',
      v_draft.title, v_draft.subtitle, v_draft.hero_image_url, v_draft.hero_focus_x, v_draft.hero_focus_y, v_draft.about, v_draft.history, v_draft.values, v_draft.culture,
      auth.uid(),
      now(), auth.uid()
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
      updated_at = now(),
      published_at = now(),
      published_by = auth.uid()
    returning id into v_id;
  end if;

  return v_id;
end $$;

grant execute on function public.publish_institutional_content(uuid) to authenticated;

commit;
