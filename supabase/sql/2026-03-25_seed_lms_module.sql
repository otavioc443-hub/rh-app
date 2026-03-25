insert into public.lms_courses (
  company_id,
  title,
  slug,
  short_description,
  full_description,
  category,
  workload_hours,
  required,
  certificate_enabled,
  passing_score,
  status,
  visibility,
  sequence_required,
  onboarding_recommended
)
select
  c.id,
  'Onboarding Portal RH',
  'onboarding-portal-rh',
  'Trilha inicial para novos colaboradores.',
  'Curso introdutorio com cultura, processos e boas praticas do portal corporativo.',
  'Onboarding',
  4,
  true,
  true,
  70,
  'published',
  'publico_interno',
  true,
  true
from public.companies c
where not exists (
  select 1 from public.lms_courses where slug = 'onboarding-portal-rh'
)
limit 1;
