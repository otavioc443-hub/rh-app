"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Target } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type Role = "colaborador" | "coordenador" | "gestor" | "diretoria" | "rh" | "financeiro" | "pd" | "admin";
type GoalStatus = "draft" | "active" | "in_progress" | "completed" | "blocked" | "cancelled";
type GoalPriority = "low" | "medium" | "high" | "critical";

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  due_date: string | null;
  status: GoalStatus;
  priority: GoalPriority;
  assigned_by: string;
  assigned_by_role: Role;
  assigned_to: string;
  assigned_to_role: Role;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role | null;
  active: boolean | null;
};

type GoalUpdateRow = {
  id: string;
  goal_id: string;
  actor_user_id: string;
  actor_role: Role;
  status_from: GoalStatus | null;
  status_to: GoalStatus;
  current_value_from: number | null;
  current_value_to: number | null;
  comment: string | null;
  created_at: string;
};

type DeletedGoalRow = {
  id: string;
  goal_ref_id: string;
  title: string | null;
  description: string | null;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  due_date: string | null;
  status: GoalStatus | null;
  priority: GoalPriority | null;
  assigned_by: string | null;
  assigned_by_role: Role | null;
  assigned_to: string | null;
  assigned_to_role: Role | null;
  deleted_by: string | null;
  deleted_at: string;
  restored_at: string | null;
  restored_by: string | null;
  restored_goal_id: string | null;
};

const TARGETS_BY_ROLE: Partial<Record<Role, Role[]>> = {
  coordenador: ["colaborador"],
  gestor: ["coordenador"],
  diretoria: ["gestor", "rh", "financeiro"],
  admin: ["financeiro", "admin", "rh", "gestor"],
};

function roleLabel(role: Role) {
  if (role === "colaborador") return "Colaborador";
  if (role === "coordenador") return "Coordenador";
  if (role === "gestor") return "Gestor";
  if (role === "rh") return "RH";
  if (role === "financeiro") return "Financeiro";
  return "Diretoria";
}

function statusLabel(status: GoalStatus) {
  if (status === "draft") return "Rascunho";
  if (status === "active") return "Ativa";
  if (status === "in_progress") return "Em andamento";
  if (status === "completed") return "Concluida";
  if (status === "blocked") return "Bloqueada";
  return "Cancelada";
}

function statusClass(status: GoalStatus) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "in_progress" || status === "active") return "bg-sky-50 text-sky-700";
  if (status === "blocked") return "bg-amber-50 text-amber-700";
  if (status === "cancelled") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function priorityLabel(priority: GoalPriority) {
  if (priority === "low") return "Baixa";
  if (priority === "medium") return "Media";
  if (priority === "high") return "Alta";
  return "Critica";
}

function personLabel(profile: ProfileRow | undefined, fallbackId: string) {
  if (!profile) return fallbackId;
  return profile.full_name?.trim() || profile.email?.trim() || fallbackId;
}

function normalizeGoalsError(error: unknown, fallback: string) {
  const text = error instanceof Error ? error.message : String(error ?? "");
  const lower = text.toLowerCase();
  if (lower.includes("hierarchical_goals") && (lower.includes("does not exist") || lower.includes("relation"))) {
    return "Modulo de metas ainda nao disponivel. Execute a migration supabase/sql/2026-02-18_create_hierarchical_goals.sql.";
  }
  return error instanceof Error ? error.message : fallback;
}

export default function MetasPage() {
  const { role, active } = useUserRole();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState("");

  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [goalUpdatesByGoalId, setGoalUpdatesByGoalId] = useState<Record<string, GoalUpdateRow[]>>({});
  const [deletedGoals, setDeletedGoals] = useState<DeletedGoalRow[]>([]);
  const [selectedDeletedGoalId, setSelectedDeletedGoalId] = useState("");
  const [showRestoredDeleted, setShowRestoredDeleted] = useState(false);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});
  const [candidates, setCandidates] = useState<ProfileRow[]>([]);

  const [targetRole, setTargetRole] = useState<Role | "">("");
  const [targetUserId, setTargetUserId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<GoalPriority>("medium");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | GoalStatus>("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "overdue" | "completed" | "active">("all");
  const [sortBy, setSortBy] = useState<"due_date" | "priority" | "status" | "created_at" | "progress">("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pageReceived, setPageReceived] = useState(1);
  const [pageDelegated, setPageDelegated] = useState(1);
  const pageSize = 8;
  const [editStatusById, setEditStatusById] = useState<Record<string, GoalStatus>>({});
  const [editCurrentById, setEditCurrentById] = useState<Record<string, string>>({});
  const [editCommentById, setEditCommentById] = useState<Record<string, string>>({});

  const allowedTargetRoles = useMemo(() => (role ? TARGETS_BY_ROLE[role] ?? [] : []), [role]);
  const canCreate = active && allowedTargetRoles.length > 0;

  async function load() {
    if (!active || !role) return;
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      const uid = authData.user.id;
      setMeId(uid);

      const goalsRes = await supabase
        .from("hierarchical_goals")
        .select(
          "id,title,description,target_value,current_value,unit,due_date,status,priority,assigned_by,assigned_by_role,assigned_to,assigned_to_role,created_at,updated_at"
        )
        .order("created_at", { ascending: false });
      if (goalsRes.error) throw new Error(goalsRes.error.message);

      const nextGoals = (goalsRes.data ?? []) as GoalRow[];
      setGoals(nextGoals);

      setEditStatusById((prev) => {
        const next = { ...prev };
        for (const g of nextGoals) if (!next[g.id]) next[g.id] = g.status;
        return next;
      });
      setEditCurrentById((prev) => {
        const next = { ...prev };
        for (const g of nextGoals) if (!next[g.id]) next[g.id] = String(g.current_value ?? 0);
        return next;
      });

      const userIds = Array.from(new Set(nextGoals.flatMap((g) => [g.assigned_by, g.assigned_to])));
      const goalIds = nextGoals.map((g) => g.id);

      if (goalIds.length) {
        const updatesRes = await supabase
          .from("hierarchical_goal_updates")
          .select("id,goal_id,actor_user_id,actor_role,status_from,status_to,current_value_from,current_value_to,comment,created_at")
          .in("goal_id", goalIds)
          .order("created_at", { ascending: false });
        if (!updatesRes.error) {
          const grouped: Record<string, GoalUpdateRow[]> = {};
          for (const row of (updatesRes.data ?? []) as GoalUpdateRow[]) {
            (grouped[row.goal_id] ??= []).push(row);
            userIds.push(row.actor_user_id);
          }
          setGoalUpdatesByGoalId(grouped);
        } else {
          setGoalUpdatesByGoalId({});
        }
      } else {
        setGoalUpdatesByGoalId({});
      }

      const deletedRes = await supabase
        .from("hierarchical_goal_deleted_items")
        .select(
          "id,goal_ref_id,title,description,target_value,current_value,unit,due_date,status,priority,assigned_by,assigned_by_role,assigned_to,assigned_to_role,deleted_by,deleted_at,restored_at,restored_by,restored_goal_id"
        )
        .order("deleted_at", { ascending: false })
        .limit(250);
      if (!deletedRes.error) {
        const list = (deletedRes.data ?? []) as DeletedGoalRow[];
        setDeletedGoals(list);
        setSelectedDeletedGoalId((prev) => (prev && list.some((x) => x.id === prev) ? prev : list[0]?.id ?? ""));
        for (const d of list) {
          if (d.assigned_by) userIds.push(d.assigned_by);
          if (d.assigned_to) userIds.push(d.assigned_to);
          if (d.deleted_by) userIds.push(d.deleted_by);
        }
      } else {
        const lower = deletedRes.error.message.toLowerCase();
        if (lower.includes("hierarchical_goal_deleted_items") && (lower.includes("does not exist") || lower.includes("relation"))) {
          setDeletedGoals([]);
          setSelectedDeletedGoalId("");
        } else {
          throw new Error(deletedRes.error.message);
        }
      }

      if (userIds.length) {
        const pr = await supabase
          .from("profiles")
          .select("id,full_name,email,role,active")
          .in("id", Array.from(new Set(userIds)));
        if (!pr.error) {
          const map: Record<string, ProfileRow> = {};
          for (const p of (pr.data ?? []) as ProfileRow[]) map[p.id] = p;
          setProfilesById(map);
        } else {
          setProfilesById({});
        }
      } else {
        setProfilesById({});
      }

      if (canCreate) {
        const targetRoles = allowedTargetRoles;
        const candidateRes = await supabase
          .from("profiles")
          .select("id,full_name,email,role,active")
          .eq("active", true)
          .in("role", targetRoles)
          .order("full_name", { ascending: true });
        if (candidateRes.error) {
          setCandidates([]);
        } else {
          const list = (candidateRes.data ?? []) as ProfileRow[];
          setCandidates(list.filter((p) => p.id !== uid));
          setTargetRole((prev) => (prev && targetRoles.includes(prev as Role) ? prev : targetRoles[0] ?? ""));
        }
      } else {
        setCandidates([]);
        setTargetRole("");
      }
    } catch (e: unknown) {
      setMsg(normalizeGoalsError(e, "Erro ao carregar metas."));
      setGoals([]);
      setGoalUpdatesByGoalId({});
      setDeletedGoals([]);
      setSelectedDeletedGoalId("");
      setProfilesById({});
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, role]);

  const filteredCandidates = useMemo(
    () => candidates.filter((c) => (targetRole ? c.role === targetRole : false)),
    [candidates, targetRole]
  );
  const selectedDeletedGoal = useMemo(
    () => deletedGoals.find((x) => x.id === selectedDeletedGoalId) ?? null,
    [deletedGoals, selectedDeletedGoalId]
  );
  const restoredGoalExistsInCurrentList = useMemo(() => {
    if (!selectedDeletedGoal?.restored_goal_id) return false;
    return goals.some((g) => g.id === selectedDeletedGoal.restored_goal_id);
  }, [selectedDeletedGoal?.restored_goal_id, goals]);
  const visibleDeletedGoals = useMemo(
    () => deletedGoals.filter((x) => (showRestoredDeleted ? true : !x.restored_at)),
    [deletedGoals, showRestoredDeleted]
  );
  const deletedStats = useMemo(() => {
    const total = deletedGoals.length;
    const restored = deletedGoals.filter((x) => !!x.restored_at).length;
    const pending = total - restored;
    return { total, restored, pending };
  }, [deletedGoals]);
  useEffect(() => {
    setSelectedDeletedGoalId((prev) =>
      prev && visibleDeletedGoals.some((x) => x.id === prev) ? prev : visibleDeletedGoals[0]?.id ?? ""
    );
  }, [visibleDeletedGoals]);
  const canRestoreSelectedDeleted = useMemo(
    () =>
      !!selectedDeletedGoal &&
      !selectedDeletedGoal.restored_at &&
      !!role &&
      (role === "admin" || selectedDeletedGoal.assigned_by === meId),
    [selectedDeletedGoal, role, meId]
  );

  useEffect(() => {
    if (!targetRole) {
      setTargetUserId("");
      return;
    }
    setTargetUserId((prev) => (prev && filteredCandidates.some((c) => c.id === prev) ? prev : filteredCandidates[0]?.id ?? ""));
  }, [targetRole, filteredCandidates]);

  const receivedGoals = useMemo(() => goals.filter((g) => g.assigned_to === meId), [goals, meId]);
  const delegatedGoals = useMemo(() => goals.filter((g) => g.assigned_by === meId), [goals, meId]);
  const overdueReceived = useMemo(
    () =>
      receivedGoals.filter(
        (g) =>
          g.due_date &&
          g.due_date < new Date().toISOString().slice(0, 10) &&
          g.status !== "completed" &&
          g.status !== "cancelled"
      ).length,
    [receivedGoals]
  );
  const todayIso = new Date().toISOString().slice(0, 10);

  function goalProgress(goal: GoalRow) {
    const target = Number(goal.target_value);
    const current = Number(goal.current_value);
    if (!Number.isFinite(target) || target <= 0) return null;
    if (!Number.isFinite(current) || current <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  }

  function priorityScore(v: GoalPriority) {
    if (v === "critical") return 4;
    if (v === "high") return 3;
    if (v === "medium") return 2;
    return 1;
  }

  function statusScore(v: GoalStatus) {
    if (v === "blocked") return 4;
    if (v === "in_progress") return 3;
    if (v === "active") return 2;
    if (v === "draft") return 1;
    if (v === "completed") return 0;
    return -1;
  }

  const applySort = useCallback((list: GoalRow[]) => {
    const sorted = [...list];
    sorted.sort((a, b) => {
      let delta = 0;
      if (sortBy === "due_date") {
        const av = a.due_date ?? "9999-12-31";
        const bv = b.due_date ?? "9999-12-31";
        delta = av.localeCompare(bv);
      } else if (sortBy === "priority") {
        delta = priorityScore(a.priority) - priorityScore(b.priority);
      } else if (sortBy === "status") {
        delta = statusScore(a.status) - statusScore(b.status);
      } else if (sortBy === "progress") {
        const av = goalProgress(a) ?? -1;
        const bv = goalProgress(b) ?? -1;
        delta = av - bv;
      } else {
        delta = a.created_at.localeCompare(b.created_at);
      }
      return sortDir === "asc" ? delta : -delta;
    });
    return sorted;
  }, [sortBy, sortDir]);

  const filteredReceivedGoals = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = receivedGoals.filter((g) => {
      if (quickFilter === "overdue") {
        if (!(g.due_date && g.due_date < todayIso && g.status !== "completed" && g.status !== "cancelled")) return false;
      }
      if (quickFilter === "completed" && g.status !== "completed") return false;
      if (quickFilter === "active" && !(g.status === "active" || g.status === "in_progress")) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (!q) return true;
      const target = personLabel(profilesById[g.assigned_to], g.assigned_to).toLowerCase();
      const owner = personLabel(profilesById[g.assigned_by], g.assigned_by).toLowerCase();
      return `${g.title} ${g.description ?? ""} ${target} ${owner}`.toLowerCase().includes(q);
    });
    return applySort(base);
  }, [receivedGoals, query, statusFilter, quickFilter, todayIso, profilesById, applySort]);

  const filteredDelegatedGoals = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = delegatedGoals.filter((g) => {
      if (quickFilter === "overdue") {
        if (!(g.due_date && g.due_date < todayIso && g.status !== "completed" && g.status !== "cancelled")) return false;
      }
      if (quickFilter === "completed" && g.status !== "completed") return false;
      if (quickFilter === "active" && !(g.status === "active" || g.status === "in_progress")) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (!q) return true;
      const target = personLabel(profilesById[g.assigned_to], g.assigned_to).toLowerCase();
      const owner = personLabel(profilesById[g.assigned_by], g.assigned_by).toLowerCase();
      return `${g.title} ${g.description ?? ""} ${target} ${owner}`.toLowerCase().includes(q);
    });
    return applySort(base);
  }, [delegatedGoals, query, statusFilter, quickFilter, todayIso, profilesById, applySort]);

  useEffect(() => {
    setPageReceived(1);
    setPageDelegated(1);
  }, [query, statusFilter, quickFilter, sortBy, sortDir]);

  const receivedTotalPages = Math.max(1, Math.ceil(filteredReceivedGoals.length / pageSize));
  const delegatedTotalPages = Math.max(1, Math.ceil(filteredDelegatedGoals.length / pageSize));
  const receivedPageSafe = Math.min(pageReceived, receivedTotalPages);
  const delegatedPageSafe = Math.min(pageDelegated, delegatedTotalPages);
  const receivedPaged = filteredReceivedGoals.slice((receivedPageSafe - 1) * pageSize, receivedPageSafe * pageSize);
  const delegatedPaged = filteredDelegatedGoals.slice((delegatedPageSafe - 1) * pageSize, delegatedPageSafe * pageSize);

  function focusRestoredGoal(goalId: string) {
    if (!goalId) return;
    const inReceived = filteredReceivedGoals.some((g) => g.id === goalId);
    const inDelegated = filteredDelegatedGoals.some((g) => g.id === goalId);
    if (!inReceived && !inDelegated) return;

    if (inReceived) {
      const idx = filteredReceivedGoals.findIndex((g) => g.id === goalId);
      if (idx >= 0) setPageReceived(Math.floor(idx / pageSize) + 1);
    }
    if (inDelegated) {
      const idx = filteredDelegatedGoals.findIndex((g) => g.id === goalId);
      if (idx >= 0) setPageDelegated(Math.floor(idx / pageSize) + 1);
    }

    queueMicrotask(() => {
      const el = document.getElementById(`goal-card-${goalId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-emerald-300");
      setTimeout(() => el.classList.remove("ring-2", "ring-emerald-300"), 1800);
    });
  }

  function exportDeletedGoalsCsv() {
    const header = [
      "id",
      "goal_ref_id",
      "titulo",
      "status",
      "prioridade",
      "prazo",
      "atribuido_por",
      "atribuido_para",
      "excluido_por",
      "excluido_em",
      "restaurado_em",
      "restaurado_por",
      "restored_goal_id",
    ];

    const rows = visibleDeletedGoals.map((d) => [
      d.id,
      d.goal_ref_id,
      d.title ?? "",
      d.status ? statusLabel(d.status) : "",
      d.priority ? priorityLabel(d.priority) : "",
      d.due_date ?? "",
      d.assigned_by ? personLabel(profilesById[d.assigned_by], d.assigned_by) : "",
      d.assigned_to ? personLabel(profilesById[d.assigned_to], d.assigned_to) : "",
      d.deleted_by ? personLabel(profilesById[d.deleted_by], d.deleted_by) : "",
      d.deleted_at,
      d.restored_at ?? "",
      d.restored_by ? personLabel(profilesById[d.restored_by], d.restored_by) : "",
      d.restored_goal_id ?? "",
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metas-excluidas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function createGoal() {
    if (!role || !canCreate) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return setMsg("Informe o titulo da meta.");
    if (!targetRole || !targetUserId) return setMsg("Selecione destinatario da meta.");

    setSaving(true);
    setMsg("");
    try {
      const payload = {
        title: trimmedTitle,
        description: description.trim() || null,
        target_value: targetValue.trim() ? Number(targetValue.replace(",", ".")) : null,
        current_value: 0,
        unit: unit.trim() || null,
        due_date: dueDate || null,
        priority,
        status: "active" as GoalStatus,
        assigned_by: meId,
        assigned_by_role: role,
        assigned_to: targetUserId,
        assigned_to_role: targetRole,
      };
      if (payload.target_value !== null && !Number.isFinite(payload.target_value)) {
        throw new Error("Valor alvo invalido.");
      }
      const ins = await supabase.from("hierarchical_goals").insert(payload);
      if (ins.error) throw new Error(ins.error.message);

      setTitle("");
      setDescription("");
      setTargetValue("");
      setUnit("");
      setDueDate("");
      setPriority("medium");
      setMsg("Meta cadastrada com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(normalizeGoalsError(e, "Erro ao cadastrar meta."));
    } finally {
      setSaving(false);
    }
  }

  async function saveGoalProgress(goal: GoalRow) {
    setSaving(true);
    setMsg("");
    try {
      const nextStatus = editStatusById[goal.id] ?? goal.status;
      const nextCurrentRaw = (editCurrentById[goal.id] ?? String(goal.current_value)).replace(",", ".");
      const nextCurrent = Number(nextCurrentRaw);
      if (!Number.isFinite(nextCurrent) || nextCurrent < 0) throw new Error("Progresso invalido.");

      const patch: Partial<GoalRow> & { completed_at?: string | null } = {
        status: nextStatus,
        current_value: nextCurrent,
      };
      patch.completed_at = nextStatus === "completed" ? new Date().toISOString() : null;

      const up = await supabase.from("hierarchical_goals").update(patch).eq("id", goal.id);
      if (up.error) throw new Error(up.error.message);

      const comment = (editCommentById[goal.id] ?? "").trim();
      const audit = await supabase.from("hierarchical_goal_updates").insert({
        goal_id: goal.id,
        actor_user_id: meId,
        actor_role: role ?? "colaborador",
        status_from: goal.status,
        status_to: nextStatus,
        current_value_from: goal.current_value,
        current_value_to: nextCurrent,
        comment: comment || null,
      });
      if (audit.error) {
        const lower = audit.error.message.toLowerCase();
        if (!(lower.includes("hierarchical_goal_updates") && (lower.includes("does not exist") || lower.includes("relation")))) {
          throw new Error(audit.error.message);
        }
      }

      setEditCommentById((prev) => ({ ...prev, [goal.id]: "" }));
      await load();
    } catch (e: unknown) {
      setMsg(normalizeGoalsError(e, "Erro ao atualizar meta."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteDelegatedGoal(goalId: string) {
    if (!confirm("Excluir esta meta delegada?")) return;
    setSaving(true);
    setMsg("");
    try {
      const del = await supabase.from("hierarchical_goals").delete().eq("id", goalId);
      if (del.error) throw new Error(del.error.message);
      setMsg("Meta excluida.");
      await load();
    } catch (e: unknown) {
      setMsg(normalizeGoalsError(e, "Erro ao excluir meta."));
    } finally {
      setSaving(false);
    }
  }

  async function restoreDeletedGoal() {
    if (!selectedDeletedGoal || !canRestoreSelectedDeleted) return;
    if (!confirm("Restaurar esta meta excluida?")) return;

    setSaving(true);
    setMsg("");
    try {
      const rpc = await supabase.rpc("restore_deleted_hierarchical_goal", {
        p_deleted_item_id: selectedDeletedGoal.id,
      });
      if (rpc.error) throw new Error(rpc.error.message);
      setMsg("Meta restaurada com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(normalizeGoalsError(e, "Erro ao restaurar meta excluida."));
    } finally {
      setSaving(false);
    }
  }

  function exportGoalsCsv(kind: "received" | "delegated") {
    const rows = kind === "received" ? filteredReceivedGoals : filteredDelegatedGoals;
    const header = [
      "id",
      "titulo",
      "descricao",
      "status",
      "prioridade",
      "progresso_percentual",
      "valor_alvo",
      "unidade",
      "prazo",
      "atribuido_por",
      "atribuido_para",
      "criado_em",
      "atualizado_em",
    ];

    const csvRows = rows.map((g) => [
      g.id,
      g.title,
      g.description ?? "",
      statusLabel(g.status),
      priorityLabel(g.priority),
      goalProgress(g) ?? "",
      g.target_value ?? "",
      g.unit ?? "",
      g.due_date ?? "",
      personLabel(profilesById[g.assigned_by], g.assigned_by),
      personLabel(profilesById[g.assigned_to], g.assigned_to),
      g.created_at,
      g.updated_at,
    ]);

    const csv = [header, ...csvRows]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metas-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Metas por hierarquia</h1>
            <p className="mt-1 text-sm text-slate-600">
              Diretoria/CEO atribui para Financeiro, RH e Gestores. Gestor para Coordenadores. Coordenador para Colaboradores.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Recebidas ativas" value={receivedGoals.filter((g) => g.status === "active" || g.status === "in_progress").length} />
        <KpiCard label="Delegadas por voce" value={delegatedGoals.length} />
        <KpiCard label="Atrasadas (recebidas)" value={overdueReceived} />
        <KpiCard label="Concluidas (recebidas)" value={receivedGoals.filter((g) => g.status === "completed").length} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-3">
            Buscar meta
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              placeholder="Titulo, descricao, responsavel ou destinatario"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | GoalStatus)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="active">Ativa</option>
              <option value="in_progress">Em andamento</option>
              <option value="completed">Concluida</option>
              <option value="blocked">Bloqueada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Ordenar por
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "due_date" | "priority" | "status" | "created_at" | "progress")}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="due_date">Prazo</option>
              <option value="priority">Prioridade</option>
              <option value="status">Status</option>
              <option value="progress">Progresso</option>
              <option value="created_at">Criacao</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Direcao
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterChip active={quickFilter === "all"} onClick={() => setQuickFilter("all")} label="Todas" />
          <FilterChip active={quickFilter === "overdue"} onClick={() => setQuickFilter("overdue")} label="Atrasadas" />
          <FilterChip active={quickFilter === "active"} onClick={() => setQuickFilter("active")} label="Ativas" />
          <FilterChip active={quickFilter === "completed"} onClick={() => setQuickFilter("completed")} label="Concluidas" />
          <button
            type="button"
            onClick={() => exportGoalsCsv("received")}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            Exportar recebidas (CSV)
          </button>
          <button
            type="button"
            onClick={() => exportGoalsCsv("delegated")}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            Exportar delegadas (CSV)
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Metas excluidas (lista segura)</p>
        <p className="mt-1 text-xs text-slate-500">
          Exibe apenas metas excluidas onde voce era participante ou possui permissao administrativa.
        </p>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <KpiCard label="Excluidas (total)" value={deletedStats.total} />
          <KpiCard label="Pendentes restauração" value={deletedStats.pending} />
          <KpiCard label="Restauradas" value={deletedStats.restored} />
        </div>
        <div className="mt-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={showRestoredDeleted}
                onChange={(e) => setShowRestoredDeleted(e.target.checked)}
              />
              Mostrar tambem metas ja restauradas
            </label>
            <button
              type="button"
              onClick={exportDeletedGoalsCsv}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              Exportar excluidas (CSV)
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Selecionar meta excluida
            <select
              value={selectedDeletedGoalId}
              onChange={(e) => setSelectedDeletedGoalId(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">{visibleDeletedGoals.length ? "Selecione..." : "Sem metas excluidas visiveis"}</option>
              {visibleDeletedGoals.map((d) => (
                <option key={d.id} value={d.id}>
                  {(d.title ?? `Meta ${d.goal_ref_id.slice(0, 8)}`)} · excluida em {new Date(d.deleted_at).toLocaleDateString("pt-BR")}
                  {d.restored_at ? " · restaurada" : ""}
                </option>
              ))}
            </select>
          </label>
          {selectedDeletedGoal ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">{selectedDeletedGoal.title ?? "Meta sem titulo"}</p>
              <p className="mt-1">
                Status: {selectedDeletedGoal.status ? statusLabel(selectedDeletedGoal.status) : "-"} · Prioridade:{" "}
                {selectedDeletedGoal.priority ? priorityLabel(selectedDeletedGoal.priority) : "-"}
              </p>
              <p className="mt-1">Prazo: {selectedDeletedGoal.due_date ?? "-"}</p>
              <p className="mt-1">
                De:{" "}
                {selectedDeletedGoal.assigned_by
                  ? personLabel(profilesById[selectedDeletedGoal.assigned_by], selectedDeletedGoal.assigned_by)
                  : "-"}{" "}
                · Para:{" "}
                {selectedDeletedGoal.assigned_to
                  ? personLabel(profilesById[selectedDeletedGoal.assigned_to], selectedDeletedGoal.assigned_to)
                  : "-"}
              </p>
              <p className="mt-1">
                Excluida por:{" "}
                {selectedDeletedGoal.deleted_by
                  ? personLabel(profilesById[selectedDeletedGoal.deleted_by], selectedDeletedGoal.deleted_by)
                  : "-"}{" "}
                em {new Date(selectedDeletedGoal.deleted_at).toLocaleString("pt-BR")}
              </p>
              {selectedDeletedGoal.restored_at ? (
                <p className="mt-1">
                  Restaurada por:{" "}
                  {selectedDeletedGoal.restored_by
                    ? personLabel(profilesById[selectedDeletedGoal.restored_by], selectedDeletedGoal.restored_by)
                    : "-"}{" "}
                  em {new Date(selectedDeletedGoal.restored_at).toLocaleString("pt-BR")}
                </p>
              ) : null}
              {selectedDeletedGoal.restored_goal_id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-600">
                    Meta restaurada ID: {selectedDeletedGoal.restored_goal_id.slice(0, 8)}
                  </span>
                  <button
                    type="button"
                    onClick={() => focusRestoredGoal(selectedDeletedGoal.restored_goal_id as string)}
                    disabled={!restoredGoalExistsInCurrentList}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    title={
                      restoredGoalExistsInCurrentList
                        ? "Ir para a meta restaurada na lista"
                        : "Meta restaurada nao esta visivel no filtro atual"
                    }
                  >
                    Abrir meta restaurada
                  </button>
                </div>
              ) : null}
              {selectedDeletedGoal.description ? <p className="mt-2">{selectedDeletedGoal.description}</p> : null}
              {canRestoreSelectedDeleted ? (
                <button
                  type="button"
                  onClick={() => void restoreDeletedGoal()}
                  disabled={saving}
                  className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-60"
                >
                  Restaurar meta
                </button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Selecione uma meta excluida para ver os detalhes.
            </div>
          )}
        </div>
      </div>

      {canCreate ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">Cadastrar meta</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Tipo de destinatario
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as Role)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                {allowedTargetRoles.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold text-slate-700 xl:col-span-2">
              Destinatario
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="">Selecione</option>
                {filteredCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {personLabel(c, c.id)} ({roleLabel((c.role ?? "colaborador") as Role)})
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold text-slate-700 xl:col-span-2">
              Titulo
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                placeholder="Ex.: Reduzir backlog de chamados em 20%"
              />
            </label>

            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Prioridade
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as GoalPriority)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="low">Baixa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Critica</option>
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Valor alvo (opcional)
              <input
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                placeholder="100"
              />
            </label>

            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Unidade (opcional)
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                placeholder="% / chamados / entregas"
              />
            </label>

            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Prazo (opcional)
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              />
            </label>

            <label className="grid gap-1 text-xs font-semibold text-slate-700 xl:col-span-3">
              Descricao (opcional)
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[90px] rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void createGoal()}
            disabled={saving}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Target size={16} />
            {saving ? "Salvando..." : "Cadastrar meta"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          Seu perfil nao possui alcada de cadastro de metas hierarquicas.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Minhas metas recebidas</p>
          <div className="mt-3 space-y-3">
            {receivedPaged.length ? (
              receivedPaged.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  statusValue={editStatusById[g.id] ?? g.status}
                  currentValue={editCurrentById[g.id] ?? String(g.current_value)}
                  onStatusChange={(v) => setEditStatusById((prev) => ({ ...prev, [g.id]: v }))}
                  onCurrentChange={(v) => setEditCurrentById((prev) => ({ ...prev, [g.id]: v }))}
                  onSave={() => void saveGoalProgress(g)}
                  onDelete={null}
                  progressPct={goalProgress(g)}
                  updates={goalUpdatesByGoalId[g.id] ?? []}
                  profilesById={profilesById}
                  saving={saving}
                  commentValue={editCommentById[g.id] ?? ""}
                  onCommentChange={(v) => setEditCommentById((prev) => ({ ...prev, [g.id]: v }))}
                />
              ))
            ) : (
              <p className="text-sm text-slate-500">Nenhuma meta recebida para o filtro atual.</p>
            )}
          </div>
          {filteredReceivedGoals.length > 0 ? (
            <Pagination
              page={receivedPageSafe}
              totalPages={receivedTotalPages}
              onPrev={() => setPageReceived((p) => Math.max(1, p - 1))}
              onNext={() => setPageReceived((p) => Math.min(receivedTotalPages, p + 1))}
            />
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Metas delegadas por voce</p>
          <div className="mt-3 space-y-3">
            {delegatedPaged.length ? (
              delegatedPaged.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  statusValue={editStatusById[g.id] ?? g.status}
                  currentValue={editCurrentById[g.id] ?? String(g.current_value)}
                  onStatusChange={(v) => setEditStatusById((prev) => ({ ...prev, [g.id]: v }))}
                  onCurrentChange={(v) => setEditCurrentById((prev) => ({ ...prev, [g.id]: v }))}
                  onSave={() => void saveGoalProgress(g)}
                  onDelete={() => void deleteDelegatedGoal(g.id)}
                  progressPct={goalProgress(g)}
                  updates={goalUpdatesByGoalId[g.id] ?? []}
                  profilesById={profilesById}
                  saving={saving}
                  commentValue={editCommentById[g.id] ?? ""}
                  onCommentChange={(v) => setEditCommentById((prev) => ({ ...prev, [g.id]: v }))}
                />
              ))
            ) : (
              <p className="text-sm text-slate-500">Nenhuma meta delegada para o filtro atual.</p>
            )}
          </div>
          {filteredDelegatedGoals.length > 0 ? (
            <Pagination
              page={delegatedPageSafe}
              totalPages={delegatedTotalPages}
              onPrev={() => setPageDelegated((p) => Math.max(1, p - 1))}
              onNext={() => setPageDelegated((p) => Math.min(delegatedTotalPages, p + 1))}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <span className="font-semibold text-slate-700">
        Pagina {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 disabled:opacity-50"
        >
          Proxima
        </button>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  statusValue,
  currentValue,
  onStatusChange,
  onCurrentChange,
  onSave,
  onDelete,
  progressPct,
  updates,
  profilesById,
  commentValue,
  onCommentChange,
  saving,
}: {
  goal: GoalRow;
  statusValue: GoalStatus;
  currentValue: string;
  onStatusChange: (value: GoalStatus) => void;
  onCurrentChange: (value: string) => void;
  onSave: () => void;
  onDelete: (() => void) | null;
  progressPct: number | null;
  updates: GoalUpdateRow[];
  profilesById: Record<string, ProfileRow>;
  commentValue: string;
  onCommentChange: (value: string) => void;
  saving: boolean;
}) {
  const target = profilesById[goal.assigned_to];
  const owner = profilesById[goal.assigned_by];

  return (
    <div id={`goal-card-${goal.id}`} className="rounded-xl border border-slate-200 p-3 transition-shadow">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{goal.title}</p>
          <p className="mt-1 text-xs text-slate-600">
            De: {personLabel(owner, goal.assigned_by)} ({roleLabel(goal.assigned_by_role)}) · Para:{" "}
            {personLabel(target, goal.assigned_to)} ({roleLabel(goal.assigned_to_role)})
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Prioridade: {priorityLabel(goal.priority)} {goal.due_date ? `· Prazo: ${goal.due_date}` : ""}
          </p>
          {progressPct !== null ? (
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-600">Progresso: {progressPct}%</p>
              <div className="mt-1 h-2 w-48 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          ) : null}
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(goal.status)}`}>
          {statusLabel(goal.status)}
        </span>
      </div>

      {goal.description ? <p className="mt-2 text-sm text-slate-700">{goal.description}</p> : null}

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          Status
          <select
            value={statusValue}
            onChange={(e) => onStatusChange(e.target.value as GoalStatus)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
          >
            <option value="draft">Rascunho</option>
            <option value="active">Ativa</option>
            <option value="in_progress">Em andamento</option>
            <option value="completed">Concluida</option>
            <option value="blocked">Bloqueada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>

        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          Progresso atual
          <input
            value={currentValue}
            onChange={(e) => onCurrentChange(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
          />
        </label>

        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          Meta alvo
          <input
            disabled
            value={goal.target_value !== null ? `${goal.target_value}${goal.unit ? ` ${goal.unit}` : ""}` : "-"}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700"
          />
        </label>
      </div>

      <label className="mt-3 grid gap-1 text-xs font-semibold text-slate-700">
        Comentario da atualizacao (opcional)
        <input
          value={commentValue}
          onChange={(e) => onCommentChange(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
          placeholder="Ex.: Bloqueio por dependencia externa"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar atualizacao"}
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
          >
            Excluir meta
          </button>
        ) : null}
      </div>

      <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-700">
          Historico de atualizacoes ({updates.length})
        </summary>
        <div className="mt-2 space-y-2">
          {updates.length ? (
            updates.slice(0, 8).map((u) => (
              <div key={u.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
                <p className="font-semibold">
                  {statusLabel(u.status_from ?? "draft")} {"->"} {statusLabel(u.status_to)}
                </p>
                <p>
                  Progresso: {u.current_value_from ?? "-"} {"->"} {u.current_value_to ?? "-"}
                </p>
                <p>
                  Por: {personLabel(profilesById[u.actor_user_id], u.actor_user_id)} ({roleLabel(u.actor_role)})
                </p>
                <p>Em: {new Date(u.created_at).toLocaleString("pt-BR")}</p>
                {u.comment ? <p>Obs: {u.comment}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500">Sem eventos de historico.</p>
          )}
        </div>
      </details>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
