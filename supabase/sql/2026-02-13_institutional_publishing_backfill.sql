-- Backfill: cria versoes 'published' a partir dos rascunhos existentes (draft)
-- Objetivo: evitar que "Salvar rascunho" pareca publicar quando ainda nao existe published.

begin;

-- 1) Published global (company_id null) a partir do draft global (se faltar)
insert into public.institutional_content (
  company_id, status,
  title, subtitle, hero_image_url, hero_focus_x, hero_focus_y, about, history, values, culture,
  updated_by,
  published_at, published_by
)
select
  null, 'published',
  d.title, d.subtitle, d.hero_image_url, d.hero_focus_x, d.hero_focus_y, d.about, d.history, d.values, d.culture,
  d.updated_by,
  now(), d.updated_by
from public.institutional_content d
where d.company_id is null
  and d.status = 'draft'
  and not exists (
    select 1
    from public.institutional_content p
    where p.company_id is null
      and p.status = 'published'
  )
limit 1;

-- 2) Published por empresa a partir do draft (se faltar)
insert into public.institutional_content (
  company_id, status,
  title, subtitle, hero_image_url, hero_focus_x, hero_focus_y, about, history, values, culture,
  updated_by,
  published_at, published_by
)
select
  d.company_id, 'published',
  d.title, d.subtitle, d.hero_image_url, d.hero_focus_x, d.hero_focus_y, d.about, d.history, d.values, d.culture,
  d.updated_by,
  now(), d.updated_by
from public.institutional_content d
where d.company_id is not null
  and d.status = 'draft'
  and not exists (
    select 1
    from public.institutional_content p
    where p.company_id = d.company_id
      and p.status = 'published'
  );

commit;
