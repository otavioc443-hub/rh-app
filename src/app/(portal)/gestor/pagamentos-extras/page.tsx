"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Role = "colaborador" | "coordenador" | "gestor" | "rh" | "admin";

type Project = { id: string; name: string; owner_user_id: string; created_at: string };
type ProjectMember = { id: string; project_id: string; user_id: string; member_role: "gestor" | "coordenador" | "colaborador" };
type Profile = { id: string; full_name: string | null; email: string | null };

type ExtraPayment = {
  id: string;
  project_id: string;
  user_id: string;
  amount: number;
  reference_month: string;
  description: string | null;
  status: "pending" | "approved" | "rejected" | "paid";
  requested_by: string;
  finance_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

type Attachment = {
  id: string;
  payment_id: string;
  file_path: string;
  file_name: string | null;
  created_at: string;
};

function monthToDateFirstDay(v: string) {
  // input type="month" -> YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(v)) return "";
  return `${v}-01`;
}

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function GestorPagamentosExtrasPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [meId, setMeId] = useState("");
  const [isAllowed, setIsAllowed] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [requests, setRequests] = useState<ExtraPayment[]>([]);
  const [attachmentsByPaymentId, setAttachmentsByPaymentId] = useState<Record<string, Attachment[]>>({});
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const [targetUserId, setTargetUserId] = useState("");
  const [refMonth, setRefMonth] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const projectMembers = useMemo(() => members.filter((m) => m.project_id === selectedProjectId), [members, selectedProjectId]);
  const memberOptions = useMemo(
    () => projectMembers.filter((m) => m.member_role === "colaborador" || m.member_role === "coordenador"),
    [projectMembers],
  );

  const personLabel = (userId: string) => {
    const p = profilesById[userId];
    const name = (p?.full_name ?? "").trim();
    if (name && !name.includes("@")) return name;
    const email = (p?.email ?? "").trim();
    if (email) return email;
    return "Colaborador sem nome";
  };

  async function loadAll() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Não autenticado.");
      const userId = authData.user.id;
      setMeId(userId);

      let effectiveRole: Role | null = null;
      try {
        const { data: cr, error: crErr } = await supabase.rpc("current_role");
        if (!crErr) effectiveRole = (cr as Role) ?? null;
      } catch {
        // ignore
      }

      const allowed = effectiveRole === "gestor" || effectiveRole === "admin";
      setIsAllowed(allowed);
      if (!allowed) {
        setProjects([]);
        setMembers([]);
        setProfilesById({});
        setSelectedProjectId("");
        setRequests([]);
        return;
      }

      let projectIds: string[] = [];
      if (effectiveRole === "admin") {
        const allRes = await supabase.from("projects").select("id,name,owner_user_id,created_at").order("created_at", { ascending: false });
        if (allRes.error) throw new Error(allRes.error.message);
        projectIds = ((allRes.data ?? []) as Project[]).map((p) => p.id);
      } else {
        const [ownedRes, memberRes] = await Promise.all([
          supabase.from("projects").select("id,name,owner_user_id,created_at").eq("owner_user_id", userId).order("created_at", { ascending: false }),
          supabase.from("project_members").select("id,project_id,user_id,member_role").eq("user_id", userId).eq("member_role", "gestor"),
        ]);
        if (ownedRes.error) throw new Error(ownedRes.error.message);
        if (memberRes.error) throw new Error(memberRes.error.message);
        const owned = (ownedRes.data ?? []) as Project[];
        const mem = (memberRes.data ?? []) as ProjectMember[];
        projectIds = Array.from(new Set([...owned.map((p) => p.id), ...mem.map((m) => m.project_id)]));
      }

      if (!projectIds.length) {
        setProjects([]);
        setMembers([]);
        setProfilesById({});
        setSelectedProjectId("");
        setRequests([]);
        return;
      }

      const [projRes, memRes] = await Promise.all([
        supabase.from("projects").select("id,name,owner_user_id,created_at").in("id", projectIds).order("created_at", { ascending: false }),
        supabase.from("project_members").select("id,project_id,user_id,member_role").in("project_id", projectIds),
      ]);
      if (projRes.error) throw new Error(projRes.error.message);
      if (memRes.error) throw new Error(memRes.error.message);

      const nextProjects = (projRes.data ?? []) as Project[];
      const nextMembers = (memRes.data ?? []) as ProjectMember[];
      setProjects(nextProjects);
      setMembers(nextMembers);
      setSelectedProjectId((prev) => (prev && nextProjects.some((p) => p.id === prev) ? prev : nextProjects[0]?.id ?? ""));

      const userIds = Array.from(new Set(nextMembers.map((m) => m.user_id)));
      if (userIds.length) {
        const profRes = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
        if (profRes.error) throw new Error(profRes.error.message);
        const map: Record<string, Profile> = {};
        for (const p of (profRes.data ?? []) as Profile[]) map[p.id] = p;
        setProfilesById(map);
      } else {
        setProfilesById({});
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRequests(projectId: string) {
    if (!projectId) {
      setRequests([]);
      setAttachmentsByPaymentId({});
      return;
    }
    const r = await supabase
      .from("project_extra_payments")
      .select("id,project_id,user_id,amount,reference_month,description,status,requested_by,finance_note,decided_by,decided_at,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (r.error) {
      setMsg(r.error.message);
      setRequests([]);
      setAttachmentsByPaymentId({});
      return;
    }
    const list = (r.data ?? []) as ExtraPayment[];
    setRequests(list);

    // Anexos (se a tabela ainda nao existir, nao bloqueia a tela)
    try {
      const ids = list.map((x) => x.id);
      if (!ids.length) {
        setAttachmentsByPaymentId({});
        return;
      }
      const a = await supabase
        .from("project_extra_payment_attachments")
        .select("id,payment_id,file_path,file_name,created_at")
        .in("payment_id", ids)
        .order("created_at", { ascending: false });
      if (a.error) throw a.error;
      const map: Record<string, Attachment[]> = {};
      for (const row of (a.data ?? []) as Attachment[]) {
        (map[row.payment_id] ??= []).push(row);
      }
      setAttachmentsByPaymentId(map);
    } catch {
      setAttachmentsByPaymentId({});
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    void loadRequests(selectedProjectId);
  }, [selectedProjectId]);

  async function submitRequest() {
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
    if (!targetUserId) return setMsg("Selecione um colaborador.");
    const ref = monthToDateFirstDay(refMonth);
    if (!ref) return setMsg("Selecione o mês de referência.");
    const n = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return setMsg("Informe um valor válido.");

    setSaving(true);
    setMsg("");
    try {
      const payload = {
        project_id: selectedProjectId,
        user_id: targetUserId,
        amount: n,
        reference_month: ref,
        description: description.trim() || null,
        requested_by: meId,
      };
      const r = await supabase.from("project_extra_payments").insert(payload);
      if (r.error) throw r.error;

      setTargetUserId("");
      setRefMonth("");
      setAmount("");
      setDescription("");
      await loadRequests(selectedProjectId);
      setMsg("Solicitação enviada ao Financeiro (RH/Admin).");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar solicitação.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelRequest(req: ExtraPayment) {
    if (req.status !== "pending") return;
    if (req.requested_by !== meId) return;
    if (!confirm("Cancelar esta solicitação pendente?")) return;
    setMsg("");
    const r = await supabase.from("project_extra_payments").delete().eq("id", req.id);
    if (r.error) setMsg(r.error.message);
    else await loadRequests(selectedProjectId);
  }

  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) ?? null, [projects, selectedProjectId]);

  async function uploadAttachment(paymentId: string, file: File) {
    setMsg("");
    setUploadingFor(paymentId);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;

      const fd = new FormData();
      fd.append("payment_id", paymentId);
      fd.append("file", file);

      const res = await fetch("/api/extra-payments/attachments/upload", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });

      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || `Erro no upload (status ${res.status})`);

      await loadRequests(selectedProjectId);
      setMsg("Anexo enviado.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar anexo.");
    } finally {
      setUploadingFor(null);
    }
  }

  async function openAttachment(attachmentId: string) {
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;

      const res = await fetch("/api/extra-payments/attachments/url", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ attachmentId }),
      });

      const json = (await res.json()) as { signedUrl?: string; error?: string };
      if (!res.ok || !json.signedUrl) throw new Error(json.error ?? "Nao foi possivel abrir o anexo.");

      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao abrir anexo.");
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-6 w-[260px] animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-3 h-4 w-[420px] animate-pulse rounded-xl bg-slate-100" />
        <div className="mt-6 h-56 w-full animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Acesso restrito ao Gestor/Admin.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Solicitar pagamentos extras</h1>
          <p className="mt-1 text-sm text-slate-600">Solicitações de valores extras por colaborador (encaminhadas ao Financeiro).</p>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <RefreshCcw size={16} /> Atualizar
        </button>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">{msg}</div> : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Projeto
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Colaborador
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              disabled={!selectedProjectId}
            >
              <option value="">Selecione...</option>
              {memberOptions.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {personLabel(m.user_id)} ({m.member_role})
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Mês de referência
            <input
              type="month"
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={refMonth}
              onChange={(e) => setRefMonth(e.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Valor (R$)
            <input
              inputMode="decimal"
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex: 350,00"
            />
          </label>

          <label className="md:col-span-2 grid gap-1 text-sm font-semibold text-slate-700">
            Descrição (motivo)
            <textarea
              className="min-h-[90px] rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: horas extras, deslocamento, bonificação por entrega..."
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Projeto selecionado: <span className="font-semibold text-slate-700">{selectedProject?.name ?? "-"}</span>
          </div>
          <button
            type="button"
            onClick={() => void submitRequest()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? "Enviando..." : "Enviar solicitação"}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Solicitações do projeto</h2>
        <p className="mt-1 text-sm text-slate-600">Acompanhe status e histórico.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Mês</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Status</th>
                <th className="p-3">Obs. Financeiro</th>
                <th className="p-3">Anexos</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {requests.length ? (
                requests.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{personLabel(r.user_id)}</div>
                    </td>
                    <td className="p-3">{String(r.reference_month).slice(0, 7)}</td>
                    <td className="p-3">{fmtMoney(Number(r.amount) || 0)}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{r.status}</span>
                    </td>
                    <td className="p-3 text-slate-600">{r.finance_note ?? "-"}</td>
                    <td className="p-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          {(attachmentsByPaymentId[r.id] ?? []).slice(0, 3).map((a) => (
                            <button
                              type="button"
                              key={a.id}
                              onClick={() => void openAttachment(a.id)}
                              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                              title={a.file_name ?? "Anexo"}
                            >
                              Ver anexo
                            </button>
                          ))}
                          {(attachmentsByPaymentId[r.id] ?? []).length > 3 ? (
                            <span className="text-xs text-slate-500">+{(attachmentsByPaymentId[r.id] ?? []).length - 3}</span>
                          ) : null}
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                          <input
                            type="file"
                            className="hidden"
                            accept="application/pdf,image/*"
                            disabled={uploadingFor === r.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              if (!f) return;
                              void uploadAttachment(r.id, f);
                              e.currentTarget.value = "";
                            }}
                          />
                          {uploadingFor === r.id ? "Enviando..." : "Adicionar anexo"}
                        </label>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      {r.status === "pending" && r.requested_by === meId ? (
                        <button
                          type="button"
                          onClick={() => void cancelRequest(r)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <Trash2 size={14} /> Cancelar
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={7}>
                    Nenhuma solicitação encontrada para este projeto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
