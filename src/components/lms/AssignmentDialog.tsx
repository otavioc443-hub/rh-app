"use client";

import { useState } from "react";
import { useAssignments } from "@/hooks/lms/useAssignments";
import type { LmsAssignmentFormValues, LmsAssignmentSupportData } from "@/lib/lms/types";

export function AssignmentDialog({ supportData }: { supportData: LmsAssignmentSupportData }) {
  const { saving, createAssignment } = useAssignments();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState<LmsAssignmentFormValues>({
    assignment_type: "user",
    target_id: supportData.users[0]?.id ?? "",
    course_id: supportData.courses[0]?.id ?? "",
    learning_path_id: "",
    due_date: "",
    mandatory: true,
    expires_at: "",
    recurring_every_days: "",
    auto_reassign_on_expiry: false,
  });

  async function handleSubmit() {
    try {
      await createAssignment(payload);
      setMessage("Atribuicao registrada.");
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar atribuicao.");
    }
  }

  const targetOptions =
    payload.assignment_type === "department"
      ? supportData.departments
      : payload.assignment_type === "company"
        ? supportData.companies
        : payload.assignment_type === "role"
          ? supportData.roles
          : supportData.users;

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
        Nova atribuicao
      </button>
      {message ? <div className="text-sm text-slate-600">{message}</div> : null}
      {open ? (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Destino da atribuicao</div>
              <h3 className="mt-2 text-base font-semibold text-slate-950">Quem deve receber este treinamento</h3>
              <p className="mt-1 text-sm text-slate-600">Escolha se a atribuicao sera individual, por area, empresa ou perfil.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select value={payload.assignment_type} onChange={(event) => setPayload((current) => ({ ...current, assignment_type: event.target.value as typeof current.assignment_type, target_id: "" }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
                  <option value="user">Usuario</option>
                  <option value="department">Departamento</option>
                  <option value="company">Empresa</option>
                  <option value="role">Cargo/Perfil</option>
                </select>
                <select value={payload.target_id} onChange={(event) => setPayload((current) => ({ ...current, target_id: event.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
                  <option value="">Selecione o destino</option>
                  {targetOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Conteudo atribuido</div>
              <h3 className="mt-2 text-base font-semibold text-slate-950">Curso principal e trilha complementar</h3>
              <p className="mt-1 text-sm text-slate-600">Voce pode atribuir apenas o curso ou combinar com uma trilha para ampliar a jornada.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select value={payload.course_id} onChange={(event) => setPayload((current) => ({ ...current, course_id: event.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
                  <option value="">Selecione o curso</option>
                  {supportData.courses.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select value={payload.learning_path_id} onChange={(event) => setPayload((current) => ({ ...current, learning_path_id: event.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
                  <option value="">Trilha complementar opcional</option>
                  {supportData.learningPaths.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr,1fr,0.8fr]">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Prazos e validade</div>
              <div className="mt-1 text-sm text-slate-600">Defina quando a pessoa precisa concluir e ate quando a atribuicao fica ativa.</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input type="date" value={payload.due_date} onChange={(event) => setPayload((current) => ({ ...current, due_date: event.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900" />
                <input type="date" value={payload.expires_at} onChange={(event) => setPayload((current) => ({ ...current, expires_at: event.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900" />
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Recorrencia</div>
              <div className="mt-1 text-sm text-slate-600">Use quando o treinamento precisa voltar a ser cobrado em ciclos regulares.</div>
              <div className="mt-4 space-y-3">
                <input
                  type="number"
                  value={payload.recurring_every_days}
                  onChange={(event) => setPayload((current) => ({ ...current, recurring_every_days: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  placeholder="Ex.: repetir a cada 180 dias"
                />
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={payload.auto_reassign_on_expiry}
                    onChange={(event) => setPayload((current) => ({ ...current, auto_reassign_on_expiry: event.target.checked }))}
                  />
                  Reatribuir automaticamente ao vencer
                </label>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Regras da entrega</div>
              <div className="mt-1 text-sm text-slate-600">Defina se esse treinamento entra como obrigatorio na jornada da pessoa.</div>
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" checked={payload.mandatory} onChange={(event) => setPayload((current) => ({ ...current, mandatory: event.target.checked }))} />
                  Tornar obrigatorio para este publico
                </label>
                <button type="button" onClick={() => void handleSubmit()} disabled={saving} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                  {saving ? "Salvando..." : "Salvar atribuicao"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
