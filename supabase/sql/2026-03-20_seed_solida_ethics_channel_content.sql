begin;

insert into public.ethics_channel_content (
  company_id,
  hero_title,
  hero_subtitle,
  heading,
  intro,
  hero_image_url,
  code_summary,
  data_protection_summary,
  principles,
  foundation_title,
  foundation_subtitle,
  foundation_pillars,
  steer_title,
  steer_body
)
select
  c.id,
  'Bem-vindo ao Canal de Ética da Sólida',
  'Um ambiente seguro, imparcial e protegido para comunicar condutas que possam violar o Código de Ética e Conduta, as políticas internas ou a legislação aplicável.',
  'Tecnologia, excelência e responsabilidade em cada relação.',
  'Na Sólida, acreditamos que a engenharia transforma realidades. Por isso, nossa atuação precisa refletir responsabilidade profissional, respeito às pessoas, integridade nas decisões e compromisso permanente com a confiança.',
  '/ethics/solida-canal-etica-hero.jpg',
  'O Código de Ética e Conduta da Sólida orienta a forma como trabalhamos, decidimos e nos relacionamos, conectando engenharia, tecnologia, inteligência e pessoas para construir soluções que transformam a sociedade.',
  'Os relatos recebidos devem ser tratados com responsabilidade e confidencialidade, com acesso restrito, proteção das informações pessoais e preservação adequada das evidências relacionadas ao caso.',
  jsonb_build_array(
    'Projetar o futuro por meio da engenharia, conectando tecnologia, inteligência e pessoas para construir soluções que transformam a sociedade.',
    'Desenvolver soluções de engenharia inovadoras, seguras e eficientes, utilizando tecnologia, BIM e inteligência técnica para entregar projetos de alta qualidade.',
    'Atuar com excelência técnica e visão estratégica para planejar, projetar e implementar soluções que integram diferentes disciplinas da engenharia.',
    'Transformar desafios complexos em soluções estruturadas, conectando engenharia, tecnologia e gestão para gerar resultados consistentes.'
  ),
  'Base institucional da Sólida',
  'O Canal de Ética da Sólida nasce do mesmo conjunto de princípios que orienta nossa atuação técnica, nosso relacionamento com pessoas e a forma como conduzimos decisões.',
  jsonb_build_array(
    jsonb_build_object(
      'label', 'Propósito',
      'text', 'Projetar o futuro por meio da engenharia, conectando tecnologia, inteligência e pessoas para construir soluções que transformam a sociedade. A Sólida existe para desenvolver soluções de engenharia que unem conhecimento técnico, inovação digital e responsabilidade profissional, contribuindo para a evolução de projetos, cidades, infraestruturas e sistemas produtivos. Nosso propósito é transformar ideias em soluções concretas, utilizando metodologias avançadas de engenharia, modelagem digital, gestão de projetos e colaboração multidisciplinar para gerar valor sustentável para clientes, parceiros e para a sociedade.'
    ),
    jsonb_build_object(
      'label', 'Missão',
      'text', 'Desenvolver soluções de engenharia inovadoras, seguras e eficientes, utilizando tecnologia, BIM e inteligência técnica para entregar projetos de alta qualidade. Atuamos com excelência técnica e visão estratégica para planejar, projetar e implementar soluções que integram diferentes disciplinas da engenharia, garantindo eficiência, precisão e confiabilidade em todas as etapas dos projetos. Nossa missão é transformar desafios complexos em soluções estruturadas, conectando engenharia, tecnologia e gestão para gerar resultados consistentes.'
    ),
    jsonb_build_object(
      'label', 'Visão',
      'text', 'Ser referência nacional e internacional em soluções de engenharia digital, inovação tecnológica e modelagem BIM. Buscamos consolidar a Sólida como uma empresa reconhecida pela excelência técnica, capacidade de inovação e impacto positivo nos projetos em que atua. Nossa visão é liderar a transformação digital da engenharia, promovendo novas formas de projetar, colaborar e construir.'
    )
  ),
  'STEER',
  'Na cultura STEER da Sólida, S representa Sustentabilidade com soluções de engenharia que consideram eficiência, responsabilidade ambiental e impacto positivo na sociedade; T representa Tecnologia com inovação, BIM e ferramentas digitais para projetar soluções mais inteligentes, precisas e eficientes; E representa Excelência na busca pelos mais altos padrões técnicos em projetos, processos e entregas; E representa Ética e Integridade, com transparência, responsabilidade profissional e respeito em todas as relações; e R representa Rumo ao Futuro, conduzindo a evolução da engenharia com projetos que impulsionam inovação, eficiência e desenvolvimento.'
from public.companies c
where lower(c.name) like '%sólida%'
   or lower(c.name) like '%solida%'
on conflict (company_id) do update
set
  hero_title = excluded.hero_title,
  hero_subtitle = excluded.hero_subtitle,
  heading = excluded.heading,
  intro = excluded.intro,
  hero_image_url = excluded.hero_image_url,
  code_summary = excluded.code_summary,
  data_protection_summary = excluded.data_protection_summary,
  principles = excluded.principles,
  foundation_title = excluded.foundation_title,
  foundation_subtitle = excluded.foundation_subtitle,
  foundation_pillars = excluded.foundation_pillars,
  steer_title = excluded.steer_title,
  steer_body = excluded.steer_body,
  updated_at = timezone('utc', now());

commit;
