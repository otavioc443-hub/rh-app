begin;

create table if not exists public.institutional_content (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete set null,
  title text not null,
  subtitle text null,
  hero_image_url text null,
  about text null,
  history jsonb not null default '[]'::jsonb,
  values jsonb not null default '[]'::jsonb,
  culture jsonb not null default '[]'::jsonb,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_institutional_content_company
  on public.institutional_content(company_id);

alter table public.institutional_content enable row level security;

drop trigger if exists trg_institutional_content_updated_at on public.institutional_content;
create trigger trg_institutional_content_updated_at
before update on public.institutional_content
for each row execute function public.set_updated_at();

drop policy if exists institutional_content_select_active on public.institutional_content;
create policy institutional_content_select_active
on public.institutional_content
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        institutional_content.company_id is null
        or p.company_id = institutional_content.company_id
        or p.role in ('admin', 'rh')
      )
  )
);

drop policy if exists institutional_content_write_rh_admin on public.institutional_content;
create policy institutional_content_write_rh_admin
on public.institutional_content
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
);

-- Seed de um conteudo padrao global (company_id = NULL).
insert into public.institutional_content (
  company_id,
  title,
  subtitle,
  hero_image_url,
  about,
  history,
  values,
  culture
)
select
  null,
  'Sólida do Brasil Energias Renováveis',
  'História, valores e cultura',
  '/institucional/pdf/page-07.jpg',
  'Fundada no território brasileiro pelo Engenheiro Civil Raul Dantas, em parceria com a Sólida Energias Renováveis, sediada na Espanha, a Sólida do Brasil Energias Renováveis abriu suas portas inicialmente na cidade de São Paulo/SP no ano de 2007.

Nossa organização traz consigo uma herança formada pela experiência e expertise adquiridas ao longo dos anos. Em 2020, testemunhamos um crescimento expressivo, passando de uma equipe inicial de 10 colaboradores e parceiros para os atuais 60.

Atuamos nos principais projetos de energias renováveis da América Latina, contando com os principais especialistas em consultoria de engenharia de energias renováveis do mercado.',
  '[
    {"year":"2007","title":"Início em São Paulo/SP","description":"Abertura das operações no Brasil com foco em energia renovável.","image_url":"/institucional/pdf/page-05.jpg"},
    {"year":"2020","title":"Crescimento expressivo","description":"Evolução do time, processos e capacidade de entrega.","image_url":"/institucional/pdf/page-06.jpg"},
    {"year":"Hoje","title":"Atuação na América Latina","description":"Participação nos principais projetos e apoio a clientes na transição energética."}
  ]'::jsonb,
  '[
    {"title":"Excelência Duradoura","description":"Qualidade e consistência em tudo o que entregamos."},
    {"title":"Ética Responsável","description":"Fazemos o certo, com integridade e respeito."},
    {"title":"Vanguarda Tecnológica","description":"Inovação aplicada para liderar com eficiência e segurança."},
    {"title":"Compromisso Verde","description":"Sustentabilidade como critério real de decisão e execução."},
    {"title":"Forja do Futuro","description":"Planejamento e responsabilidade para construir o longo prazo."}
  ]'::jsonb,
  '[
    {"title":"Missão","description":"Conduzir a transição rumo a um futuro energético sustentável, seguro e acessível por meio de soluções inovadoras de energia renovável."},
    {"title":"Visão","description":"Ser a referência global em soluções de energia renovável, liderando o mercado com excelência tecnológica e compromisso com a sustentabilidade."},
    {"title":"Nosso negócio","description":"Somos uma empresa líder global em engenharia de energia renovável, especialista em consultoria, digitalização e desenvolvimento de conhecimento multidisciplinar e na adaptação de soluções inovadoras a cada mercado."}
  ]'::jsonb
where not exists (
  select 1
  from public.institutional_content ic
  where ic.company_id is null
);

-- Seed opcional: se existir uma empresa "Sólida" em companies, cria um conteúdo específico dela (company_id = companies.id).
insert into public.institutional_content (
  company_id,
  title,
  subtitle,
  hero_image_url,
  about,
  history,
  values,
  culture
)
select
  c.id,
  'Sólida do Brasil Energias Renováveis',
  'História, valores e cultura',
  '/institucional/pdf/page-07.jpg',
  'Fundada no território brasileiro pelo Engenheiro Civil Raul Dantas, em parceria com a Sólida Energias Renováveis, sediada na Espanha, a Sólida do Brasil Energias Renováveis abriu suas portas inicialmente na cidade de São Paulo/SP no ano de 2007.

Nossa organização traz consigo uma herança formada pela experiência e expertise adquiridas ao longo dos anos. Em 2020, testemunhamos um crescimento expressivo, passando de uma equipe inicial de 10 colaboradores e parceiros para os atuais 60.

Atuamos nos principais projetos de energias renováveis da América Latina, contando com os principais especialistas em consultoria de engenharia de energias renováveis do mercado.',
  '[
    {"year":"2007","title":"Início em São Paulo/SP","description":"Abertura das operações no Brasil com foco em energia renovável.","image_url":"/institucional/pdf/page-05.jpg"},
    {"year":"2020","title":"Crescimento expressivo","description":"Evolução do time, processos e capacidade de entrega.","image_url":"/institucional/pdf/page-06.jpg"},
    {"year":"Hoje","title":"Atuação na América Latina","description":"Participação nos principais projetos e apoio a clientes na transição energética."}
  ]'::jsonb,
  '[
    {"title":"Excelência Duradoura","description":"Qualidade e consistência em tudo o que entregamos."},
    {"title":"Ética Responsável","description":"Fazemos o certo, com integridade e respeito."},
    {"title":"Vanguarda Tecnológica","description":"Inovação aplicada para liderar com eficiência e segurança."},
    {"title":"Compromisso Verde","description":"Sustentabilidade como critério real de decisão e execução."},
    {"title":"Forja do Futuro","description":"Planejamento e responsabilidade para construir o longo prazo."}
  ]'::jsonb,
  '[
    {"title":"Missão","description":"Conduzir a transição rumo a um futuro energético sustentável, seguro e acessível por meio de soluções inovadoras de energia renovável."},
    {"title":"Visão","description":"Ser a referência global em soluções de energia renovável, liderando o mercado com excelência tecnológica e compromisso com a sustentabilidade."},
    {"title":"Nosso negócio","description":"Somos uma empresa líder global em engenharia de energia renovável, especialista em consultoria, digitalização e desenvolvimento de conhecimento multidisciplinar e na adaptação de soluções inovadoras a cada mercado."}
  ]'::jsonb
from public.companies c
where (
  lower(c.name) like '%solida%'
  or lower(c.name) like '%sólida%'
)
and not exists (
  select 1
  from public.institutional_content ic
  where ic.company_id = c.id
);

commit;
