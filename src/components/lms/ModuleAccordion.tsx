"use client";

import Link from "next/link";
import { ChevronDown, Lock, PlayCircle } from "lucide-react";
import type { LmsCourseDetail } from "@/lib/lms/types";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ModuleAccordion({
  detail,
  expandedModuleId,
  onToggle,
  completedLessonIds,
  isLessonLocked,
  currentLessonId,
  lessonHrefBuilder,
}: {
  detail: LmsCourseDetail;
  expandedModuleId: string | null;
  onToggle: (moduleId: string) => void;
  completedLessonIds?: Set<string>;
  isLessonLocked?: (lessonId: string) => boolean;
  currentLessonId?: string | null;
  lessonHrefBuilder?: (lessonId: string) => string;
}) {
  return (
    <div className="space-y-4">
      {detail.modules.map((module) => {
        const open = expandedModuleId === module.id;
        const moduleTotal = module.lessons.length;
        const moduleCompleted = module.lessons.filter((lesson) => completedLessonIds?.has(lesson.id)).length;
        return (
          <div key={module.id} className="overflow-hidden rounded-[28px] border border-slate-800 bg-[#171717] text-white shadow-sm">
            <button type="button" className="flex w-full items-center justify-between px-5 py-5 text-left" onClick={() => onToggle(module.id)}>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Fase {module.sort_order}</div>
                <h3 className="mt-1 text-xl font-semibold text-white">{module.title}</h3>
                {module.description ? <p className="mt-1 text-sm text-white/60">{module.description}</p> : null}
              </div>
              <div className="flex items-center gap-4">
                <span className="rounded-full bg-white/5 px-3 py-1 text-sm text-white/60">{moduleCompleted}/{moduleTotal}</span>
                <ChevronDown size={18} className={cx("transition-transform text-white/70", open && "rotate-180")} />
              </div>
            </button>
            {open ? (
              <div className="border-t border-slate-800 px-5 py-4">
                <div className="space-y-3">
                  {module.lessons.map((lesson) => {
                    const locked = isLessonLocked?.(lesson.id) ?? false;
                    const selected = currentLessonId === lesson.id;
                    const completed = completedLessonIds?.has(lesson.id);
                    const className = cx(
                      "flex items-center justify-between rounded-2xl border px-4 py-4",
                      selected ? "border-white/15 bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]" : "border-slate-800 bg-transparent",
                      lessonHrefBuilder && !locked && "transition hover:border-white/15 hover:bg-white/5",
                    );

                    const content = (
                      <>
                        <div className="flex items-start gap-3">
                          <span
                            className={cx(
                              "mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold",
                              selected ? "border-white/20 bg-white/10 text-white" : "border-slate-700 text-white/55",
                            )}
                          >
                            {completed ? "✓" : module.lessons.findIndex((item) => item.id === lesson.id) + 1}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-white">{lesson.title}</div>
                            <div className="mt-1 text-xs capitalize text-white/50">
                              {lesson.lesson_type} • {lesson.duration_minutes ?? 0} min
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {selected ? <PlayCircle size={16} className="text-white/75" /> : null}
                          {completed ? (
                            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">Concluida</span>
                          ) : null}
                          {locked ? <Lock size={16} className="text-white/35" /> : null}
                        </div>
                      </>
                    );

                    if (lessonHrefBuilder && !locked) {
                      return (
                        <Link key={lesson.id} href={lessonHrefBuilder(lesson.id)} className={className}>
                          {content}
                        </Link>
                      );
                    }

                    return (
                      <div key={lesson.id} className={className}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
