"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, GraduationCap, ImagePlus, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageShell";
import { FileUploader } from "@/components/lms/FileUploader";
import { coursesService } from "@/lib/lms/coursesService";
import { buildCourseDefaults, slugifyCourseTitle } from "@/lib/lms/utils";
import type { LmsCourseEditorPayload, LmsQuizPayload } from "@/lib/lms/types";

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
    content_text: "<p>Descreva aqui a experiência da aula.</p>",
    duration_minutes: 15,
    sort_order: sortOrder,
    is_required: true,
    allow_preview: false,
  };
}

function createModule(sortOrder: number): LmsCourseEditorPayload["modules"][number] {
  return { title: `Módulo ${sortOrder}`, description: "", sort_order: sortOrder, lessons: [createLesson(1)] };
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
            options: question.options.map((option) => ({ id: option.id, text: option.text, is_correct: option.is_correct })),
          })),
        }
      : null,
  });

  const selectedModule = form.modules[selectedModuleIndex] ?? form.modules[0];
  const selectedLesson = selectedModule?.lessons[selectedLessonIndex] ?? selectedModule?.lessons[0];
  const totalLessons = useMemo(() => form.modules.reduce((sum, module) => sum + module.lessons.length, 0), [form.modules]);

  function patchModule(index: number, updater: (value: LmsCourseEditorPayload["modules"][number]) => LmsCourseEditorPayload["modules"][number]) {
    setForm((current) => ({ ...current, modules: current.modules.map((module, moduleIndex) => (moduleIndex === index ? updater(module) : module)) }));
  }

  function patchLesson(moduleIndex: number, lessonIndex: number, updater: (value: LmsCourseEditorPayload["modules"][number]["lessons"][number]) => LmsCourseEditorPayload["modules"][number]["lessons"][number]) {
    patchModule(moduleIndex, (module) => ({ ...module, lessons: module.lessons.map((lesson, index) => (index === lessonIndex ? updater(lesson) : lesson)) }));
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
      <PageHeader icon={<GraduationCap size={24} />} title={mode === "create" ? "Criar treinamento" : "Editar treinamento"} subtitle="Monte um curso com capa, banner, módulos, aulas multimídia e regras de publicação." />

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Identidade do curso</h2>
            <p className="mt-1 text-sm text-slate-500">Crie um treinamento com cara de produto: promessa clara, imagens fortes e resumo orientado a benefício.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, slug: !current.slug || current.slug === slugifyCourseTitle(current.title) ? slugifyCourseTitle(event.target.value) : current.slug }))} placeholder="Título do treinamento" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
              <input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="slug-do-curso" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
              <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Categoria" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
              <input type="number" value={form.workload_hours ?? ""} onChange={(event) => setForm((current) => ({ ...current, workload_hours: Number(event.target.value) || null }))} placeholder="Carga horária" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
            </div>
            <div className="mt-4 grid gap-4">
              <textarea value={form.short_description} onChange={(event) => setForm((current) => ({ ...current, short_description: event.target.value }))} placeholder="Resumo curto do treinamento" className="min-h-[100px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
              <textarea value={form.full_description} onChange={(event) => setForm((current) => ({ ...current, full_description: event.target.value }))} placeholder="Descrição completa, objetivos e resultados esperados" className="min-h-[180px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Publicação e mídia</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as typeof current.status }))} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900">
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select>
              <select value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as typeof current.visibility }))} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900">
                <option value="publico_interno">Público interno</option>
                <option value="restrito">Restrito</option>
              </select>
              <input type="number" value={form.passing_score ?? ""} onChange={(event) => setForm((current) => ({ ...current, passing_score: Number(event.target.value) || null }))} placeholder="Nota mínima" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.required} onChange={(event) => setForm((current) => ({ ...current, required: event.target.checked }))} /> Obrigatório</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.certificate_enabled} onChange={(event) => setForm((current) => ({ ...current, certificate_enabled: event.target.checked }))} /> Certificado</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.sequence_required} onChange={(event) => setForm((current) => ({ ...current, sequence_required: event.target.checked }))} /> Sequência obrigatória</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.onboarding_recommended} onChange={(event) => setForm((current) => ({ ...current, onboarding_recommended: event.target.checked }))} /> Destaque onboarding</label>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <FileUploader bucket="lms-thumbnails" label="Thumbnail do curso" accept="image/*" onUploaded={(value) => setForm((current) => ({ ...current, thumbnail_url: value }))} />
              <FileUploader bucket="lms-banners" label="Banner do curso" accept="image/*" onUploaded={(value) => setForm((current) => ({ ...current, banner_url: value }))} />
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Currículo em fases</h2>
                <p className="mt-1 text-sm text-slate-500">{form.modules.length} módulos · {totalLessons} aulas. Organize a trilha em etapas curtas e claras.</p>
              </div>
              <button type="button" onClick={() => { setForm((current) => ({ ...current, modules: [...current.modules, createModule(current.modules.length + 1)] })); setSelectedModuleIndex(form.modules.length); setSelectedLessonIndex(0); }} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><Plus size={16} /> Novo módulo</button>
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
                              <div className={`text-xs ${lessonIndex === selectedLessonIndex ? "text-white/70" : "text-slate-500"}`}>{lesson.lesson_type}</div>
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
                  <div className="grid gap-4 md:grid-cols-2">
                    <input value={selectedModule.title} onChange={(event) => patchModule(selectedModuleIndex, (module) => ({ ...module, title: event.target.value }))} placeholder="Título do módulo" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
                    <input value={selectedLesson.title} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, title: event.target.value }))} placeholder="Título da aula" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <select value={selectedLesson.lesson_type} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, lesson_type: event.target.value as typeof lesson.lesson_type }))} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900">
                      <option value="texto">Texto</option>
                      <option value="video">Vídeo</option>
                      <option value="pdf">PDF</option>
                      <option value="arquivo">Arquivo</option>
                      <option value="link">Link</option>
                      <option value="avaliacao">Avaliação</option>
                    </select>
                    <input type="number" value={selectedLesson.duration_minutes ?? ""} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, duration_minutes: Number(event.target.value) || null }))} placeholder="Duração" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
                    <input value={selectedLesson.content_url} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: event.target.value }))} placeholder="URL do conteúdo" className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900" />
                  </div>
                  <textarea value={selectedLesson.description} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, description: event.target.value }))} placeholder="Descrição da aula" className="min-h-[80px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
                  <textarea value={selectedLesson.content_text} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_text: event.target.value }))} placeholder="Conteúdo textual / roteiro / instruções" className="min-h-[180px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
                  <div className="grid gap-4 xl:grid-cols-[1fr,0.8fr]">
                    <FileUploader bucket={selectedLesson.lesson_type === "video" ? "lms-videos" : "lms-materials"} label={`Upload da aula (${selectedLesson.lesson_type})`} accept={selectedLesson.lesson_type === "video" ? "video/*" : ".pdf,.doc,.docx,.ppt,.pptx,image/*"} onUploaded={(value) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, content_url: value }))} />
                    <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white"><Eye size={18} /></span><div><div className="text-sm font-semibold text-slate-900">Regras da aula</div><div className="text-xs text-slate-500">Controle acesso e sequência.</div></div></div>
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={selectedLesson.is_required} onChange={(event) => patchLesson(selectedModuleIndex, selectedLessonIndex, (lesson) => ({ ...lesson, is_required: event.target.checked }))} /> Aula obrigatória</label>
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
                <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">O banner aparecerá aqui</div>
              )}
            </div>
            <div className="p-5">
              <div className="flex gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-[22px] bg-slate-100">
                  {form.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.thumbnail_url} alt={form.title || "Thumbnail"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-400"><ImagePlus size={16} /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{form.category || "Treinamento"}</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">{form.title || "Preview do curso"}</h3>
                  <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{form.short_description || "O curso ganhará uma apresentação mais editorial e amigável no catálogo do colaborador."}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] bg-slate-50 px-4 py-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estrutura</div><div className="mt-2 text-lg font-semibold text-slate-950">{form.modules.length} módulos</div><div className="text-sm text-slate-500">{totalLessons} aulas planejadas</div></div>
                <div className="rounded-[22px] bg-slate-50 px-4 py-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</div><div className="mt-2 text-lg font-semibold text-slate-950">{form.status}</div><div className="text-sm text-slate-500">{form.visibility}</div></div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
