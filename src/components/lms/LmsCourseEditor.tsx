"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, FileText, GraduationCap, ImagePlus, Maximize2, Plus, Sparkles, Trash2, Video, X } from "lucide-react";
import { CourseHeader } from "@/components/lms/CourseHeader";
import { FileUploader } from "@/components/lms/FileUploader";
import { LessonPlayer } from "@/components/lms/LessonPlayer";
import { LmsMediaLibrary } from "@/components/lms/LmsMediaLibrary";
import { ModuleAccordion } from "@/components/lms/ModuleAccordion";
import { QuizPreviewCard } from "@/components/lms/QuizPreviewCard";
import { PageHeader } from "@/components/ui/PageShell";
import { PageHelpModal } from "@/components/ui/PageHelpModal";
import { coursesService } from "@/lib/lms/coursesService";
import type { LmsCourseDetail, LmsCourseEditorPayload, LmsQuestionBankItem, LmsQuizPayload, LmsQuizQuestionType } from "@/lib/lms/types";
import { buildCourseDefaults, slugifyCourseTitle } from "@/lib/lms/utils";

type EditorData = {
  course?: Record<string, unknown>;
  modules?: Array<Record<string, unknown>>;
  quiz?: LmsQuizPayload | null;
};

type EditorStep = "identity" | "structure" | "publication" | "review";
type PreviewMode = "catalog" | "journey" | "lesson";

const steps: Array<{ id: EditorStep; title: string; subtitle: string }> = [
  { id: "identity", title: "Identidade", subtitle: "Nome, objetivo e resumo" },
  { id: "structure", title: "Conteudo", subtitle: "Fases, aulas e avaliacao" },
  { id: "publication", title: "Publicacao", subtitle: "Midia, acesso e regras" },
  { id: "review", title: "Revisao final", subtitle: "Checklist e publicacao" },
];

const stepExperienceGuide: Record<
  EditorStep,
  { eyebrow: string; title: string; description: string; outcomes: string[] }
> = {
  identity: {
    eyebrow: "Primeiro passo",
    title: "Defina a promessa do treinamento",
    description: "Aqui o RH decide como o curso vai ser percebido no catalogo e qual ganho o colaborador deve enxergar logo de cara.",
    outcomes: ["Nome claro", "Resumo objetivo", "Categoria e carga horaria"],
  },
  structure: {
    eyebrow: "Montagem da jornada",
    title: "Organize fases, aulas e checkpoints",
    description: "Essa etapa deve parecer um mapa de aprendizagem: o que vem primeiro, o que valida conhecimento e qual e o proximo passo natural.",
    outcomes: ["Fases em ordem", "Aulas com formato certo", "Avaliacao quando fizer sentido"],
  },
  publication: {
    eyebrow: "Ajuste final de exibicao",
    title: "Prepare a apresentacao e as regras do curso",
    description: "A publicacao fica depois da estrutura para que voce pense em identidade visual, acesso e criterios de aprovacao so quando o curso ja estiver montado.",
    outcomes: ["Status e visibilidade", "Imagem do card e banner", "Regras de obrigatoriedade e aprovacao"],
  },
  review: {
    eyebrow: "Decisao final",
    title: "Revise a experiencia inteira antes de salvar",
    description: "Use esta etapa como uma aprovacao final: confirme clareza, jornada, midias e se faz sentido publicar agora ou manter em rascunho.",
    outcomes: ["Checklist completo", "Jornada revisada", "Decisao segura de publicar ou salvar"],
  },
};

const courseStatusOptions = [
  { value: "draft", label: "Rascunho", description: "Ainda em construcao. Nao aparece para o colaborador." },
  { value: "published", label: "Publicado", description: "Pronto para aparecer e ser atribuido." },
  { value: "archived", label: "Arquivado", description: "Fica guardado e nao recebe novas atribuicoes." },
] as const;

const courseVisibilityOptions = [
  { value: "publico_interno", label: "Publico interno", description: "Disponivel no catalogo interno." },
  { value: "restrito", label: "Restrito", description: "Exibicao controlada por contexto de atribuicao." },
] as const;

const questionTypeLabels: Record<LmsQuizQuestionType, string> = {
  single_choice: "Objetiva com uma resposta",
  multiple_choice: "Multipla escolha",
  true_false: "Verdadeiro ou falso",
  short_text: "Resposta curta",
  essay: "Discursiva",
  image_choice: "Escolha por imagem",
};

const lessonTypeOptions: Array<{
  value: LmsCourseEditorPayload["modules"][number]["lessons"][number]["lesson_type"];
  label: string;
  description: string;
}> = [
  { value: "texto", label: "Texto", description: "Leitura guiada direto no portal." },
  { value: "video", label: "Video", description: "Aula com link externo ou arquivo hospedado." },
  { value: "pdf", label: "PDF", description: "Norma, manual, politica ou leitura formal." },
  { value: "arquivo", label: "Arquivo", description: "Planilha, documento, imagem ou anexo." },
  { value: "link", label: "Link", description: "Acesso para ferramenta, formulario ou pagina externa." },
  { value: "avaliacao", label: "Avaliacao", description: "Valide a aprendizagem com perguntas e nota." },
];

const lessonTemplates = [
  {
    id: "video-guided",
    label: "Video com orientacoes",
    description: "Ideal para boas-vindas, demonstracao e explicacao guiada.",
    build: (): LmsCourseEditorPayload["modules"][number]["lessons"][number] => ({
      ...createLesson(1),
      title: "Aula em video",
      lesson_type: "video",
      description: "Video principal com resumo e orientacoes para o colaborador.",
      content_text: "Liste aqui os pontos centrais do video e o que deve ser observado durante a aula.",
    }),
  },
  {
    id: "reading-pdf",
    label: "Leitura de PDF",
    description: "Boa para normas, politicas, procedimentos e manuais.",
    build: (): LmsCourseEditorPayload["modules"][number]["lessons"][number] => ({
      ...createLesson(1),
      title: "Leitura orientada",
      lesson_type: "pdf",
      description: "Documento principal com guia de leitura.",
      content_text: "Explique o que o colaborador deve ler e quais pontos merecem mais atencao.",
    }),
  },
  {
    id: "text-guide",
    label: "Guia textual",
    description: "Usado quando o conteudo sera consumido direto no portal.",
    build: (): LmsCourseEditorPayload["modules"][number]["lessons"][number] => ({
      ...createLesson(1),
      title: "Guia textual",
      lesson_type: "texto",
      description: "Explicacao passo a passo em texto.",
      content_text: "<h2>Objetivo da etapa</h2><p>Escreva aqui as instrucoes completas do conteudo.</p>",
    }),
  },
  {
    id: "external-link",
    label: "Acesso externo",
    description: "Para formularios, plataformas e materiais hospedados fora do portal.",
    build: (): LmsCourseEditorPayload["modules"][number]["lessons"][number] => ({
      ...createLesson(1),
      title: "Atividade externa",
      lesson_type: "link",
      description: "Link para ferramenta ou formulario complementar.",
      content_text: "Diga o que a pessoa precisa fazer quando abrir o link e como voltar para a trilha.",
    }),
  },
  {
    id: "checkpoint-quiz",
    label: "Checkpoint de avaliacao",
    description: "Valida aprendizado no final da fase ou do curso.",
    build: (): LmsCourseEditorPayload["modules"][number]["lessons"][number] => ({
      ...createLesson(1),
      title: "Checkpoint da fase",
      lesson_type: "avaliacao",
      description: "Avaliacao para validar se a etapa foi compreendida.",
      content_text: "",
      quiz: createLessonQuiz("Checkpoint da fase"),
    }),
  },
] as const;

const courseTemplates = [
  {
    id: "onboarding-corporativo",
    label: "Onboarding corporativo",
    description: "Estrutura base para integrar novos colaboradores com cultura, processos e avaliacao final.",
    build: (): LmsCourseEditorPayload => ({
      ...buildCourseDefaults(),
      title: "Onboarding corporativo",
      slug: "onboarding-corporativo",
      category: "Onboarding",
      workload_hours: 4,
      short_description: "Trilha inicial para novos colaboradores.",
      full_description: "Curso introdutorio com cultura, acessos, processos internos e orientacoes essenciais para a chegada ao portal.",
      required: true,
      certificate_enabled: true,
      sequence_required: true,
      onboarding_recommended: true,
      modules: [
        {
          ...createModule(1),
          title: "Boas-vindas",
          lessons: [
            {
              ...lessonTemplates[0].build(),
              title: "Mensagem de boas-vindas",
              sort_order: 1,
            },
            {
              ...lessonTemplates[2].build(),
              title: "Como navegar no portal",
              sort_order: 2,
            },
          ],
        },
        {
          ...createModule(2),
          title: "Politicas e rotinas",
          lessons: [
            {
              ...lessonTemplates[1].build(),
              title: "Leitura de politicas essenciais",
              sort_order: 1,
            },
            {
              ...lessonTemplates[4].build(),
              title: "Checkpoint do onboarding",
              sort_order: 2,
            },
          ],
        },
      ],
      quiz: null,
    }),
  },
  {
    id: "compliance-reciclagem",
    label: "Reciclagem de compliance",
    description: "Modelo de curso para normas, atualizacao periodica e comprovacao de leitura.",
    build: (): LmsCourseEditorPayload => ({
      ...buildCourseDefaults(),
      title: "Reciclagem de compliance",
      slug: "reciclagem-compliance",
      category: "Compliance",
      workload_hours: 2,
      short_description: "Atualizacao periodica sobre normas e condutas esperadas.",
      full_description: "Treinamento para reforco de politicas, conduta e responsabilidades, com avaliacao ao final.",
      required: true,
      certificate_enabled: true,
      sequence_required: true,
      modules: [
        {
          ...createModule(1),
          title: "Politicas atualizadas",
          lessons: [
            {
              ...lessonTemplates[1].build(),
              title: "Leitura da politica",
              sort_order: 1,
            },
            {
              ...lessonTemplates[3].build(),
              title: "Termo e materiais complementares",
              sort_order: 2,
            },
            {
              ...lessonTemplates[4].build(),
              title: "Validacao final",
              sort_order: 3,
            },
          ],
        },
      ],
      quiz: null,
    }),
  },
  {
    id: "lideranca-pratica",
    label: "Formacao de lideranca",
    description: "Modelo com video, leitura, atividade externa e checkpoint por fase.",
    build: (): LmsCourseEditorPayload => ({
      ...buildCourseDefaults(),
      title: "Formacao de lideranca",
      slug: "formacao-de-lideranca",
      category: "Lideranca",
      workload_hours: 6,
      short_description: "Desenvolvimento de lideres com foco em rotina, comunicacao e acompanhamento.",
      full_description: "Programa estruturado em fases curtas para desenvolver lideres em gestao de pessoas, comunicacao e execucao.",
      required: false,
      certificate_enabled: true,
      sequence_required: true,
      modules: [
        {
          ...createModule(1),
          title: "Fundamentos da lideranca",
          lessons: [
            { ...lessonTemplates[0].build(), title: "Abertura do programa", sort_order: 1 },
            { ...lessonTemplates[2].build(), title: "Papel do lider", sort_order: 2 },
          ],
        },
        {
          ...createModule(2),
          title: "Aplicacao pratica",
          lessons: [
            { ...lessonTemplates[3].build(), title: "Atividade externa", sort_order: 1 },
            { ...lessonTemplates[4].build(), title: "Checkpoint da fase", sort_order: 2 },
          ],
        },
      ],
      quiz: null,
    }),
  },
] as const;

function createOption(order: number) {
  return {
    text: `Alternativa ${order}`,
    is_correct: order === 1,
    image_url: "",
  };
}

function createQuestion(order: number, questionType: LmsQuizQuestionType = "single_choice") {
  return {
    statement: "",
    help_text: "",
    question_type: questionType,
    sort_order: order,
    image_url: "",
    accepted_answers: [""],
    requires_manual_review: questionType === "essay",
    options:
      questionType === "short_text" || questionType === "essay"
        ? []
        : questionType === "true_false"
          ? [
              { text: "Verdadeiro", is_correct: true, image_url: "" },
              { text: "Falso", is_correct: false, image_url: "" },
            ]
          : [createOption(1), createOption(2)],
  };
}

function createLessonQuiz(title: string) {
  return {
    title: `Avaliacao - ${title}`,
    instructions: "Explique como responder e quais criterios definem a aprovacao.",
    passing_score: 70,
    max_attempts: 1,
    randomize_questions: false,
    show_score_on_submit: true,
    show_correct_answers: false,
    questions: [createQuestion(1)],
  };
}

function createLesson(sortOrder: number): LmsCourseEditorPayload["modules"][number]["lessons"][number] {
  return {
    title: `Aula ${sortOrder}`,
    description: "",
    lesson_type: "texto",
    content_url: "",
    content_text: "<p>Descreva aqui a experiencia da aula.</p>",
    duration_minutes: 15,
    sort_order: sortOrder,
    is_required: true,
    allow_preview: false,
    quiz: null,
  };
}

function createModule(sortOrder: number): LmsCourseEditorPayload["modules"][number] {
  return {
    title: `Modulo ${sortOrder}`,
    description: "",
    sort_order: sortOrder,
    lessons: [createLesson(1)],
  };
}

function toEditorQuiz(source: NonNullable<LmsCourseEditorPayload["quiz"]>) {
  return {
    title: source.title,
    instructions: source.instructions ?? "",
    passing_score: source.passing_score,
    max_attempts: source.max_attempts,
    randomize_questions: source.randomize_questions,
    show_score_on_submit: source.show_score_on_submit ?? true,
    show_correct_answers: source.show_correct_answers ?? false,
    questions: source.questions.map((question, index) => ({
      statement: question.statement,
      help_text: question.help_text ?? "",
      question_type: question.question_type,
      sort_order: question.sort_order ?? index + 1,
      image_url: question.image_url ?? "",
      accepted_answers: question.accepted_answers?.length ? question.accepted_answers : [""],
      requires_manual_review: question.requires_manual_review ?? question.question_type === "essay",
      options: question.options.map((option) => ({
        text: option.text,
        is_correct: option.is_correct,
        image_url: option.image_url ?? "",
      })),
    })),
  };
}

function normalizeModules(initialData?: EditorData | null): LmsCourseEditorPayload["modules"] {
  const rawModules = (initialData?.modules as LmsCourseEditorPayload["modules"] | undefined) ?? [];
  const modules = rawModules.length
    ? rawModules.map((module, moduleIndex) => ({
        ...module,
        sort_order: module.sort_order || moduleIndex + 1,
        lessons: (module.lessons ?? []).length
          ? module.lessons.map((lesson, lessonIndex) => ({
              ...createLesson(lessonIndex + 1),
              ...lesson,
              sort_order: lesson.sort_order || lessonIndex + 1,
              quiz:
                lesson.lesson_type === "avaliacao" && lesson.quiz
                  ? {
                      ...createLessonQuiz(lesson.title || `Aula ${lessonIndex + 1}`),
                      ...lesson.quiz,
                      questions:
                        lesson.quiz.questions?.length
                          ? lesson.quiz.questions.map((question, questionIndex) => ({
                              ...createQuestion(questionIndex + 1, question.question_type),
                              ...question,
                              sort_order: question.sort_order || questionIndex + 1,
                              options:
                                question.options?.length
                                  ? question.options.map((option, optionIndex) => ({
                                      ...createOption(optionIndex + 1),
                                      ...option,
                                    }))
                                  : question.question_type === "short_text" || question.question_type === "essay"
                                    ? []
                                    : [createOption(1), createOption(2)],
                            }))
                          : [createQuestion(1)],
                    }
                  : null,
            }))
          : [createLesson(1)],
      }))
    : [createModule(1)];

  if (initialData?.quiz) {
    const evaluationModuleIndex = modules.findIndex((module) => module.lessons.some((lesson) => lesson.lesson_type === "avaliacao"));
    if (evaluationModuleIndex >= 0) {
      const evaluationLessonIndex = modules[evaluationModuleIndex].lessons.findIndex((lesson) => lesson.lesson_type === "avaliacao");
      modules[evaluationModuleIndex].lessons[evaluationLessonIndex].quiz = {
        title: initialData.quiz.quiz.title,
        instructions: initialData.quiz.quiz.instructions ?? "",
        passing_score: initialData.quiz.quiz.passing_score,
        max_attempts: initialData.quiz.quiz.max_attempts,
        randomize_questions: initialData.quiz.quiz.randomize_questions,
        show_score_on_submit: initialData.quiz.quiz.show_score_on_submit ?? true,
        show_correct_answers: initialData.quiz.quiz.show_correct_answers ?? false,
        questions: initialData.quiz.questions.map((question, questionIndex) => ({
          statement: question.statement,
          help_text: question.help_text ?? "",
          question_type: question.question_type,
          sort_order: question.sort_order || questionIndex + 1,
          image_url: question.image_url ?? "",
          accepted_answers: question.accepted_answers?.length ? question.accepted_answers : [""],
          requires_manual_review: question.requires_manual_review ?? question.question_type === "essay",
          options: question.options.map((option) => ({
            text: option.text,
            is_correct: option.is_correct,
            image_url: option.image_url ?? "",
          })),
        })),
      };
    }
  }

  return modules;
}

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {hint ? <span className="-mt-1 text-xs text-slate-500">{hint}</span> : null}
      {children}
    </label>
  );
}

function StepCard({
  active,
  completed,
  index,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  completed: boolean;
  index: number;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border px-4 py-4 text-left transition ${
        active ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold ${active ? "bg-white/15 text-white" : completed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {completed ? <CheckCircle2 size={18} /> : index + 1}
        </span>
        <div>
          <div className={`text-sm font-semibold ${active ? "text-white" : "text-slate-950"}`}>{title}</div>
          <div className={`text-xs ${active ? "text-white/70" : "text-slate-500"}`}>{subtitle}</div>
        </div>
      </div>
    </button>
  );
}

export function LmsCourseEditor({
  mode,
  courseId,
  initialData,
}: {
  mode: "create" | "edit";
  courseId: string | null;
  initialData?: EditorData | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [draftState, setDraftState] = useState<"idle" | "saved" | "restored">("idle");
  const [currentStep, setCurrentStep] = useState<EditorStep>("identity");
  const [questionBank, setQuestionBank] = useState<LmsQuestionBankItem[]>([]);
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("catalog");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [selectedModuleIndex, setSelectedModuleIndex] = useState(0);
  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  const [previewExpandedModuleId, setPreviewExpandedModuleId] = useState<string | null>("preview-module-0");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);
  const [form, setForm] = useState<LmsCourseEditorPayload>({
    ...buildCourseDefaults(),
    ...(initialData?.course ?? {}),
    modules: normalizeModules(initialData),
    quiz: null,
  });

  const selectedModule = form.modules[selectedModuleIndex] ?? form.modules[0];
  const selectedLesson = selectedModule?.lessons[selectedLessonIndex] ?? selectedModule?.lessons[0];
  const currentStepGuide = stepExperienceGuide[currentStep];
  const draftStorageKey = useMemo(() => `lms-course-editor:${courseId ?? "new"}`, [courseId]);
  const totalLessons = useMemo(() => form.modules.reduce((sum, module) => sum + module.lessons.length, 0), [form.modules]);
  const evaluationLessons = useMemo(
    () => form.modules.flatMap((module, moduleIndex) =>
      module.lessons.map((lesson, lessonIndex) => ({ moduleIndex, lessonIndex, lesson })).filter((row) => row.lesson.lesson_type === "avaliacao"),
    ),
    [form.modules],
  );

  const publicationChecklist = useMemo(
    () => [
      { label: "Titulo do curso preenchido", done: Boolean(form.title.trim()) },
      { label: "Resumo curto informado", done: Boolean(form.short_description.trim()) },
      { label: "Descricao completa cadastrada", done: Boolean(form.full_description.trim()) },
      { label: "Pelo menos um modulo criado", done: form.modules.length > 0 },
      { label: "Pelo menos uma aula configurada", done: totalLessons > 0 },
      {
        label: "Cada aula tem o conteudo principal preenchido",
        done: form.modules.every((module) =>
          module.lessons.every((lesson) => {
            if (lesson.lesson_type === "avaliacao") return Boolean(lesson.quiz?.questions.length);
            if (lesson.lesson_type === "link") return Boolean(lesson.content_url.trim());
            if (lesson.lesson_type === "video" || lesson.lesson_type === "pdf" || lesson.lesson_type === "arquivo") {
              return Boolean(lesson.content_url.trim() || lesson.storage_path);
            }
            return Boolean(lesson.content_text.trim());
          }),
        ),
      },
      {
        label: "Aulas de avaliacao possuem perguntas validas",
        done: evaluationLessons.every(({ lesson }) =>
          lesson.quiz?.questions.every((question) => {
            if (!question.statement.trim()) return false;
            if (question.question_type === "essay") return true;
            if (question.question_type === "short_text") {
              return Boolean(question.requires_manual_review || question.accepted_answers?.some((answer) => answer.trim()));
            }
            return question.options.filter((option) => option.text.trim() || option.image_url).length >= 2;
          }) ?? false,
        ),
      },
    ],
    [evaluationLessons, form.full_description, form.modules, form.short_description, form.title, totalLessons],
  );
  const stepChecklists = useMemo(
    () => [
      {
        title: "Identidade",
        items: [
          { label: "Titulo preenchido", done: Boolean(form.title.trim()) },
          { label: "Endereco do curso definido", done: Boolean(form.slug.trim()) },
          { label: "Categoria informada", done: Boolean(form.category.trim()) },
          { label: "Resumo curto escrito", done: Boolean(form.short_description.trim()) },
        ],
      },
      {
        title: "Conteudo",
        items: [
          { label: "Pelo menos um modulo criado", done: form.modules.length > 0 },
          { label: "Pelo menos uma aula criada", done: totalLessons > 0 },
          {
            label: "Todas as aulas possuem titulo",
            done: form.modules.every((module) => module.lessons.every((lesson) => Boolean(lesson.title.trim()))),
          },
          {
            label: "Aulas de avaliacao possuem configuracao valida",
            done: evaluationLessons.every(({ lesson }) => Boolean(lesson.quiz?.questions.length)),
          },
        ],
      },
      {
        title: "Publicacao",
        items: [
          { label: "Status definido", done: Boolean(form.status) },
          { label: "Visibilidade definida", done: Boolean(form.visibility) },
          { label: "Imagem do card ou banner cadastrados", done: Boolean(form.thumbnail_url || form.banner_url) },
          { label: "Nota minima informada", done: form.passing_score !== null },
        ],
      },
    ],
    [evaluationLessons, form.category, form.modules, form.passing_score, form.short_description, form.slug, form.status, form.thumbnail_url, form.title, form.visibility, form.banner_url, totalLessons],
  );
  const currentStepChecklist = useMemo(() => {
    if (currentStep === "identity") return stepChecklists.find((group) => group.title === "Identidade");
    if (currentStep === "structure") return stepChecklists.find((group) => group.title === "Conteudo");
    if (currentStep === "publication") return stepChecklists.find((group) => group.title === "Publicacao");
    return undefined;
  }, [currentStep, stepChecklists]);
  const helpModalItems = useMemo(
    () => [
      ...currentStepGuide.outcomes.map((item) => ({ title: "Resultado esperado", text: item })),
      ...(currentStepChecklist?.items ?? []).map((item) => ({
        title: item.done ? "Ja conferido" : "Vale revisar",
        text: item.label,
      })),
    ],
    [currentStepChecklist, currentStepGuide.outcomes],
  );

  const previewDetail = useMemo<LmsCourseDetail>(
    () => ({
      course: {
        id: courseId ?? "preview-course",
        company_id: null,
        title: form.title || "Preview do curso",
        slug: form.slug || "preview-do-curso",
        short_description: form.short_description || null,
        full_description: form.full_description || null,
        category: form.category || null,
        thumbnail_url: form.thumbnail_url || null,
        banner_url: form.banner_url || null,
        workload_hours: form.workload_hours,
        required: form.required,
        certificate_enabled: form.certificate_enabled,
        passing_score: form.passing_score,
        status: form.status,
        visibility: form.visibility,
        sequence_required: form.sequence_required,
        onboarding_recommended: form.onboarding_recommended,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      modules: form.modules.map((module, moduleIndex) => ({
        id: `preview-module-${moduleIndex}`,
        course_id: courseId ?? "preview-course",
        title: module.title,
        description: module.description || null,
        sort_order: module.sort_order,
        created_at: new Date().toISOString(),
        lessons: module.lessons.map((lesson, lessonIndex) => ({
          id: `preview-lesson-${moduleIndex}-${lessonIndex}`,
          course_id: courseId ?? "preview-course",
          module_id: `preview-module-${moduleIndex}`,
          title: lesson.title,
          description: lesson.description || null,
          lesson_type: lesson.lesson_type,
          content_url: lesson.content_url || null,
          content_text:
            lesson.lesson_type === "avaliacao"
              ? lesson.quiz?.instructions || "A avaliacao aparecera aqui para o colaborador."
              : lesson.content_text || null,
          duration_minutes: lesson.duration_minutes,
          sort_order: lesson.sort_order,
          is_required: lesson.is_required,
          allow_preview: lesson.allow_preview,
          storage_bucket: lesson.storage_bucket ?? null,
          storage_path: lesson.storage_path ?? null,
          created_at: new Date().toISOString(),
        })),
      })),
      quiz: null,
      progress: {
        id: "preview-progress",
        user_id: "preview-user",
        course_id: courseId ?? "preview-course",
        status: "in_progress",
        progress_percent: 42,
        completed_lessons: Math.max(1, Math.floor(totalLessons / 2)),
        required_lessons: totalLessons,
        passed_quiz: false,
        started_at: new Date().toISOString(),
        completed_at: null,
        last_lesson_id: null,
        updated_at: new Date().toISOString(),
      },
      certificate: null,
    }),
    [courseId, form, totalLessons],
  );
  const selectedLessonQuizPreview = useMemo<LmsQuizPayload | null>(() => {
    if (!selectedLesson?.quiz) return null;
    return {
      quiz: {
        id: selectedLesson.quiz.id ?? `preview-quiz-${selectedModuleIndex}-${selectedLessonIndex}`,
        course_id: courseId ?? "preview-course",
        lesson_id: selectedLesson.id ?? `preview-lesson-${selectedModuleIndex}-${selectedLessonIndex}`,
        title: selectedLesson.quiz.title,
        instructions: selectedLesson.quiz.instructions,
        passing_score: selectedLesson.quiz.passing_score,
        max_attempts: selectedLesson.quiz.max_attempts,
        randomize_questions: selectedLesson.quiz.randomize_questions,
        show_score_on_submit: selectedLesson.quiz.show_score_on_submit,
        show_correct_answers: selectedLesson.quiz.show_correct_answers,
        created_at: new Date().toISOString(),
      },
      questions: selectedLesson.quiz.questions.map((question, questionIndex) => ({
        id: question.id ?? `preview-question-${questionIndex + 1}`,
        quiz_id: selectedLesson.quiz?.id ?? `preview-quiz-${selectedModuleIndex}-${selectedLessonIndex}`,
        statement: question.statement,
        question_type: question.question_type,
        help_text: question.help_text,
        image_url: question.image_url,
        accepted_answers: question.accepted_answers ?? [],
        requires_manual_review: question.requires_manual_review,
        sort_order: question.sort_order,
        options: question.options.map((option, optionIndex) => ({
          id: option.id ?? `preview-option-${questionIndex + 1}-${optionIndex + 1}`,
          question_id: question.id ?? `preview-question-${questionIndex + 1}`,
          text: option.text,
          is_correct: option.is_correct,
          image_url: option.image_url,
        })),
      })),
    };
  }, [courseId, selectedLesson, selectedLessonIndex, selectedModuleIndex]);
  const previewModes: Array<{ id: PreviewMode; label: string; description: string }> = [
    { id: "catalog", label: "Catalogo", description: "Como o curso se apresenta para entrar." },
    { id: "journey", label: "Trilha", description: "Como as fases e aulas aparecem para o aluno." },
    { id: "lesson", label: "Aula ativa", description: "Como o conteudo atual sera consumido." },
  ];
  const pendingChecklistCount = publicationChecklist.filter((item) => !item.done).length;
  const completedChecklistCount = publicationChecklist.length - pendingChecklistCount;

  function patchModule(index: number, updater: (value: LmsCourseEditorPayload["modules"][number]) => LmsCourseEditorPayload["modules"][number]) {
    setForm((current) => ({
      ...current,
      modules: current.modules.map((module, moduleIndex) => (moduleIndex === index ? updater(module) : module)),
    }));
  }

  function patchLesson(
    moduleIndex: number,
    lessonIndex: number,
    updater: (
      value: LmsCourseEditorPayload["modules"][number]["lessons"][number],
    ) => LmsCourseEditorPayload["modules"][number]["lessons"][number],
  ) {
    patchModule(moduleIndex, (module) => ({
      ...module,
      lessons: module.lessons.map((lesson, index) => (index === lessonIndex ? updater(lesson) : lesson)),
    }));
  }

  function patchLessonQuiz(
    moduleIndex: number,
    lessonIndex: number,
    updater: (
      value: NonNullable<LmsCourseEditorPayload["modules"][number]["lessons"][number]["quiz"]>,
    ) => NonNullable<LmsCourseEditorPayload["modules"][number]["lessons"][number]["quiz"]>,
  ) {
    patchLesson(moduleIndex, lessonIndex, (lesson) => ({
      ...lesson,
      quiz: updater(lesson.quiz ?? createLessonQuiz(lesson.title || "Avaliacao")),
    }));
  }

  function updateLessonType(moduleIndex: number, lessonIndex: number, nextType: LmsCourseEditorPayload["modules"][number]["lessons"][number]["lesson_type"]) {
    patchLesson(moduleIndex, lessonIndex, (lesson) => ({
      ...lesson,
      lesson_type: nextType,
      content_text:
        nextType === "texto"
          ? lesson.content_text || "<p>Descreva aqui a experiencia da aula.</p>"
          : nextType === "avaliacao"
            ? ""
            : lesson.content_text,
      quiz: nextType === "avaliacao" ? lesson.quiz ?? createLessonQuiz(lesson.title || "Avaliacao") : null,
    }));
  }

  function moveModule(moduleIndex: number, direction: "up" | "down") {
    setForm((current) => {
      const targetIndex = direction === "up" ? moduleIndex - 1 : moduleIndex + 1;
      if (targetIndex < 0 || targetIndex >= current.modules.length) return current;
      const modules = [...current.modules];
      const [moved] = modules.splice(moduleIndex, 1);
      modules.splice(targetIndex, 0, moved);
      return {
        ...current,
        modules: modules.map((module, index) => ({ ...module, sort_order: index + 1 })),
      };
    });
    setSelectedModuleIndex((current) => (direction === "up" ? Math.max(0, current - 1) : current + 1));
    setSelectedLessonIndex(0);
  }

  function moveLesson(moduleIndex: number, lessonIndex: number, direction: "up" | "down") {
    patchModule(moduleIndex, (current) => {
      const targetIndex = direction === "up" ? lessonIndex - 1 : lessonIndex + 1;
      if (targetIndex < 0 || targetIndex >= current.lessons.length) return current;
      const lessons = [...current.lessons];
      const [moved] = lessons.splice(lessonIndex, 1);
      lessons.splice(targetIndex, 0, moved);
      return {
        ...current,
        lessons: lessons.map((lesson, index) => ({ ...lesson, sort_order: index + 1 })),
      };
    });
    setSelectedLessonIndex((current) => (direction === "up" ? Math.max(0, current - 1) : current + 1));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      await coursesService.save(courseId, form);
      if (typeof window !== "undefined") window.localStorage.removeItem(draftStorageKey);
      router.push("/rh/lms/cursos");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar curso.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = window.localStorage.getItem(draftStorageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { form?: LmsCourseEditorPayload };
      if (parsed.form) {
        setForm(parsed.form);
        setDraftState("restored");
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !hydratedRef.current) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          form,
        }),
      );
      setDraftState("saved");
    }, 700);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [draftStorageKey, form]);

  useEffect(() => {
    void loadQuestionBank();
  }, []);

  useEffect(() => {
    if (currentStep === "identity") {
      setPreviewMode("catalog");
      return;
    }
    if (currentStep === "structure") {
      setPreviewMode(selectedLesson?.lesson_type === "avaliacao" ? "lesson" : "journey");
      return;
    }
    if (currentStep === "publication") {
      setPreviewMode("catalog");
      return;
    }
    setPreviewMode(selectedLesson?.lesson_type === "avaliacao" ? "lesson" : "journey");
  }, [currentStep, selectedLesson?.lesson_type]);

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  function validateQuestion(question: NonNullable<NonNullable<LmsCourseEditorPayload["modules"][number]["lessons"][number]["quiz"]>["questions"]>[number]) {
    if (!question.statement.trim()) return false;
    if (question.question_type === "essay") return true;
    if (question.question_type === "short_text") {
      return Boolean(question.requires_manual_review || question.accepted_answers?.some((answer) => answer.trim()));
    }
    return question.options.filter((option) => option.text.trim() || option.image_url).length >= 2;
  }

  function validateStep(step: EditorStep) {
    if (step === "identity") {
      if (!form.title.trim()) return "Preencha o titulo do treinamento para continuar.";
      if (!form.slug.trim()) return "Defina o endereco do curso para continuar.";
      if (!form.category.trim()) return "Informe a categoria do curso antes de avancar.";
      if (!form.short_description.trim()) return "Escreva um resumo curto para o card do curso.";
      return null;
    }

    if (step === "structure") {
      if (!form.modules.length) return "Crie pelo menos uma fase no curso.";
      for (const module of form.modules) {
        if (!module.title.trim()) return "Todas as fases precisam ter um nome.";
        if (!module.lessons.length) return "Cada fase precisa ter pelo menos uma aula.";
        for (const lesson of module.lessons) {
          if (!lesson.title.trim()) return "Todas as aulas precisam ter titulo.";
          if (lesson.lesson_type === "avaliacao") {
            if (!lesson.quiz?.questions.length) return `A aula "${lesson.title || "Avaliacao"}" precisa ter pelo menos uma pergunta.`;
            if (!lesson.quiz.questions.every(validateQuestion)) {
              return `Revise as perguntas da aula "${lesson.title || "Avaliacao"}" antes de avancar.`;
            }
          }
          if (lesson.lesson_type === "link" && !lesson.content_url.trim()) {
            return `A aula "${lesson.title || "Link"}" precisa do link principal.`;
          }
          if ((lesson.lesson_type === "video" || lesson.lesson_type === "pdf" || lesson.lesson_type === "arquivo") && !lesson.content_url.trim() && !lesson.storage_path) {
            return `A aula "${lesson.title || "Conteudo"}" precisa de um arquivo ou link principal.`;
          }
          if (lesson.lesson_type === "texto" && !lesson.content_text.trim()) {
            return `A aula "${lesson.title || "Texto"}" precisa do conteudo textual.`;
          }
        }
      }
      return null;
    }

    if (step === "publication") {
      if (!form.status) return "Defina o status do curso.";
      if (!form.visibility) return "Defina quem pode ver o curso.";
      if (form.passing_score === null) return "Informe a nota minima para aprovacao.";
      return null;
    }

    return null;
  }

  async function loadQuestionBank() {
    setQuestionBankLoading(true);
    try {
      const response = await fetch("/api/lms/admin/question-bank");
      const data = (await response.json()) as { items?: LmsQuestionBankItem[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar banco de perguntas.");
      setQuestionBank(data.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar banco de perguntas.");
    } finally {
      setQuestionBankLoading(false);
    }
  }

  function importQuestionFromBank(item: LmsQuestionBankItem) {
    patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
      ...current,
      questions: [
        ...current.questions,
        {
          statement: item.statement,
          help_text: item.help_text ?? "",
          question_type: item.question_type,
          sort_order: current.questions.length + 1,
          image_url: item.image_url ?? "",
          accepted_answers: item.accepted_answers?.length ? item.accepted_answers : [""],
          requires_manual_review: item.requires_manual_review ?? item.question_type === "essay",
          options: item.options.map((option) => ({
            text: option.text,
            is_correct: option.is_correct,
            image_url: option.image_url ?? "",
          })),
        },
      ],
    }));
    setMessage(`Pergunta "${item.title}" adicionada a esta avaliacao.`);
  }

  async function saveQuestionToBank(questionIndex: number) {
    if (!selectedLesson?.quiz) return;
    const question = selectedLesson.quiz.questions[questionIndex];
    if (!validateQuestion(question)) {
      setMessage("Revise a pergunta antes de salva-la no banco reutilizavel.");
      return;
    }
    try {
      const response = await fetch("/api/lms/admin/question-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: question.statement.slice(0, 80),
          statement: question.statement,
          help_text: question.help_text,
          question_type: question.question_type,
          image_url: question.image_url,
          accepted_answers: question.accepted_answers,
          requires_manual_review: question.requires_manual_review,
          options: question.options,
        }),
      });
      const data = (await response.json()) as { item?: LmsQuestionBankItem; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Falha ao salvar pergunta no banco.");
      if (data.item) {
        setQuestionBank((current) => [data.item!, ...current.filter((item) => item.id !== data.item!.id)]);
      }
      setMessage("Pergunta salva no banco reutilizavel.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar pergunta no banco.");
    }
  }

  function goToNextStep() {
    const validationError = validateStep(currentStep);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    const next = steps[currentStepIndex + 1];
    if (next) {
      setMessage("");
      setCurrentStep(next.id);
    }
  }

  function goToPreviousStep() {
    const previous = steps[currentStepIndex - 1];
    if (previous) {
      setMessage("");
      setCurrentStep(previous.id);
    }
  }

  function renderQuestionBuilder() {
    if (!selectedLesson || selectedLesson.lesson_type !== "avaliacao") return null;
    const quiz = selectedLesson.quiz ?? createLessonQuiz(selectedLesson.title || "Avaliacao");

    return (
      <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Configuracao da avaliacao</div>
            <div className="mt-1 text-lg font-semibold text-slate-950">Monte a avaliacao desta aula</div>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            {quiz.questions.length} pergunta(s)
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FieldGroup label="Titulo da avaliacao" hint="Nome que aparecera para o colaborador.">
            <input
              value={quiz.title}
              onChange={(event) => patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({ ...current, title: event.target.value }))}
              className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
              placeholder="Ex.: Checkpoint de conhecimentos"
            />
          </FieldGroup>
          <FieldGroup label="Nota minima" hint="Percentual minimo para aprovar.">
            <input
              type="number"
              value={quiz.passing_score}
              onChange={(event) => patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({ ...current, passing_score: Number(event.target.value) || 0 }))}
              className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
              placeholder="70"
            />
          </FieldGroup>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FieldGroup label="Tentativas maximas" hint="Deixe vazio para tentativas livres.">
            <input
              type="number"
              value={quiz.max_attempts ?? ""}
              onChange={(event) =>
                patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                  ...current,
                  max_attempts: event.target.value ? Number(event.target.value) : null,
                }))
              }
              className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
              placeholder="1"
            />
          </FieldGroup>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={quiz.randomize_questions}
              onChange={(event) => patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({ ...current, randomize_questions: event.target.checked }))}
            />
            Embaralhar perguntas
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={quiz.show_score_on_submit}
              onChange={(event) => patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({ ...current, show_score_on_submit: event.target.checked }))}
            />
            Mostrar nota ao finalizar
          </label>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={quiz.show_correct_answers}
            onChange={(event) => patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({ ...current, show_correct_answers: event.target.checked }))}
          />
          Mostrar respostas corretas apos o envio
        </label>

        <FieldGroup label="Orientacoes para o colaborador" hint="Explique como responder e se a nota aparece imediatamente.">
          <textarea
            value={quiz.instructions}
            onChange={(event) => patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({ ...current, instructions: event.target.value }))}
            className="min-h-[110px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
            placeholder="Ex.: Leia com atencao, responda em uma tentativa e confira sua nota ao final."
          />
        </FieldGroup>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Banco reutilizavel de perguntas</div>
                <div className="mt-1 text-xs text-slate-500">Importe perguntas prontas para acelerar a construcao desta avaliacao.</div>
              </div>
              <button
                type="button"
                onClick={() => void loadQuestionBank()}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                {questionBankLoading ? "Atualizando..." : "Atualizar banco"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {questionBank.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-1 line-clamp-3 text-sm text-slate-600">{item.statement}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    {questionTypeLabels[item.question_type]}
                    {item.usage_count ? ` • ${item.usage_count} uso(s)` : ""}
                  </div>
                  <button
                    type="button"
                    onClick={() => importQuestionFromBank(item)}
                    className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Adicionar a esta avaliacao
                  </button>
                </div>
              ))}
              {!questionBank.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 md:col-span-2">
                  Nenhuma pergunta reutilizavel cadastrada ainda.
                </div>
              ) : null}
            </div>
          </div>
          {quiz.questions.map((question, questionIndex) => (
            <div key={`${question.statement}-${questionIndex}`} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950">Pergunta {questionIndex + 1}</div>
                <button
                  type="button"
                  onClick={() =>
                    patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                      ...current,
                      questions: current.questions.length === 1
                        ? [createQuestion(1)]
                        : current.questions.filter((_, index) => index !== questionIndex).map((item, index) => ({ ...item, sort_order: index + 1 })),
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Remover pergunta
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <FieldGroup label="Tipo da pergunta" hint="Escolha o formato que melhor representa a experiencia de resposta.">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(questionTypeLabels).map(([value, label]) => {
                      const active = question.question_type === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                              ...current,
                              questions: current.questions.map((item, index) =>
                                index === questionIndex
                                  ? {
                                      ...createQuestion(questionIndex + 1, value as LmsQuizQuestionType),
                                      ...item,
                                      question_type: value as LmsQuizQuestionType,
                                      requires_manual_review: value === "essay",
                                    }
                                  : item,
                              ),
                            }))
                          }
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            active ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                          }`}
                        >
                          <div className="text-sm font-semibold">{label}</div>
                          <div className={`mt-1 text-xs leading-5 ${active ? "text-white/70" : "text-slate-500"}`}>
                            {value === "essay"
                              ? "Resposta livre, com revisao manual."
                              : value === "short_text"
                                ? "Resposta curta com aceite automatico ou revisao."
                                : value === "image_choice"
                                  ? "Alternativas visuais com imagem."
                                  : "Correcao automatica ao finalizar."}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </FieldGroup>
                <FieldGroup label="Orientacao opcional" hint="Contexto adicional para ajudar na resposta.">
                  <input
                    value={question.help_text}
                    onChange={(event) =>
                      patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                        ...current,
                        questions: current.questions.map((item, index) => (index === questionIndex ? { ...item, help_text: event.target.value } : item)),
                      }))
                    }
                    className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                    placeholder="Ex.: Considere o procedimento descrito na fase anterior."
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Enunciado" hint="Pergunta principal que sera exibida para o colaborador.">
                <textarea
                  value={question.statement}
                  onChange={(event) =>
                    patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                      ...current,
                      questions: current.questions.map((item, index) => (index === questionIndex ? { ...item, statement: event.target.value } : item)),
                    }))
                  }
                  className="min-h-[110px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                  placeholder="Digite aqui a pergunta."
                />
              </FieldGroup>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr,0.9fr]">
                <div className="space-y-3">
                  <FileUploader
                    bucket="lms-materials"
                    label="Imagem de apoio da pergunta"
                    description="Opcional. Use em perguntas baseadas em imagem, cena ou documento."
                    accept="image/*"
                    onUploaded={(value) =>
                      patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                        ...current,
                        questions: current.questions.map((item, index) => (index === questionIndex ? { ...item, image_url: value } : item)),
                      }))
                    }
                  />
                  <LmsMediaLibrary
                    bucket="lms-materials"
                    title="Biblioteca de imagens e materiais"
                    description="Tambem e possivel reaproveitar uma imagem ja enviada."
                    onSelect={(value) =>
                      patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                        ...current,
                        questions: current.questions.map((item, index) => (index === questionIndex ? { ...item, image_url: value } : item)),
                      }))
                    }
                  />
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="font-semibold text-slate-900">Como essa pergunta sera corrigida</div>
                  <div className="mt-2">
                    {question.question_type === "essay"
                      ? "Pergunta discursiva. O envio fica registrado e a nota imediata pode ser ocultada."
                      : question.question_type === "short_text"
                        ? "Resposta curta. Informe uma ou mais respostas aceitas para permitir correcao automatica."
                        : "Pergunta objetiva. Marque qual alternativa esta correta para calcular a nota no envio."}
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveQuestionToBank(questionIndex)}
                    className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Salvar no banco de perguntas
                  </button>
                </div>
              </div>

              {question.question_type === "short_text" ? (
                <div className="mt-4 space-y-3">
                  {(question.accepted_answers ?? [""]).map((answer, answerIndex) => (
                    <div key={`${answerIndex}-${answer}`} className="flex gap-3">
                      <input
                        value={answer}
                        onChange={(event) =>
                          patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                            ...current,
                            questions: current.questions.map((item, index) =>
                              index === questionIndex
                                ? {
                                    ...item,
                                    accepted_answers: (item.accepted_answers ?? [""]).map((currentAnswer, currentAnswerIndex) =>
                                      currentAnswerIndex === answerIndex ? event.target.value : currentAnswer,
                                    ),
                                  }
                                : item,
                            ),
                          }))
                        }
                        className="h-11 flex-1 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                        placeholder="Resposta aceita"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                            ...current,
                            questions: current.questions.map((item, index) =>
                              index === questionIndex
                                ? {
                                    ...item,
                                    accepted_answers:
                                      (item.accepted_answers ?? []).length === 1
                                        ? [""]
                                        : (item.accepted_answers ?? []).filter((_, currentAnswerIndex) => currentAnswerIndex !== answerIndex),
                                  }
                                : item,
                            ),
                          }))
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                          ...current,
                          questions: current.questions.map((item, index) =>
                            index === questionIndex
                              ? { ...item, accepted_answers: [...(item.accepted_answers ?? []), ""] }
                              : item,
                          ),
                        }))
                      }
                      className="rounded-2xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      Adicionar resposta aceita
                    </button>
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={question.requires_manual_review ?? false}
                        onChange={(event) =>
                          patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                            ...current,
                            questions: current.questions.map((item, index) =>
                              index === questionIndex ? { ...item, requires_manual_review: event.target.checked } : item,
                            ),
                          }))
                        }
                      />
                      Exigir revisao manual
                    </label>
                  </div>
                </div>
              ) : null}

              {question.question_type === "essay" ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Resposta discursiva livre. O colaborador digita a resposta e o sistema registra para revisao posterior.
                </div>
              ) : null}

              {question.question_type !== "short_text" && question.question_type !== "essay" ? (
                <div className="mt-4 space-y-3">
                  {question.options.map((option, optionIndex) => (
                    <div key={`${optionIndex}-${option.text}`} className="rounded-2xl border border-slate-200 p-4">
                      <div className="grid gap-4 lg:grid-cols-[1fr,0.5fr,0.35fr]">
                        <input
                          value={option.text}
                          onChange={(event) =>
                            patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                              ...current,
                              questions: current.questions.map((item, index) =>
                                index === questionIndex
                                  ? {
                                      ...item,
                                      options: item.options.map((currentOption, currentOptionIndex) =>
                                        currentOptionIndex === optionIndex ? { ...currentOption, text: event.target.value } : currentOption,
                                      ),
                                    }
                                  : item,
                              ),
                            }))
                          }
                          className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                          placeholder={`Alternativa ${optionIndex + 1}`}
                        />
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={option.is_correct}
                            onChange={(event) =>
                              patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                                ...current,
                                questions: current.questions.map((item, index) =>
                                  index === questionIndex
                                    ? {
                                        ...item,
                                        options: item.options.map((currentOption, currentOptionIndex) => {
                                          if (currentOptionIndex !== optionIndex) {
                                            return item.question_type === "single_choice" || item.question_type === "true_false"
                                              ? { ...currentOption, is_correct: false }
                                              : currentOption;
                                          }
                                          return { ...currentOption, is_correct: event.target.checked };
                                        }),
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                          Resposta correta
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                              ...current,
                              questions: current.questions.map((item, index) =>
                                index === questionIndex
                                  ? {
                                      ...item,
                                      options:
                                        item.options.length === 2
                                          ? item.options
                                          : item.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex),
                                    }
                                  : item,
                              ),
                            }))
                          }
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          Remover
                        </button>
                      </div>
                      {question.question_type === "image_choice" ? (
                        <div className="mt-3">
                          <div className="space-y-3">
                            <FileUploader
                              bucket="lms-materials"
                              label={`Imagem da alternativa ${optionIndex + 1}`}
                              description="Opcional. Use quando a resposta depende de comparacao visual."
                              accept="image/*"
                              onUploaded={(value) =>
                                patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                                  ...current,
                                  questions: current.questions.map((item, index) =>
                                    index === questionIndex
                                      ? {
                                          ...item,
                                          options: item.options.map((currentOption, currentOptionIndex) =>
                                            currentOptionIndex === optionIndex ? { ...currentOption, image_url: value } : currentOption,
                                          ),
                                        }
                                      : item,
                                  ),
                                }))
                              }
                            />
                            <LmsMediaLibrary
                              bucket="lms-materials"
                              title="Biblioteca de imagens"
                              description="Use uma imagem que ja existe no portal como alternativa visual."
                              onSelect={(value) =>
                                patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                                  ...current,
                                  questions: current.questions.map((item, index) =>
                                    index === questionIndex
                                      ? {
                                          ...item,
                                          options: item.options.map((currentOption, currentOptionIndex) =>
                                            currentOptionIndex === optionIndex ? { ...currentOption, image_url: value } : currentOption,
                                          ),
                                        }
                                      : item,
                                  ),
                                }))
                              }
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                        ...current,
                        questions: current.questions.map((item, index) =>
                          index === questionIndex
                            ? { ...item, options: [...item.options, createOption(item.options.length + 1)] }
                            : item,
                        ),
                      }))
                    }
                    className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    Adicionar alternativa
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              patchLessonQuiz(selectedModuleIndex, selectedLessonIndex, (current) => ({
                ...current,
                questions: [...current.questions, createQuestion(current.questions.length + 1)],
              }))
            }
            className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <Plus size={16} /> Nova pergunta
          </button>
        </div>
      </div>
    );
  }

  function renderStructureStep() {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Desenhe a jornada de aprendizagem</h2>
            <p className="mt-1 text-sm text-slate-500">
              Pense como o aluno: fase por fase, com objetivos claros, aulas curtas e checkpoints no momento certo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setForm((current) => ({ ...current, modules: [...current.modules, createModule(current.modules.length + 1)] }));
              setSelectedModuleIndex(form.modules.length);
              setSelectedLessonIndex(0);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} /> Novo modulo
          </button>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cena atual da jornada</div>
            <div className="mt-2 text-xl font-semibold text-slate-950">
              {selectedModule?.title || "Nova fase"}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {selectedLesson?.title || "Nova aula"} {selectedLesson ? `/ ${selectedLesson.lesson_type === "avaliacao" ? "avaliacao" : selectedLesson.lesson_type}` : ""}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/90 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fases</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{form.modules.length}</div>
              </div>
              <div className="rounded-2xl bg-white/90 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aulas</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{totalLessons}</div>
              </div>
              <div className="rounded-2xl bg-white/90 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fluxo</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{form.sequence_required ? "Em sequencia" : "Livre"}</div>
              </div>
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Como deixar essa etapa melhor</div>
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">Crie fases curtas, com nome claro e papel bem definido na trilha.</div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">Misture formatos quando fizer sentido: video para contexto, texto para instrucoes e avaliacao para validacao.</div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">Pense sempre no proximo passo do aluno. Cada aula precisa convidar a continuar.</div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mapa da experiencia</div>
              <div className="mt-1 text-xl font-semibold text-slate-950">{selectedModule?.title || "Nova fase"} • {selectedLesson?.title || "Nova aula"}</div>
              <div className="mt-2 text-sm text-slate-600">
                O criador organiza o curso em fases. O colaborador enxerga uma trilha simples, com proximo passo claro.
              </div>
            </div>
            <div className="grid min-w-[260px] gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/90 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fases</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{form.modules.length}</div>
              </div>
              <div className="rounded-2xl bg-white/90 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aulas</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{totalLessons}</div>
              </div>
              <div className="rounded-2xl bg-white/90 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Etapa atual</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{selectedLesson?.lesson_type === "avaliacao" ? "Avaliacao" : selectedLesson?.lesson_type || "Texto"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.4fr,0.6fr]">
          <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            {form.modules.map((module, moduleIndex) => (
              <div key={`${module.title}-${moduleIndex}`} className={`rounded-[22px] border px-4 py-4 ${moduleIndex === selectedModuleIndex ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => { setSelectedModuleIndex(moduleIndex); setSelectedLessonIndex(0); }} className="min-w-0 text-left">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fase {moduleIndex + 1}</div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-950">{module.title}</div>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveModule(moduleIndex, "up")}
                      disabled={moduleIndex === 0}
                      className="rounded-xl border border-slate-200 p-2 text-slate-500 disabled:opacity-40"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveModule(moduleIndex, "down")}
                      disabled={moduleIndex === form.modules.length - 1}
                      className="rounded-xl border border-slate-200 p-2 text-slate-500 disabled:opacity-40"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                    onClick={() => {
                      const source = form.modules[moduleIndex];
                      setForm((current) => {
                        const copy = {
                          ...source,
                          title: `${source.title} - copia`,
                          sort_order: moduleIndex + 2,
                          lessons: source.lessons.map((lesson, lessonIndex) => ({
                            ...lesson,
                            title: `${lesson.title} - copia`,
                            sort_order: lessonIndex + 1,
                            quiz: lesson.quiz
                              ? {
                                  ...lesson.quiz,
                                  title: `${lesson.quiz.title} - copia`,
                                  questions: lesson.quiz.questions.map((question) => ({
                                    ...question,
                                    accepted_answers: [...(question.accepted_answers ?? [])],
                                    options: question.options.map((option) => ({ ...option })),
                                  })),
                                }
                              : null,
                          })),
                        };
                          const modules = [...current.modules];
                          modules.splice(moduleIndex + 1, 0, copy);
                          return { ...current, modules: modules.map((item, index) => ({ ...item, sort_order: index + 1 })) };
                        });
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((current) => {
                          const modules = current.modules.filter((_, index) => index !== moduleIndex).map((item, index) => ({ ...item, sort_order: index + 1 }));
                          return { ...current, modules: modules.length ? modules : [createModule(1)] };
                        });
                        setSelectedModuleIndex(0);
                        setSelectedLessonIndex(0);
                      }}
                      className="rounded-xl border border-slate-200 p-2 text-slate-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {moduleIndex === selectedModuleIndex ? (
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div key={`${lesson.title}-${lessonIndex}`} className={`rounded-2xl border px-3 py-3 transition ${lessonIndex === selectedLessonIndex ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <button type="button" onClick={() => setSelectedLessonIndex(lessonIndex)} className="min-w-0 flex-1 text-left">
                            <div className="text-sm font-semibold">{lesson.title}</div>
                            <div className={`text-xs capitalize ${lessonIndex === selectedLessonIndex ? "text-white/70" : "text-slate-500"}`}>{lesson.lesson_type === "avaliacao" ? "avaliacao" : lesson.lesson_type}</div>
                          </button>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${lessonIndex === selectedLessonIndex ? "text-white/70" : "text-slate-500"}`}>{lesson.duration_minutes ?? 0} min</span>
                            <button
                              type="button"
                              onClick={() => moveLesson(moduleIndex, lessonIndex, "up")}
                              disabled={lessonIndex === 0}
                              className={`rounded-lg border p-1.5 ${lessonIndex === selectedLessonIndex ? "border-white/20 text-white/80" : "border-slate-200 text-slate-500"} disabled:opacity-40`}
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveLesson(moduleIndex, lessonIndex, "down")}
                              disabled={lessonIndex === module.lessons.length - 1}
                              className={`rounded-lg border p-1.5 ${lessonIndex === selectedLessonIndex ? "border-white/20 text-white/80" : "border-slate-200 text-slate-500"} disabled:opacity-40`}
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const next = form.modules[moduleIndex].lessons.length + 1;
                        patchModule(moduleIndex, (current) => ({ ...current, lessons: [...current.lessons, createLesson(next)] }));
                        setSelectedLessonIndex(form.modules[moduleIndex].lessons.length);
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      <Plus size={16} /> Adicionar aula
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {selectedModule && selectedLesson ? (
            <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Configurando aula</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">{selectedLesson.title || "Nova aula"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const source = form.modules[selectedModuleIndex].lessons[selectedLessonIndex];
                      patchModule(selectedModuleIndex, (current) => {
                        const lessons = [...current.lessons];
                        lessons.splice(selectedLessonIndex + 1, 0, {
                          ...source,
                          title: `${source.title} - copia`,
                          sort_order: selectedLessonIndex + 2,
                          quiz: source.quiz
                            ? {
                                ...source.quiz,
                                title: `${source.quiz.title} - copia`,
                                questions: source.quiz.questions.map((question) => ({
                                  ...question,
                                  accepted_answers: [...(question.accepted_answers ?? [])],
                                  options: question.options.map((option) => ({ ...option })),
                                })),
                              }
                            : null,
                        });
                        return {
                          ...current,
                          lessons: lessons.map((lesson, index) => ({ ...lesson, sort_order: index + 1 })),
                        };
                      });
                    }}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Duplicar aula
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      patchModule(selectedModuleIndex, (current) => {
                        const lessons = current.lessons.filter((_, index) => index !== selectedLessonIndex).map((lesson, index) => ({ ...lesson, sort_order: index + 1 }));
                        return { ...current, lessons: lessons.length ? lessons : [createLesson(1)] };
                      });
                      setSelectedLessonIndex(0);
                    }}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Remover aula
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">Como preencher esta etapa</div>
                <div className="mt-1">Escolha o formato da aula e o formulario se adapta ao que realmente vai ser usado pelo colaborador.</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Modelos de aula prontos</div>
                <div className="mt-1 text-xs text-slate-500">Use um modelo para preencher esta aula mais rapido e depois personalize os campos.</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {lessonTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() =>
                        patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({
                          ...template.build(),
                          id: lesson.id,
                          sort_order: lesson.sort_order,
                          is_required: lesson.is_required,
                          allow_preview: lesson.allow_preview,
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300 hover:shadow-sm"
                    >
                      <div className="text-sm font-semibold text-slate-900">{template.label}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldGroup label="Nome da fase" hint="Agrupamento em que a aula aparecera.">
                  <input
                    value={selectedModule.title}
                    onChange={(event) => patchModule(selectedModuleIndex, (module) => ({ ...module, title: event.target.value }))}
                    placeholder="Ex.: Boas-vindas e cultura"
                    className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                  />
                </FieldGroup>
                <FieldGroup label="Titulo da aula" hint="Nome visivel para o colaborador.">
                  <input
                    value={selectedLesson.title}
                    onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, title: event.target.value, quiz: lesson.quiz ? { ...lesson.quiz, title: lesson.quiz.title || `Avaliacao - ${event.target.value}` } : lesson.quiz }))}
                    placeholder="Ex.: Conhecendo o portal"
                    className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                  />
                </FieldGroup>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Escolha o formato da aula</div>
                <div className="mt-1 text-xs text-slate-500">O editor mostra apenas os campos que fazem sentido para o tipo de conteudo escolhido.</div>
              </div>

              <div className="space-y-4">
                <FieldGroup label="Formato da experiencia" hint="Escolha como o colaborador vai consumir esta aula.">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {lessonTypeOptions.map((option) => {
                      const active = selectedLesson.lesson_type === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateLessonType(selectedModuleIndex, selectedLessonIndex, option.value)}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            active ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <div className="text-sm font-semibold">{option.label}</div>
                          <div className={`mt-1 text-xs leading-5 ${active ? "text-white/70" : "text-slate-500"}`}>{option.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </FieldGroup>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Configuracao principal da aula</div>
                <div className="mt-1 text-xs text-slate-500">Preencha so o que o colaborador realmente vai ver ou usar nesta etapa.</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldGroup label="Duracao estimada" hint="Tempo medio, em minutos.">
                  <input
                    type="number"
                    value={selectedLesson.duration_minutes ?? ""}
                    onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, duration_minutes: Number(event.target.value) || null }))}
                    className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                    placeholder="15"
                  />
                </FieldGroup>
                <FieldGroup label="Descricao da aula" hint="Resumo curto para contextualizar a etapa.">
                  <input
                    value={selectedLesson.description}
                    onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, description: event.target.value }))}
                    className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                    placeholder="Ex.: Video de apresentacao da plataforma."
                  />
                </FieldGroup>
              </div>

              {selectedLesson.lesson_type === "texto" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    <div className="font-semibold text-slate-900">Aula em texto</div>
                    <div className="mt-1">Use esse formato para guias, procedimentos, roteiros ou conteudo lido direto no portal.</div>
                  </div>
                  <FieldGroup label="Conteudo textual" hint="Texto principal que sera exibido na aula.">
                    <textarea
                      value={selectedLesson.content_text}
                      onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_text: event.target.value }))}
                      className="min-h-[220px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                      placeholder="Escreva aqui o conteudo completo da aula."
                    />
                  </FieldGroup>
                </div>
              ) : null}

              {selectedLesson.lesson_type === "video" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FieldGroup label="Link do video" hint="Use quando o video estiver no YouTube, Vimeo ou outra plataforma externa.">
                      <input
                        value={selectedLesson.content_url}
                        onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: event.target.value }))}
                        className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                        placeholder="Cole aqui a URL do video"
                      />
                    </FieldGroup>
                    <FileUploader
                      bucket="lms-videos"
                      label="Enviar video para o portal"
                      description="Se preferir hospedar aqui, envie o arquivo."
                      accept="video/*"
                      onUploaded={(value) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: value }))}
                    />
                  </div>
                  <LmsMediaLibrary
                    bucket="lms-videos"
                    title="Biblioteca de videos do portal"
                    description="Reuse um video ja enviado para outra aula em vez de subir o arquivo novamente."
                    onSelect={(value) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: value }))}
                  />
                  <FieldGroup label="Roteiro ou observacoes" hint="Use como apoio ao video, resumo dos pontos ou orientacoes do instrutor.">
                    <textarea
                      value={selectedLesson.content_text}
                      onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_text: event.target.value }))}
                      className="min-h-[180px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                      placeholder="Descreva o que o colaborador vera no video."
                    />
                  </FieldGroup>
                </div>
              ) : null}

              {selectedLesson.lesson_type === "pdf" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FieldGroup label="Link do PDF" hint="Use para PDF externo ou hospedado fora do portal.">
                      <input
                        value={selectedLesson.content_url}
                        onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: event.target.value }))}
                        className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                        placeholder="Cole aqui o link do PDF"
                      />
                    </FieldGroup>
                    <FileUploader
                      bucket="lms-materials"
                      label="Enviar PDF"
                      description="Documento principal da aula."
                      accept=".pdf"
                      onUploaded={(value) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: value }))}
                    />
                  </div>
                  <LmsMediaLibrary
                    bucket="lms-materials"
                    title="Biblioteca de documentos"
                    description="Escolha um PDF que ja existe no portal para reutilizar nesta aula."
                    onSelect={(value) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: value }))}
                  />
                  <FieldGroup label="Orientacao de leitura" hint="Explique ao colaborador o que deve ser observado no documento.">
                    <textarea
                      value={selectedLesson.content_text}
                      onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_text: event.target.value }))}
                      className="min-h-[160px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                      placeholder="Ex.: Leia as paginas 3 a 8 e observe as etapas do processo."
                    />
                  </FieldGroup>
                </div>
              ) : null}

              {selectedLesson.lesson_type === "arquivo" ? (
                <div className="space-y-4">
                  <FileUploader
                    bucket="lms-materials"
                    label="Arquivo principal da aula"
                    description="Aceita imagem, planilha, apresentacao, documento ou material complementar."
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*"
                    onUploaded={(value) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: value }))}
                  />
                  <LmsMediaLibrary
                    bucket="lms-materials"
                    title="Biblioteca de materiais"
                    description="Reaproveite planilhas, documentos, imagens e apresentacoes ja enviadas."
                    onSelect={(value) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: value }))}
                  />
                  <FieldGroup label="Instrucoes de uso do arquivo" hint="Explique para que serve e como o colaborador deve utiliza-lo.">
                    <textarea
                      value={selectedLesson.content_text}
                      onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_text: event.target.value }))}
                      className="min-h-[160px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                      placeholder="Ex.: Baixe a planilha e preencha o exercicio antes de seguir."
                    />
                  </FieldGroup>
                </div>
              ) : null}

              {selectedLesson.lesson_type === "link" ? (
                <div className="space-y-4">
                  <FieldGroup label="Link principal" hint="Use para pagina externa, formulario ou ferramenta complementar.">
                    <input
                      value={selectedLesson.content_url}
                      onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: event.target.value }))}
                      className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                      placeholder="Cole aqui a URL"
                    />
                  </FieldGroup>
                  <FieldGroup label="Orientacoes do acesso" hint="Explique o que a pessoa deve fazer ao abrir o link.">
                    <textarea
                      value={selectedLesson.content_text}
                      onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_text: event.target.value }))}
                      className="min-h-[160px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                      placeholder="Ex.: Acesse o formulario, preencha os dados e retorne para a proxima aula."
                    />
                  </FieldGroup>
                </div>
              ) : null}

              {selectedLesson.lesson_type === "avaliacao" ? renderQuestionBuilder() : null}

              <div className="grid gap-4 xl:grid-cols-[1fr,0.9fr]">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                      {selectedLesson.lesson_type === "video" ? <Video size={18} /> : selectedLesson.lesson_type === "avaliacao" ? <Sparkles size={18} /> : <FileText size={18} />}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Regras da aula</div>
                      <div className="text-xs text-slate-500">Defina se a etapa e obrigatoria e se pode aparecer como previa.</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedLesson.is_required}
                      onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, is_required: event.target.checked }))}
                    />
                    Aula obrigatoria
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedLesson.allow_preview}
                      onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, allow_preview: event.target.checked }))}
                    />
                    Liberar preview
                  </label>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  function renderIdentityStep() {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[0.65fr,0.35fr]">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Identidade do curso</h2>
            <p className="mt-1 text-sm text-slate-500">
              Aqui voce define como o treinamento sera entendido no catalogo e na pagina do colaborador.
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumo da proposta</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{form.title || "Seu curso ainda esta sem nome"}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              {form.short_description || "Descreva o principal ganho de quem vai fazer este treinamento."}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Categoria</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{form.category || "Defina a categoria"}</div>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Carga horaria</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{form.workload_hours ? `${form.workload_hours} hora(s)` : "Ainda nao definida"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Comece por um modelo completo</div>
          <div className="mt-1 text-xs text-slate-500">Se fizer sentido, use uma estrutura pronta e depois ajuste os detalhes do seu curso.</div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {courseTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  const next = template.build();
                  setForm((current) => ({
                    ...current,
                    ...next,
                    thumbnail_url: current.thumbnail_url,
                    banner_url: current.banner_url,
                  }));
                  setSelectedModuleIndex(0);
                  setSelectedLessonIndex(0);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="text-sm font-semibold text-slate-900">{template.label}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{template.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <FieldGroup label="Titulo do treinamento" hint="Nome principal exibido para RH, gestores e colaboradores.">
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                  slug:
                    !current.slug || current.slug === slugifyCourseTitle(current.title)
                      ? slugifyCourseTitle(event.target.value)
                      : current.slug,
                }))
              }
              placeholder="Ex.: Onboarding institucional"
              className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
            />
          </FieldGroup>
          <FieldGroup label="Endereco do curso" hint="Identificador da URL, normalmente em minusculas e com hifens.">
            <input
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              placeholder="Ex.: onboarding-portal-rh"
              className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
            />
          </FieldGroup>
          <FieldGroup label="Categoria" hint="Agrupa cursos parecidos no catalogo.">
            <input
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="Ex.: Onboarding, Compliance, Lideranca"
              className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
            />
          </FieldGroup>
          <FieldGroup label="Carga horaria" hint="Quantidade total de horas previstas para concluir o treinamento.">
            <input
              type="number"
              value={form.workload_hours ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, workload_hours: Number(event.target.value) || null }))}
              placeholder="Ex.: 4"
              className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
            />
          </FieldGroup>
        </div>

        <div className="mt-4 grid gap-4">
          <FieldGroup label="Resumo curto" hint="Texto breve para o card e para a apresentacao inicial do curso.">
            <textarea
              value={form.short_description}
              onChange={(event) => setForm((current) => ({ ...current, short_description: event.target.value }))}
              placeholder="Explique rapidamente o objetivo e o ganho esperado."
              className="min-h-[100px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
            />
          </FieldGroup>
          <FieldGroup label="Descricao completa" hint="Detalhe publico, objetivos, resultados esperados e contexto do treinamento.">
            <textarea
              value={form.full_description}
              onChange={(event) => setForm((current) => ({ ...current, full_description: event.target.value }))}
              placeholder="Descreva em mais detalhes a proposta, as etapas e os resultados esperados."
              className="min-h-[180px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
            />
          </FieldGroup>
        </div>
      </section>
    );
  }

  function renderPublicationStep() {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Publicacao, midia e regras</h2>
        <p className="mt-1 text-sm text-slate-500">
          Esta etapa so aparece depois da estrutura do curso, para voce publicar apenas o que estiver pronto.
        </p>

        <div className="mt-5 grid gap-4 xl:grid-cols-[0.56fr,0.44fr]">
          <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Antes de publicar</div>
            <div className="mt-2 text-xl font-semibold text-slate-950">Confirme como o curso vai aparecer no catalogo.</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              Aqui voce define o status, quem pode ver, criterios de aprovacao e as imagens que vao dar identidade ao treinamento.
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/85 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</div>
                <div className="mt-1 text-sm font-semibold text-slate-950 capitalize">{form.status}</div>
              </div>
              <div className="rounded-2xl bg-white/85 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Visibilidade</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{form.visibility === "publico_interno" ? "Publico interno" : "Restrito"}</div>
              </div>
              <div className="rounded-2xl bg-white/85 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Nota minima</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{form.passing_score ?? "-"}%</div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
            <div className="h-28 bg-slate-100">
              {form.banner_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.banner_url} alt={form.title || "Banner"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">Preview do banner</div>
              )}
            </div>
            <div className="flex gap-4 p-4">
              <div className="h-16 w-16 overflow-hidden rounded-[18px] bg-slate-100">
                {form.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.thumbnail_url} alt={form.title || "Capa"} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <ImagePlus size={16} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{form.category || "Treinamento"}</div>
                <div className="mt-1 truncate text-sm font-semibold text-slate-950">{form.title || "Seu curso ainda esta sem titulo"}</div>
                <div className="mt-2 line-clamp-3 text-sm text-slate-600">
                  {form.short_description || "O resumo curto aparecera aqui assim que voce preencher a identidade do curso."}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Status do curso</div>
              <div className="mt-1 text-xs text-slate-500">Escolha o momento da vida do treinamento. Assim o RH publica com mais seguranca.</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {courseStatusOptions.map((option) => {
                const active = form.status === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, status: option.value }))}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      active ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className={`mt-1 text-xs leading-5 ${active ? "text-white/70" : "text-slate-500"}`}>{option.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Visibilidade e aprovacao</div>
              <div className="mt-1 text-xs text-slate-500">Defina quem vai ver o curso e qual e a nota minima para conclui-lo.</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {courseVisibilityOptions.map((option) => {
                const active = form.visibility === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, visibility: option.value }))}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      active ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className={`mt-1 text-xs leading-5 ${active ? "text-white/70" : "text-slate-500"}`}>{option.description}</div>
                  </button>
                );
              })}
            </div>
            <FieldGroup label="Nota minima do curso" hint="Percentual minimo para aprovacao final.">
              <input
                type="number"
                value={form.passing_score ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, passing_score: Number(event.target.value) || null }))}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                placeholder="70"
              />
            </FieldGroup>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.required} onChange={(event) => setForm((current) => ({ ...current, required: event.target.checked }))} /> Curso obrigatorio</label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.certificate_enabled} onChange={(event) => setForm((current) => ({ ...current, certificate_enabled: event.target.checked }))} /> Emitir certificado</label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.sequence_required} onChange={(event) => setForm((current) => ({ ...current, sequence_required: event.target.checked }))} /> Exigir ordem das aulas</label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.onboarding_recommended} onChange={(event) => setForm((current) => ({ ...current, onboarding_recommended: event.target.checked }))} /> Destacar no onboarding</label>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Leitura de posicionamento</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              Use esta etapa para decidir como o curso sera percebido: se ele deve ser exigido, se segue uma ordem de consumo e se merece destaque no onboarding.
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Leitura visual antes de publicar</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              Card e banner nao sao decoracao. Eles ajudam o colaborador a entender rapidamente o tema, o tom e a relevancia do treinamento.
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <FileUploader
              bucket="lms-thumbnails"
              label="Imagem do card do curso"
              description="Usada no card do catalogo e nas listagens de treinamento."
              accept="image/*"
              onUploaded={(value) => setForm((current) => ({ ...current, thumbnail_url: value }))}
            />
            <LmsMediaLibrary
              bucket="lms-thumbnails"
              title="Biblioteca de imagens de card"
              description="Escolha uma capa ja enviada para reaproveitar neste curso."
              onSelect={(value) => setForm((current) => ({ ...current, thumbnail_url: value }))}
            />
          </div>
          <div className="space-y-4">
            <FileUploader
              bucket="lms-banners"
              label="Banner do curso"
              description="Imagem ampla usada no topo da pagina do treinamento."
              accept="image/*"
              onUploaded={(value) => setForm((current) => ({ ...current, banner_url: value }))}
            />
            <LmsMediaLibrary
              bucket="lms-banners"
              title="Biblioteca de banners"
              description="Reuse um banner ja publicado em outro treinamento."
              onSelect={(value) => setForm((current) => ({ ...current, banner_url: value }))}
            />
          </div>
        </div>
      </section>
    );
  }

  function renderReviewStep() {
    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-6 text-white shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr,0.7fr]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Momento de aprovar a experiencia</div>
              <h2 className="mt-2 text-2xl font-semibold">Revise o curso como se voce fosse o aluno antes de publicar.</h2>
              <p className="mt-3 text-sm leading-7 text-white/75">
                Esta etapa foi pensada para a ultima checagem: clareza da proposta, trilha coerente, boas midias e criterios de aprovacao prontos.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Status atual</div>
                <div className="mt-2 text-lg font-semibold capitalize">{form.status}</div>
                <div className="text-sm text-white/70">{form.visibility === "publico_interno" ? "Publico interno" : "Restrito"}</div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Estrutura pronta</div>
                <div className="mt-2 text-lg font-semibold">{form.modules.length} fases</div>
                <div className="text-sm text-white/70">{totalLessons} aulas planejadas</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Revisao final antes de salvar</h2>
          <p className="mt-1 text-sm text-slate-500">Confira se o treinamento esta claro, completo e pronto para atribuicao.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Itens prontos</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{completedChecklistCount}</div>
              <div className="text-sm text-slate-500">Pontos ja validados para publicar.</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pendencias</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{pendingChecklistCount}</div>
              <div className="text-sm text-slate-500">Itens que ainda merecem sua atencao.</div>
            </div>
            <div className={`rounded-[22px] border px-4 py-4 ${pendingChecklistCount === 0 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${pendingChecklistCount === 0 ? "text-emerald-700" : "text-amber-700"}`}>Leitura executiva</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">
                {pendingChecklistCount === 0 ? "Curso pronto para publicar com seguranca." : "Ainda vale revisar antes de liberar para o catalogo."}
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {publicationChecklist.map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${item.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {item.done ? "OK" : "!"}
                </span>
                <div className="text-sm text-slate-700">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.58fr,0.42fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Visao executiva da publicacao</h2>
            <p className="mt-1 text-sm text-slate-500">Um resumo rapido para decidir com mais confianca se o curso segue para publicacao ou volta para ajuste.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Curso</div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{form.title || "Sem titulo definido"}</div>
                <div className="mt-1 text-sm text-slate-500">{form.category || "Categoria nao definida"}</div>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Publicacao</div>
                <div className="mt-2 text-sm font-semibold text-slate-950 capitalize">{form.status}</div>
                <div className="mt-1 text-sm text-slate-500">{form.visibility === "publico_interno" ? "Publico interno" : "Restrito"}</div>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estrutura</div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{form.modules.length} fases e {totalLessons} aulas</div>
                <div className="mt-1 text-sm text-slate-500">{form.sequence_required ? "Com ordem de consumo" : "Sem ordem obrigatoria"}</div>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Conclusao</div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{form.certificate_enabled ? "Com certificado" : "Sem certificado"}</div>
                <div className="mt-1 text-sm text-slate-500">Nota minima: {form.passing_score ?? 0}%</div>
              </div>
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Leitura de risco</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {pendingChecklistCount === 0 ? "Nada bloqueia a publicacao agora." : "Ainda existem pontos que podem prejudicar a experiencia."}
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-600">
              {pendingChecklistCount === 0
                ? "Se a proposta estiver alinhada com o objetivo do RH, este treinamento ja pode seguir para o catalogo ou atribuicao."
                : "Se publicar agora, o aluno pode encontrar lacunas de conteudo, midia ou avaliacao. Vale tratar as pendencias antes."}
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
              {pendingChecklistCount === 0
                ? "Recomendacao: publicar ou salvar como publicado, se este curso ja estiver aprovado internamente."
                : "Recomendacao: manter em rascunho e corrigir os itens sinalizados no checklist principal."}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Quando publicar agora</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">Use esta opcao quando a experiencia estiver redonda.</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Publicar faz sentido quando a trilha esta clara, as aulas estao completas e a avaliacao ja foi revisada como se voce fosse o aluno.
            </p>
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700">
              Sinal mais forte: checklist completo, capa definida e jornada coerente do inicio ao fim.
            </div>
          </div>
          <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Quando salvar como rascunho</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">Mantenha em rascunho se ainda houver ajuste critico.</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Se ainda faltar midia, revisar a avaliacao ou organizar melhor as fases, o melhor caminho e salvar e voltar depois sem expor o treinamento cedo demais.
            </p>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-700">
              Sinal mais forte: itens pendentes no checklist, experiencia confusa ou conteudo principal ainda incompleto.
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Checklist por etapa</h2>
          <p className="mt-1 text-sm text-slate-500">Aqui voce revisa identidade, conteudo e publicacao no momento certo, sem poluir as etapas anteriores.</p>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {stepChecklists.map((group) => (
              <div key={group.title} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">{group.title}</div>
                <div className="mt-3 space-y-3">
                  {group.items.map((item) => (
                    <div key={`${group.title}-${item.label}`} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${item.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {item.done ? "OK" : "!"}
                      </span>
                      <div className="text-sm text-slate-700">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {selectedLessonQuizPreview ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-950">Preview real da avaliacao</h2>
              <p className="mt-1 text-sm text-slate-500">Revise o formulario exatamente como o colaborador vai responder antes de publicar.</p>
            </div>
            <QuizPreviewCard payload={selectedLessonQuizPreview} />
          </section>
        ) : null}

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-950">Jornada completa do curso</h2>
            <p className="mt-1 text-sm text-slate-500">Veja a trilha inteira como uma sequencia de fases para validar se o fluxo faz sentido antes de publicar.</p>
          </div>
          <div className="space-y-4">
            {form.modules.map((module, moduleIndex) => (
              <div key={`${module.title}-${moduleIndex}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fase {moduleIndex + 1}</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{module.title || `Modulo ${moduleIndex + 1}`}</div>
                <div className="mt-3 space-y-2">
                  {module.lessons.map((lesson, lessonIndex) => (
                    <div key={`${lesson.title}-${lessonIndex}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{lesson.title || `Aula ${lessonIndex + 1}`}</div>
                        <div className="mt-1 text-xs capitalize text-slate-500">{lesson.lesson_type === "avaliacao" ? "Avaliacao" : lesson.lesson_type}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{lesson.duration_minutes ?? 0} min</span>
                        <span>{lesson.is_required ? "Obrigatoria" : "Opcional"}</span>
                        {lesson.lesson_type === "avaliacao" && lesson.quiz ? (
                          <span>{lesson.quiz.questions.length} pergunta(s)</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="h-44 bg-slate-100">
            {form.banner_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.banner_url} alt={form.title || "Banner"} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">O banner aparecera aqui</div>
            )}
          </div>
          <div className="p-5">
            <div className="flex gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-[22px] bg-slate-100">
                {form.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.thumbnail_url} alt={form.title || "Imagem do card"} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-400"><ImagePlus size={16} /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{form.category || "Treinamento"}</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">{form.title || "Preview do curso"}</h3>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{form.short_description || "O curso ganhara uma apresentacao mais clara e amigavel no catalogo do colaborador."}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] bg-slate-50 px-4 py-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estrutura</div><div className="mt-2 text-lg font-semibold text-slate-950">{form.modules.length} modulos</div><div className="text-sm text-slate-500">{totalLessons} aulas planejadas</div></div>
              <div className="rounded-[22px] bg-slate-50 px-4 py-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</div><div className="mt-2 text-lg font-semibold capitalize text-slate-950">{form.status}</div><div className="text-sm text-slate-500">{form.visibility === "publico_interno" ? "Publico interno" : "Restrito"}</div></div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderPreviewWorkspace(compact = false) {
    return (
      <section className={`space-y-4 rounded-[28px] border border-slate-200 bg-white shadow-sm ${compact ? "p-4" : "p-5"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Eye size={18} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Visao do colaborador</h2>
              <p className="mt-1 text-sm text-slate-500">Use este espaco para validar a experiencia que o aluno realmente vai enxergar.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPreviewExpanded(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Maximize2 size={16} />
            Abrir ampliado
          </button>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap gap-3">
            {previewModes.map((mode) => {
              const active = previewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPreviewMode(mode.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    active ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="text-sm font-semibold">{mode.label}</div>
                  <div className={`mt-1 text-xs ${active ? "text-white/70" : "text-slate-500"}`}>{mode.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {previewMode === "catalog" ? (
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50">
            <CourseHeader detail={previewDetail} />
          </div>
        ) : null}

        {previewMode === "journey" ? (
          <div className="space-y-4 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fases</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{form.modules.length}</div>
                <div className="text-sm text-slate-500">Blocos principais da jornada.</div>
              </div>
              <div className="rounded-[22px] bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aulas</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{totalLessons}</div>
                <div className="text-sm text-slate-500">Etapas que o colaborador vai percorrer.</div>
              </div>
              <div className="rounded-[22px] bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fluxo atual</div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{form.sequence_required ? "Ordem obrigatoria" : "Livre navegacao"}</div>
                <div className="text-sm text-slate-500">Define se a trilha segue sequencia.</div>
              </div>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4">
              <ModuleAccordion
                detail={previewDetail}
                expandedModuleId={previewExpandedModuleId}
                onToggle={setPreviewExpandedModuleId}
              />
            </div>
          </div>
        ) : null}

        {previewMode === "lesson" ? (
          <div className="space-y-4 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Foco da validacao</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">
                {selectedLesson ? `${selectedLesson.title || "Aula atual"} / ${selectedLesson.lesson_type === "avaliacao" ? "Avaliacao" : selectedLesson.lesson_type}` : "Selecione uma aula"}
              </div>
              <div className="mt-1 text-sm text-slate-500">Esse bloco mostra exatamente o conteudo que o aluno consumira na etapa selecionada.</div>
            </div>
            {selectedLesson ? (
              selectedLesson.lesson_type === "avaliacao" && selectedLessonQuizPreview ? (
                <QuizPreviewCard payload={selectedLessonQuizPreview} />
              ) : (
                <LessonPlayer lesson={{ ...previewDetail.modules[selectedModuleIndex].lessons[selectedLessonIndex] }} />
              )
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
                Selecione uma aula na etapa de conteudo para validar como ela ficara para o colaborador.
              </div>
            )}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <PageHelpModal
        open={helpOpen}
        title={currentStepGuide.title}
        subtitle={currentStepGuide.description}
        items={helpModalItems}
        onClose={() => setHelpOpen(false)}
      />
      {previewExpanded ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[28px] border border-white/10 bg-slate-950/85 px-5 py-4 text-white shadow-2xl">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Preview ampliado</div>
                <div className="mt-1 text-lg font-semibold">Valide a experiencia do colaborador sem distracoes do editor</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewExpanded(false)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <X size={16} />
                Fechar preview
              </button>
            </div>
            {renderPreviewWorkspace(true)}
          </div>
        </div>
      ) : null}

      <PageHeader
        icon={<GraduationCap size={24} />}
        title={mode === "create" ? "Criar treinamento" : "Editar treinamento"}
        subtitle="Construa o curso em etapas curtas: identidade, conteudo, publicacao e revisao final."
      />

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        {draftState === "restored"
          ? "Rascunho recuperado automaticamente neste navegador."
          : draftState === "saved"
            ? "Rascunho salvo automaticamente neste navegador."
            : "O editor salva um rascunho local enquanto voce trabalha."}
      </div>

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_52%,#334155_100%)] text-white shadow-sm">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Modo criador de treinamento</div>
            <h2 className="mt-3 text-3xl font-semibold">
              Monte o curso como uma experiencia de aprendizagem, nao como um cadastro.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
              Cada etapa foi reorganizada para voce pensar primeiro em jornada, depois em conteudo e so no final em publicacao.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/75">
              <span className="rounded-full border border-white/15 px-3 py-2">{form.modules.length} fases</span>
              <span className="rounded-full border border-white/15 px-3 py-2">{totalLessons} aulas</span>
              <span className="rounded-full border border-white/15 px-3 py-2">{steps[currentStepIndex]?.title ?? "Etapa"} em andamento</span>
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Visao que o aluno vai ter</div>
                <div className="mt-1 text-sm text-white/70">O preview agora pode ser alternado entre catalogo, trilha e aula ativa.</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewExpanded(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Eye size={16} />
                Abrir preview
              </button>
            </div>
            <div className="mt-4 flex items-start gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-[24px] bg-white/10">
                {form.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.thumbnail_url} alt={form.title || "Capa"} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-white/50">
                    <ImagePlus size={18} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{form.category || "Treinamento"}</div>
                <div className="mt-1 truncate text-xl font-semibold">{form.title || "Seu curso ainda esta ganhando forma"}</div>
                <div className="mt-2 line-clamp-3 text-sm leading-6 text-white/75">
                  {form.short_description || "Assim que voce preencher identidade, estrutura e publicacao, essa experiencia fica pronta para o colaborador."}
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Modo atual</div>
                <div className="mt-1 text-sm font-semibold text-white">{previewModes.find((mode) => mode.id === previewMode)?.label ?? "Catalogo"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Fase em foco</div>
                <div className="mt-1 text-sm font-semibold text-white">{selectedModule?.title || "Defina a estrutura"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Aula em foco</div>
                <div className="mt-1 text-sm font-semibold text-white">{selectedLesson?.title || "Selecione uma aula"}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Assistente de criacao</div>
            <div className="mt-1 text-lg font-semibold text-slate-950">Siga etapa por etapa</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Ajuda desta etapa
            </button>
            <div className="text-sm text-slate-500">{currentStepIndex + 1} de {steps.length}</div>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-slate-900 transition-all" style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {steps.map((step, index) => (
            <StepCard
              key={step.id}
              active={step.id === currentStep}
              completed={index < currentStepIndex}
              index={index}
              title={step.title}
              subtitle={step.subtitle}
              onClick={() => {
                if (index <= currentStepIndex) {
                  setMessage("");
                  setCurrentStep(step.id);
                  return;
                }
                const validationError = validateStep(currentStep);
                if (validationError) {
                  setMessage(validationError);
                  return;
                }
                setMessage("");
                setCurrentStep(step.id);
              }}
            />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{currentStepGuide.eyebrow}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{currentStepGuide.title}</div>
          </div>
          <div className="text-sm text-slate-500">{currentStepGuide.description}</div>
        </div>
      </section>

      <div className="space-y-6">
        {currentStep === "identity" ? renderIdentityStep() : null}
        {currentStep === "structure" ? renderStructureStep() : null}
        {currentStep === "publication" ? renderPublicationStep() : null}
        {currentStep === "review" ? renderReviewStep() : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-1 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">{steps[currentStepIndex]?.title}</div>
            <div>
              {message ? <span className="font-medium text-rose-600">{message}</span> : steps[currentStepIndex]?.subtitle}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={goToPreviousStep}
              disabled={currentStepIndex === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              <ChevronLeft size={16} /> Voltar
            </button>
            {currentStep !== "review" ? (
              <button
                type="button"
                onClick={goToNextStep}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Avancar <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Salvando..." : form.status === "published" ? "Salvar e publicar treinamento" : "Salvar treinamento"}
              </button>
            )}
          </div>
        </div>

        {renderPreviewWorkspace()}
      </div>
    </div>
  );
}
