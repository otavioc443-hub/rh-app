# LMS Corporativo

## Etapa 1 banco e RLS

Aplicar no Supabase:

- `supabase/sql/2026-03-25_create_lms_module.sql`
- opcional: `supabase/sql/2026-03-25_seed_lms_module.sql`

Esses scripts criam:

- `lms_courses`
- `lms_course_modules`
- `lms_lessons`
- `lms_learning_paths`
- `lms_learning_path_courses`
- `lms_assignments`
- `lms_user_progress`
- `lms_lesson_progress`
- `lms_quizzes`
- `lms_quiz_questions`
- `lms_quiz_options`
- `lms_quiz_attempts`
- `lms_quiz_answers`
- `lms_certificates`
- `lms_course_access_logs`
- views `lms_user_course_visibility` e `lms_dashboard_department_completion`

Buckets esperados no Supabase Storage:

- `lms-thumbnails`
- `lms-banners`
- `lms-materials`
- `lms-certificates`
- `lms-videos`

## Etapa 2 estrutura de rotas

Rotas do colaborador:

- `src/app/(portal)/lms/page.tsx`
- `src/app/(portal)/lms/meus-treinamentos/page.tsx`
- `src/app/(portal)/lms/cursos/[id]/page.tsx`
- `src/app/(portal)/lms/aprender/[courseId]/[lessonId]/page.tsx`

Rotas RH/Admin:

- `src/app/(portal)/rh/lms/page.tsx`
- `src/app/(portal)/rh/lms/cursos/page.tsx`
- `src/app/(portal)/rh/lms/cursos/novo/page.tsx`
- `src/app/(portal)/rh/lms/cursos/[id]/editar/page.tsx`
- `src/app/(portal)/rh/lms/trilhas/page.tsx`
- `src/app/(portal)/rh/lms/atribuicoes/page.tsx`
- `src/app/(portal)/rh/lms/relatorios/page.tsx`

Rotas do gestor:

- `src/app/(portal)/gestor/lms/equipe/page.tsx`

## Etapa 3 telas administrativas

Componentes centrais:

- `src/components/lms/LmsAdminDashboardClient.tsx`
- `src/components/lms/LmsCourseEditor.tsx`
- `src/components/lms/AssignmentDialog.tsx`
- `src/components/lms/LmsReportsClient.tsx`

## Etapa 4 experiência do colaborador

Componentes centrais:

- `src/components/lms/MyTrainingsClient.tsx`
- `src/components/lms/CourseDetailClient.tsx`
- `src/components/lms/LessonLearningClient.tsx`
- `src/components/lms/CourseCard.tsx`
- `src/components/lms/LessonPlayer.tsx`
- `src/components/lms/ModuleAccordion.tsx`

## Etapa 5 quizzes e certificados

APIs:

- `src/app/api/lms/quizzes/[quizId]/submit/route.ts`
- `src/app/api/lms/certificates/[courseId]/route.ts`
- `src/lib/lms/pdf.ts`

## Etapa 6 dashboard e relatórios

Serviços server:

- `src/lib/lms/server.ts`
- `src/app/api/lms/admin/reports/export/route.ts`

## Etapa 7 refinamento final

Ajustes que normalmente entram na homologação:

- revisar layout e textos por empresa
- popular trilhas obrigatórias de onboarding
- publicar cursos reais e anexar conteúdos
- testar emissão de certificado com dados reais
- testar RLS com `admin`, `rh`, `gestor` e `colaborador`

## O que ajustar para ligar aos dados reais

- garantir que `profiles` tenha `role`, `active`, `company_id`, `department_id` e `manager_id`
- publicar cursos com `status = 'published'`
- registrar atribuições em `lms_assignments`
- revisar se o bucket privado do Storage está operacional
- opcionalmente customizar a geração do certificado com assinatura institucional
