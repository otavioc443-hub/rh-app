do $$
declare
  v_company_id uuid;
  v_course_id uuid;
  v_module_intro_id uuid;
  v_module_media_id uuid;
  v_module_quiz_id uuid;
  v_module_review_id uuid;
  v_lesson_video_id uuid;
  v_lesson_text_id uuid;
  v_lesson_pdf_id uuid;
  v_lesson_link_id uuid;
  v_lesson_file_id uuid;
  v_lesson_auto_quiz_id uuid;
  v_lesson_manual_quiz_id uuid;
  v_quiz_auto_id uuid;
  v_quiz_manual_id uuid;
  v_question_id uuid;
begin
  select id
  into v_company_id
  from public.companies
  order by created_at nulls last, name
  limit 1;

  if v_company_id is null then
    raise exception 'Nenhuma empresa encontrada em public.companies para criar o curso-modelo do LMS.';
  end if;

  select id
  into v_course_id
  from public.lms_courses
  where slug = 'laboratorio-completo-lms'
  limit 1;

  if v_course_id is not null then
    raise notice 'Curso-modelo do LMS ja existe. Seed ignorado.';
    return;
  end if;

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
  ) values (
    v_company_id,
    'Laboratorio completo do LMS',
    'laboratorio-completo-lms',
    'Curso-modelo criado para validar todas as funcoes principais do modulo de treinamentos.',
    'Use este curso para testar a jornada completa do LMS: criacao de trilha, aulas em varios formatos, avaliacao automatica, correcao manual, atribuicao, notificacoes, certificado e recursos de gamificacao.',
    'Ambiente de testes',
    8,
    true,
    true,
    75,
    'published',
    'publico_interno',
    true,
    false
  )
  returning id into v_course_id;

  insert into public.lms_course_modules (course_id, title, description, sort_order)
  values
    (v_course_id, 'Fase 1 - Entrada na jornada', 'Apresenta o curso, explica o objetivo da trilha e testa a experiencia inicial do colaborador.', 1),
    (v_course_id, 'Fase 2 - Midias e materiais', 'Explora PDF, arquivo complementar e link externo para validar os formatos de conteudo.', 2),
    (v_course_id, 'Fase 3 - Checkpoint automatico', 'Fase pensada para validar correcao automatica, nota minima e exibicao de feedback.', 3),
    (v_course_id, 'Fase 4 - Avaliacao com revisao manual', 'Valida fluxo de questao discursiva, fila de correcao e liberacao de nota apos revisao do RH.', 4);

  select id into v_module_intro_id from public.lms_course_modules where course_id = v_course_id and sort_order = 1;
  select id into v_module_media_id from public.lms_course_modules where course_id = v_course_id and sort_order = 2;
  select id into v_module_quiz_id from public.lms_course_modules where course_id = v_course_id and sort_order = 3;
  select id into v_module_review_id from public.lms_course_modules where course_id = v_course_id and sort_order = 4;

  insert into public.lms_lessons (
    course_id,
    module_id,
    title,
    description,
    lesson_type,
    content_url,
    content_text,
    duration_minutes,
    sort_order,
    is_required,
    allow_preview
  ) values
    (
      v_course_id,
      v_module_intro_id,
      'Boas-vindas em video',
      'Use um video curto para validar reproducao, conclusao automatica e abertura da jornada.',
      'video',
      'https://www.youtube.com/watch?v=J3CgDg7EiaE',
      '<h2>Objetivo</h2><p>Apresente o curso, mostre o valor da trilha e diga o que o colaborador precisa concluir nesta fase.</p><p><strong>Teste sugerido:</strong> assistir ao video e validar a marcacao de progresso.</p>',
      8,
      1,
      true,
      true
    ),
    (
      v_course_id,
      v_module_intro_id,
      'Guia textual de navegacao',
      'Valida leitura no portal, formatacao de texto e sequencia entre aulas.',
      'texto',
      '',
      '<h2>Como usar este curso</h2><ul><li>Avance fase por fase.</li><li>Marque as aulas concluidas.</li><li>Observe badges, XP e ranking.</li></ul><p>Este bloco serve para testar uma aula puramente textual.</p>',
      10,
      2,
      true,
      false
    ),
    (
      v_course_id,
      v_module_media_id,
      'Leitura de politica em PDF',
      'Use para validar upload, visualizacao e download de PDF.',
      'pdf',
      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      'Explique quais secoes do PDF precisam ser lidas e como isso sera cobrado no restante da trilha.',
      12,
      1,
      true,
      false
    ),
    (
      v_course_id,
      v_module_media_id,
      'Acesso a formulario externo',
      'Valida redirecionamento para link externo e retorno ao curso.',
      'link',
      'https://example.com/formulario-lms',
      'Abra o link, preencha o formulario de teste e volte para concluir a aula no portal.',
      5,
      2,
      true,
      false
    ),
    (
      v_course_id,
      v_module_media_id,
      'Download de material complementar',
      'Use para validar anexos como planilhas, guias ou documentos auxiliares.',
      'arquivo',
      'https://example.com/material-complementar-lms.zip',
      'Use esta aula para validar a experiencia de download de um material complementar.',
      5,
      3,
      false,
      false
    ),
    (
      v_course_id,
      v_module_quiz_id,
      'Checkpoint automatico da trilha',
      'Reune tipos diferentes de pergunta com correcao imediata.',
      'avaliacao',
      '',
      '',
      15,
      1,
      true,
      false
    ),
    (
      v_course_id,
      v_module_review_id,
      'Avaliacao final com revisao manual',
      'Use esta avaliacao para testar resposta discursiva e aprovacao apos correcao administrativa.',
      'avaliacao',
      '',
      '',
      20,
      1,
      true,
      false
    );

  select id into v_lesson_video_id from public.lms_lessons where course_id = v_course_id and module_id = v_module_intro_id and sort_order = 1;
  select id into v_lesson_text_id from public.lms_lessons where course_id = v_course_id and module_id = v_module_intro_id and sort_order = 2;
  select id into v_lesson_pdf_id from public.lms_lessons where course_id = v_course_id and module_id = v_module_media_id and sort_order = 1;
  select id into v_lesson_link_id from public.lms_lessons where course_id = v_course_id and module_id = v_module_media_id and sort_order = 2;
  select id into v_lesson_file_id from public.lms_lessons where course_id = v_course_id and module_id = v_module_media_id and sort_order = 3;
  select id into v_lesson_auto_quiz_id from public.lms_lessons where course_id = v_course_id and module_id = v_module_quiz_id and sort_order = 1;
  select id into v_lesson_manual_quiz_id from public.lms_lessons where course_id = v_course_id and module_id = v_module_review_id and sort_order = 1;

  insert into public.lms_quizzes (
    course_id,
    lesson_id,
    title,
    instructions,
    passing_score,
    max_attempts,
    randomize_questions,
    show_score_on_submit,
    show_correct_answers
  ) values
    (
      v_course_id,
      v_lesson_auto_quiz_id,
      'Checkpoint automatico da trilha',
      'Responda as perguntas abaixo para validar a compreensao da fase. Esta avaliacao foi montada para testar correcoes automaticas do LMS.',
      75,
      2,
      false,
      true,
      true
    ),
    (
      v_course_id,
      v_lesson_manual_quiz_id,
      'Avaliacao final com revisao manual',
      'Descreva como voce usaria o LMS em um contexto real da empresa. Esta resposta deve passar pela fila de correcao manual.',
      80,
      1,
      false,
      false,
      false
    );

  select id into v_quiz_auto_id from public.lms_quizzes where lesson_id = v_lesson_auto_quiz_id;
  select id into v_quiz_manual_id from public.lms_quizzes where lesson_id = v_lesson_manual_quiz_id;

  insert into public.lms_quiz_questions (
    quiz_id,
    statement,
    question_type,
    help_text,
    image_url,
    accepted_answers,
    requires_manual_review,
    sort_order
  ) values
    (
      v_quiz_auto_id,
      'Qual opcao representa uma aula em leitura diretamente dentro do portal?',
      'single_choice',
      '',
      '',
      '{}',
      false,
      1
    ),
    (
      v_quiz_auto_id,
      'Quais recursos deste curso servem para testar midias e materiais?',
      'multiple_choice',
      '',
      '',
      '{}',
      false,
      2
    ),
    (
      v_quiz_auto_id,
      'Cursos em rascunho podem ser vistos normalmente pelo colaborador.',
      'true_false',
      '',
      '',
      '{}',
      false,
      3
    ),
    (
      v_quiz_auto_id,
      'Escreva uma palavra-chave que represente o objetivo principal deste curso-modelo.',
      'short_text',
      '',
      '',
      array['teste','validacao','lms'],
      false,
      4
    ),
    (
      v_quiz_auto_id,
      'Use esta pergunta para testar alternativas visuais no banco de questoes ou na propria aula.',
      'image_choice',
      'Adicione imagens nas opcoes quando quiser testar a experiencia completa.',
      '',
      '{}',
      false,
      5
    ),
    (
      v_quiz_manual_id,
      'Explique, em um paragrafo, como este curso-modelo ajuda a validar a criacao, a jornada do aluno e os recursos de avaliacao do LMS.',
      'essay',
      '',
      '',
      '{}',
      true,
      1
    );

  select id into v_question_id from public.lms_quiz_questions where quiz_id = v_quiz_auto_id and sort_order = 1;
  insert into public.lms_quiz_options (question_id, text, is_correct, image_url) values
    (v_question_id, 'Texto', true, ''),
    (v_question_id, 'Video', false, ''),
    (v_question_id, 'Arquivo', false, '');

  select id into v_question_id from public.lms_quiz_questions where quiz_id = v_quiz_auto_id and sort_order = 2;
  insert into public.lms_quiz_options (question_id, text, is_correct, image_url) values
    (v_question_id, 'PDF', true, ''),
    (v_question_id, 'Arquivo complementar', true, ''),
    (v_question_id, 'Link externo', true, ''),
    (v_question_id, 'Somente badge', false, '');

  select id into v_question_id from public.lms_quiz_questions where quiz_id = v_quiz_auto_id and sort_order = 3;
  insert into public.lms_quiz_options (question_id, text, is_correct, image_url) values
    (v_question_id, 'Verdadeiro', false, ''),
    (v_question_id, 'Falso', true, '');

  select id into v_question_id from public.lms_quiz_questions where quiz_id = v_quiz_auto_id and sort_order = 5;
  insert into public.lms_quiz_options (question_id, text, is_correct, image_url) values
    (v_question_id, 'Opcao visual A', true, ''),
    (v_question_id, 'Opcao visual B', false, '');

  raise notice 'Curso-modelo do LMS criado com sucesso. course_id=%', v_course_id;
end $$;
