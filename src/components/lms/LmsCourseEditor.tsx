"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, GraduationCap, ImagePlus, Plus, Trash2 } from "lucide-react";
import { FileUploader } from "@/components/lms/FileUploader";
import { PageHeader } from "@/components/ui/PageShell";
import { coursesService } from "@/lib/lms/coursesService";
import type { LmsCourseEditorPayload, LmsQuizPayload } from "@/lib/lms/types";
import { buildCourseDefaults, slugifyCourseTitle } from "@/lib/lms/utils";

type EditorData = {
  course?: Record<string, unknown>;
  modules?: Array<Record<string, unknown>>;
  quiz?: LmsQuizPayload | null;
};

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
  const [selectedModuleIndex, setSelectedModuleIndex] = useState(0);
  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  const [form, setForm] = useState<LmsCourseEditorPayload>({
    ...buildCourseDefaults(),
    ...(initialData?.course ?? {}),
    modules:
      (initialData?.modules as LmsCourseEditorPayload["modules"] | undefined)?.length
        ? ((initialData?.modules as LmsCourseEditorPayload["modules"]) ?? [])
        : [createModule(1)],
    quiz: initialData?.quiz
      ? {
          id: initialData.quiz.quiz.id,
          title: initialData.quiz.quiz.title,
          passing_score: initialData.quiz.quiz.passing_score,
          max_attempts: initialData.quiz.quiz.max_attempts,
          randomize_questions: initialData.quiz.quiz.randomize_questions,
          questions: initialData.quiz.questions.map((question) => ({
            id: question.id,
            statement: question.statement,
            question_type: question.question_type,
            sort_order: question.sort_order,
            options: question.options.map((option) => ({
              id: option.id,
              text: option.text,
              is_correct: option.is_correct,
            })),
          })),
        }
      : null,
  });

  const selectedModule = form.modules[selectedModuleIndex] ?? form.modules[0];
  const selectedLesson = selectedModule?.lessons[selectedLessonIndex] ?? selectedModule?.lessons[0];
  const totalLessons = useMemo(
    () => form.modules.reduce((sum, module) => sum + module.lessons.length, 0),
    [form.modules],
  );

  function patchModule(
    index: number,
    updater: (value: LmsCourseEditorPayload["modules"][number]) => LmsCourseEditorPayload["modules"][number],
  ) {
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

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      await coursesService.save(courseId, form);
      router.push("/rh/lms/cursos");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar curso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<GraduationCap size={24} />}
        title={mode === "create" ? "Criar treinamento" : "Editar treinamento"}
        subtitle="Monte um curso com capa, banner, modulos, aulas multimidia e regras de publicacao."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Identidade do curso</h2>
            <p className="mt-1 text-sm text-slate-500">
              Defina as informacoes principais que vao aparecer no catalogo e na pagina do treinamento.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <FieldGroup
                label="Titulo do treinamento"
                hint="Nome principal exibido para RH, gestores e colaboradores."
              >
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

              <FieldGroup
                label="Endereco do curso"
                hint="Identificador usado na URL. Normalmente fica em minusculas e com hifens."
              >
                <input
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                  placeholder="Ex.: onboarding-portal-rh"
                  className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                />
              </FieldGroup>

              <FieldGroup
                label="Categoria"
                hint="Agrupa cursos parecidos no catalogo."
              >
                <input
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  placeholder="Ex.: Onboarding, Compliance, Lideranca"
                  className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                />
              </FieldGroup>

              <FieldGroup
                label="Carga horaria"
                hint="Quantidade total de horas previstas para concluir o treinamento."
              >
                <input
                  type="number"
                  value={form.workload_hours ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, workload_hours: Number(event.target.value) || null }))
                  }
                  placeholder="Ex.: 4"
                  className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                />
              </FieldGroup>
            </div>

            <div className="mt-4 grid gap-4">
              <FieldGroup
                label="Resumo curto"
                hint="Texto breve para o card e para a apresentacao inicial do curso."
              >
                <textarea
                  value={form.short_description}
                  onChange={(event) => setForm((current) => ({ ...current, short_description: event.target.value }))}
                  placeholder="Explique rapidamente o objetivo e o ganho esperado."
                  className="min-h-[100px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                />
              </FieldGroup>

              <FieldGroup
                label="Descricao completa"
                hint="Detalhe objetivos, publico, resultados esperados e qualquer contexto importante."
              >
                <textarea
                  value={form.full_description}
                  onChange={(event) => setForm((current) => ({ ...current, full_description: event.target.value }))}
                  placeholder="Descreva em mais detalhes o treinamento, suas etapas e os resultados esperados."
                  className="min-h-[180px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                />
              </FieldGroup>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Publicacao e midia</h2>
            <p className="mt-1 text-sm text-slate-500">
              Defina como o treinamento sera exibido, quem pode acessa-lo e quais imagens vao representa-lo.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <FieldGroup label="Status do curso" hint="Rascunho nao aparece para o colaborador. Publicado pode ser atribuido.">
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as typeof current.status }))
                  }
                  className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                >
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicado</option>
                  <option value="archived">Arquivado</option>
                </select>
              </FieldGroup>

              <FieldGroup label="Quem pode ver" hint="Controle se o curso fica visivel no catalogo interno ou apenas em contextos restritos.">
                <select
                  value={form.visibility}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      visibility: event.target.value as typeof current.visibility,
                    }))
                  }
                  className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                >
                  <option value="publico_interno">Publico interno</option>
                  <option value="restrito">Restrito</option>
                </select>
              </FieldGroup>

              <FieldGroup label="Nota minima para aprovacao" hint="Percentual minimo para o colaborador ser aprovado nas avaliacoes do curso.">
                <input
                  type="number"
                  value={form.passing_score ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, passing_score: Number(event.target.value) || null }))
                  }
                  placeholder="Ex.: 70"
                  className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                />
              </FieldGroup>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.required} onChange={(event) => setForm((current) => ({ ...current, required: event.target.checked }))} /> Curso obrigatorio</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.certificate_enabled} onChange={(event) => setForm((current) => ({ ...current, certificate_enabled: event.target.checked }))} /> Emitir certificado</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.sequence_required} onChange={(event) => setForm((current) => ({ ...current, sequence_required: event.target.checked }))} /> Exigir ordem das aulas</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.onboarding_recommended} onChange={(event) => setForm((current) => ({ ...current, onboarding_recommended: event.target.checked }))} /> Destacar no onboarding</label>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <FileUploader
                bucket="lms-thumbnails"
                label="Imagem do card do curso"
                description="Usada no card do catalogo e nas listagens de treinamentos."
                accept="image/*"
                onUploaded={(value) => setForm((current) => ({ ...current, thumbnail_url: value }))}
              />
              <FileUploader
                bucket="lms-banners"
                label="Banner do curso"
                description="Imagem ampla para o topo da pagina do treinamento."
                accept="image/*"
                onUploaded={(value) => setForm((current) => ({ ...current, banner_url: value }))}
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Curriculo em fases</h2>
                <p className="mt-1 text-sm text-slate-500">{form.modules.length} modulos - {totalLessons} aulas. Organize a trilha em etapas curtas e claras.</p>
              </div>
              <button type="button" onClick={() => { setForm((current) => ({ ...current, modules: [...current.modules, createModule(current.modules.length + 1)] })); setSelectedModuleIndex(form.modules.length); setSelectedLessonIndex(0); }} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><Plus size={16} /> Novo modulo</button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[0.42fr,0.58fr]">
              <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                {form.modules.map((module, moduleIndex) => (
                  <div key={`${module.title}-${moduleIndex}`} className={`rounded-[22px] border px-4 py-4 ${moduleIndex === selectedModuleIndex ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => { setSelectedModuleIndex(moduleIndex); setSelectedLessonIndex(0); }} className="min-w-0 text-left">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fase {moduleIndex + 1}</div>
                        <div className="mt-1 truncate text-sm font-semibold text-slate-950">{module.title}</div>
                      </button>
                      <button type="button" onClick={() => { setForm((current) => { const modules = current.modules.filter((_, index) => index !== moduleIndex).map((item, index) => ({ ...item, sort_order: index + 1 })); return { ...current, modules: modules.length ? modules : [createModule(1)] }; }); setSelectedModuleIndex(0); setSelectedLessonIndex(0); }} className="rounded-xl border border-slate-200 p-2 text-slate-500"><Trash2 size={14} /></button>
                    </div>
                    {moduleIndex === selectedModuleIndex ? (
                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                        {module.lessons.map((lesson, lessonIndex) => (
                          <button key={`${lesson.title}-${lessonIndex}`} type="button" onClick={() => setSelectedLessonIndex(lessonIndex)} className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left ${lessonIndex === selectedLessonIndex ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700"}`}>
                            <div>
                              <div className="text-sm font-semibold">{lesson.title}</div>
                              <div className={`text-xs capitalize ${lessonIndex === selectedLessonIndex ? "text-white/70" : "text-slate-500"}`}>{lesson.lesson_type}</div>
                            </div>
                            <span className={`text-xs font-semibold ${lessonIndex === selectedLessonIndex ? "text-white/70" : "text-slate-500"}`}>{lesson.duration_minutes ?? 0} min</span>
                          </button>
                        ))}
                        <button type="button" onClick={() => { const next = form.modules[moduleIndex].lessons.length + 1; patchModule(moduleIndex, (current) => ({ ...current, lessons: [...current.lessons, createLesson(next)] })); setSelectedLessonIndex(form.modules[moduleIndex].lessons.length); }} className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"><Plus size={16} /> Adicionar aula</button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {selectedModule && selectedLesson ? (
                <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Editando aula</div><div className="mt-1 text-lg font-semibold text-slate-950">{selectedLesson.title || "Nova aula"}</div></div>
                    <button type="button" onClick={() => { patchModule(selectedModuleIndex, (current) => { const lessons = current.lessons.filter((_, index) => index !== selectedLessonIndex).map((lesson, index) => ({ ...lesson, sort_order: index + 1 })); return { ...current, lessons: lessons.length ? lessons : [createLesson(1)] }; }); setSelectedLessonIndex(0); }} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Remover aula</button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <div className="font-semibold text-slate-900">Como preencher esta area</div>
                    <div className="mt-1">Informe em qual modulo a aula fica, o tipo de conteudo, o tempo estimado e os materiais que o colaborador vai consumir.</div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldGroup label="Modulo da aula" hint="Agrupamento em que esta aula vai aparecer.">
                      <input value={selectedModule.title} onChange={(event) => patchModule(selectedModuleIndex, (module) => ({ ...module, title: event.target.value }))} placeholder="Ex.: Boas-vindas e cultura" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
                    </FieldGroup>
                    <FieldGroup label="Titulo da aula" hint="Nome que o colaborador vai enxergar na trilha.">
                      <input value={selectedLesson.title} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, title: event.target.value }))} placeholder="Ex.: Conhecendo o portal" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
                    </FieldGroup>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <FieldGroup label="Tipo de conteudo" hint="Escolha como o colaborador vai consumir a aula.">
                      <select value={selectedLesson.lesson_type} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, lesson_type: event.target.value as typeof lesson.lesson_type }))} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900">
                        <option value="texto">Texto</option>
                        <option value="video">Video</option>
                        <option value="pdf">PDF</option>
                        <option value="arquivo">Arquivo</option>
                        <option value="link">Link</option>
                        <option value="avaliacao">Avaliacao</option>
                      </select>
                    </FieldGroup>
                    <FieldGroup label="Duracao estimada" hint="Tempo medio, em minutos, para concluir a aula.">
                      <input type="number" value={selectedLesson.duration_minutes ?? ""} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, duration_minutes: Number(event.target.value) || null }))} placeholder="Ex.: 15" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
                    </FieldGroup>
                    <FieldGroup label="Link do conteudo" hint="Use para video externo, pagina, link do PDF ou material hospedado fora do portal.">
                      <input value={selectedLesson.content_url} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: event.target.value }))} placeholder="Cole aqui a URL do conteudo" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
                    </FieldGroup>
                  </div>

                  <div className="grid gap-4">
                    <FieldGroup label="Descricao da aula" hint="Explique rapidamente o que sera visto nesta etapa.">
                      <textarea value={selectedLesson.description} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, description: event.target.value }))} placeholder="Resumo da aula, objetivo e orientacoes principais." className="min-h-[96px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
                    </FieldGroup>
                    <FieldGroup label="Conteudo textual ou roteiro" hint="Use para aulas em texto, instrucoes detalhadas, observacoes ou apoio ao video.">
                      <textarea value={selectedLesson.content_text} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_text: event.target.value }))} placeholder="Escreva aqui o conteudo da aula, o roteiro do video ou as instrucoes de apoio." className="min-h-[180px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
                    </FieldGroup>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1fr,0.8fr]">
                    <FileUploader bucket={selectedLesson.lesson_type === "video" ? "lms-videos" : "lms-materials"} label="Arquivo principal da aula" description={selectedLesson.lesson_type === "video" ? "Envie o video quando o conteudo estiver hospedado no portal." : "Envie PDF, imagem, documento ou material complementar para esta aula."} accept={selectedLesson.lesson_type === "video" ? "video/*" : ".pdf,.doc,.docx,.ppt,.pptx,image/*"} onUploaded={(value) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: value }))} />
                    <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white"><Eye size={18} /></span><div><div className="text-sm font-semibold text-slate-900">Regras da aula</div><div className="text-xs text-slate-500">Defina se ela e obrigatoria e se pode aparecer como previa.</div></div></div>
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={selectedLesson.is_required} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, is_required: event.target.checked }))} /> Aula obrigatoria</label>
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={selectedLesson.allow_preview} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, allow_preview: event.target.checked }))} /> Liberar preview</label>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Salvando..." : "Salvar treinamento"}</button>
            {message ? <span className="text-sm text-rose-600">{message}</span> : null}
          </div>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
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
      </div>
    </div>
  );
}
