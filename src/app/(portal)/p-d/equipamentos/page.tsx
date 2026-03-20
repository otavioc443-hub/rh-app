"use client";

import { useEffect, useMemo, useState } from "react";
import { Cpu, HardDrive, MonitorCheck, RefreshCcw, Save, UserPlus, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type EquipmentType = "computer" | "monitor" | "keyboard" | "mouse" | "headset" | "other";
type EquipmentStatus = "available" | "allocated" | "maintenance" | "retired";
type MaintenanceType = "preventive" | "corrective" | "upgrade" | "inspection" | "other";
type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

type EquipmentRow = {
  id: string;
  equipment_name: string;
  equipment_type: EquipmentType;
  status: EquipmentStatus;
  brand: string | null;
  serial_number: string | null;
  hostname: string | null;
  processor: string | null;
  ram: string | null;
  gpu: string | null;
  wifi_enabled: boolean;
  ethernet_enabled: boolean;
  disk: string | null;
  monitor_details: string | null;
  keyboard_details: string | null;
  mouse_details: string | null;
  headset_details: string | null;
  additional_info: string | null;
  current_holder_user_id: string | null;
  updated_at: string;
};

type AllocationRow = {
  id: string;
  equipment_id: string;
  user_id: string;
  allocation_notes: string | null;
  returned_notes: string | null;
  allocated_at: string;
  returned_at: string | null;
};

type MaintenanceRow = {
  id: string;
  equipment_id: string;
  maintenance_type: MaintenanceType;
  status: MaintenanceStatus;
  title: string;
  details: string | null;
  provider: string | null;
  cost: number | null;
  scheduled_for: string | null;
  performed_at: string | null;
  next_due_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const EMPTY_FORM = {
  id: "",
  equipment_name: "",
  equipment_type: "computer" as EquipmentType,
  status: "available" as EquipmentStatus,
  brand: "",
  serial_number: "",
  hostname: "",
  processor: "",
  ram: "",
  gpu: "",
  wifi_enabled: true,
  ethernet_enabled: true,
  disk: "",
  monitor_details: "",
  keyboard_details: "",
  mouse_details: "",
  headset_details: "",
  additional_info: "",
};

const EMPTY_MAINTENANCE = {
  maintenance_type: "preventive" as MaintenanceType,
  status: "scheduled" as MaintenanceStatus,
  title: "",
  details: "",
  provider: "",
  cost: "",
  scheduled_for: "",
  performed_at: "",
  next_due_at: "",
};

function typeLabel(value: EquipmentType) {
  if (value === "computer") return "Computador";
  if (value === "monitor") return "Monitor";
  if (value === "keyboard") return "Teclado";
  if (value === "mouse") return "Mouse";
  if (value === "headset") return "Fone";
  return "Outro";
}

function statusLabel(value: EquipmentStatus) {
  if (value === "available") return "Disponível";
  if (value === "allocated") return "Alocado";
  if (value === "maintenance") return "Em manutenção";
  return "Inativo";
}

function statusClass(value: EquipmentStatus) {
  if (value === "available") return "bg-emerald-50 text-emerald-700";
  if (value === "allocated") return "bg-sky-50 text-sky-700";
  if (value === "maintenance") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function maintenanceLabel(value: MaintenanceStatus) {
  if (value === "scheduled") return "Agendada";
  if (value === "in_progress") return "Em andamento";
  if (value === "completed") return "Concluída";
  return "Cancelada";
}

function fmtDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

function fmtDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function clean(value: string) {
  return value.trim();
}

export default function PdEquipamentosPage() {
  const { role } = useUserRole();
  const canManage = role === "pd" || role === "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [rows, setRows] = useState<EquipmentRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [maintenanceRows, setMaintenanceRows] = useState<MaintenanceRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<EquipmentType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<EquipmentStatus | "all">("all");
  const [selectedId, setSelectedId] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [allocationUserId, setAllocationUserId] = useState("");
  const [allocationNotes, setAllocationNotes] = useState("");
  const [maintenanceForm, setMaintenanceForm] = useState(EMPTY_MAINTENANCE);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessão inválida.");
      setUserId(authData.user.id);

      const [equipmentRes, allocationRes, maintenanceRes, profilesRes] = await Promise.all([
        supabase
          .from("pd_equipment_assets")
          .select("id,equipment_name,equipment_type,status,brand,serial_number,hostname,processor,ram,gpu,wifi_enabled,ethernet_enabled,disk,monitor_details,keyboard_details,mouse_details,headset_details,additional_info,current_holder_user_id,updated_at")
          .order("updated_at", { ascending: false }),
        supabase
          .from("pd_equipment_allocations")
          .select("id,equipment_id,user_id,allocation_notes,returned_notes,allocated_at,returned_at")
          .order("allocated_at", { ascending: false }),
        supabase
          .from("pd_equipment_maintenance")
          .select("id,equipment_id,maintenance_type,status,title,details,provider,cost,scheduled_for,performed_at,next_due_at")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name,email").order("full_name", { ascending: true }),
      ]);

      if (equipmentRes.error) throw new Error(equipmentRes.error.message);
      if (allocationRes.error) throw new Error(allocationRes.error.message);
      if (maintenanceRes.error) throw new Error(maintenanceRes.error.message);
      if (profilesRes.error) throw new Error(profilesRes.error.message);

      const nextRows = (equipmentRes.data ?? []) as EquipmentRow[];
      setRows(nextRows);
      setAllocations((allocationRes.data ?? []) as AllocationRow[]);
      setMaintenanceRows((maintenanceRes.data ?? []) as MaintenanceRow[]);
      setProfiles((profilesRes.data ?? []) as ProfileRow[]);
      setSelectedId((prev) => (prev && nextRows.some((item) => item.id === prev) ? prev : nextRows[0]?.id ?? ""));
    } catch (e: unknown) {
      setRows([]);
      setAllocations([]);
      setMaintenanceRows([]);
      setProfiles([]);
      setSelectedId("");
      setMsg(e instanceof Error ? e.message : "Erro ao carregar equipamentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!role) return;
    void load();
  }, [role]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((item) => {
      if (filterType !== "all" && item.equipment_type !== filterType) return false;
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (!term) return true;
      return [item.equipment_name, item.brand ?? "", item.serial_number ?? "", item.hostname ?? "", item.processor ?? "", item.additional_info ?? ""].join(" ").toLowerCase().includes(term);
    });
  }, [filterStatus, filterType, rows, search]);

  const selected = useMemo(() => rows.find((item) => item.id === selectedId) ?? null, [rows, selectedId]);
  const selectedAllocations = useMemo(() => allocations.filter((item) => item.equipment_id === selectedId).slice(0, 10), [allocations, selectedId]);
  const selectedMaintenance = useMemo(() => maintenanceRows.filter((item) => item.equipment_id === selectedId).slice(0, 10), [maintenanceRows, selectedId]);
  const openAllocation = useMemo(() => selectedAllocations.find((item) => !item.returned_at) ?? null, [selectedAllocations]);

  const profileMap = useMemo(() => {
    const map: Record<string, ProfileRow> = {};
    for (const item of profiles) map[item.id] = item;
    return map;
  }, [profiles]);

  const stats = useMemo(() => ({
    total: rows.length,
    available: rows.filter((item) => item.status === "available").length,
    allocated: rows.filter((item) => item.status === "allocated").length,
    maintenance: rows.filter((item) => item.status === "maintenance").length,
  }), [rows]);

  useEffect(() => {
    if (!selected) {
      setForm(EMPTY_FORM);
      setAllocationUserId("");
      setAllocationNotes("");
      setMaintenanceForm(EMPTY_MAINTENANCE);
      return;
    }
    setForm({
      id: selected.id,
      equipment_name: selected.equipment_name,
      equipment_type: selected.equipment_type,
      status: selected.status,
      brand: selected.brand ?? "",
      serial_number: selected.serial_number ?? "",
      hostname: selected.hostname ?? "",
      processor: selected.processor ?? "",
      ram: selected.ram ?? "",
      gpu: selected.gpu ?? "",
      wifi_enabled: selected.wifi_enabled,
      ethernet_enabled: selected.ethernet_enabled,
      disk: selected.disk ?? "",
      monitor_details: selected.monitor_details ?? "",
      keyboard_details: selected.keyboard_details ?? "",
      mouse_details: selected.mouse_details ?? "",
      headset_details: selected.headset_details ?? "",
      additional_info: selected.additional_info ?? "",
    });
    setAllocationUserId(selected.current_holder_user_id ?? "");
    setAllocationNotes("");
    setMaintenanceForm(EMPTY_MAINTENANCE);
  }, [selected]);

  async function saveEquipment() {
    if (!canManage || !userId) return;
    const equipmentName = clean(form.equipment_name);
    if (!equipmentName) {
      setMsg("Informe o nome do equipamento.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const payload = {
        equipment_name: equipmentName,
        equipment_type: form.equipment_type,
        status: form.status,
        brand: clean(form.brand) || null,
        serial_number: clean(form.serial_number) || null,
        hostname: clean(form.hostname) || null,
        processor: clean(form.processor) || null,
        ram: clean(form.ram) || null,
        gpu: clean(form.gpu) || null,
        wifi_enabled: form.wifi_enabled,
        ethernet_enabled: form.ethernet_enabled,
        disk: clean(form.disk) || null,
        monitor_details: clean(form.monitor_details) || null,
        keyboard_details: clean(form.keyboard_details) || null,
        mouse_details: clean(form.mouse_details) || null,
        headset_details: clean(form.headset_details) || null,
        additional_info: clean(form.additional_info) || null,
        updated_by: userId,
      };

      if (form.id) {
        const { error } = await supabase.from("pd_equipment_assets").update(payload).eq("id", form.id);
        if (error) throw new Error(error.message);
        setMsg("Equipamento atualizado.");
      } else {
        const { data, error } = await supabase.from("pd_equipment_assets").insert({ ...payload, created_by: userId }).select("id").maybeSingle();
        if (error) throw new Error(error.message);
        if (data?.id) setSelectedId(data.id);
        setMsg("Equipamento cadastrado.");
      }

      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar equipamento.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAllocation(nextUserId: string | null) {
    if (!canManage || !selected || !userId) return;
    setSaving(true);
    setMsg("");
    try {
      if (openAllocation) {
        const { error: closeError } = await supabase.from("pd_equipment_allocations").update({
          returned_at: new Date().toISOString(),
          returned_by: userId,
          returned_notes: clean(allocationNotes) || null,
        }).eq("id", openAllocation.id);
        if (closeError) throw new Error(closeError.message);
      }

      if (nextUserId) {
        const { error: insertError } = await supabase.from("pd_equipment_allocations").insert({
          equipment_id: selected.id,
          user_id: nextUserId,
          allocation_notes: clean(allocationNotes) || null,
          allocated_by: userId,
        });
        if (insertError) throw new Error(insertError.message);
      }

      const nextStatus = selected.status === "maintenance" ? "maintenance" : nextUserId ? "allocated" : "available";
      const { error: assetError } = await supabase.from("pd_equipment_assets").update({
        current_holder_user_id: nextUserId,
        status: nextStatus,
        updated_by: userId,
      }).eq("id", selected.id);
      if (assetError) throw new Error(assetError.message);

      setAllocationNotes("");
      setMsg(nextUserId ? "Alocação atualizada." : "Equipamento desalocado.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar alocação.");
    } finally {
      setSaving(false);
    }
  }

  async function addMaintenance() {
    if (!canManage || !selected || !userId) return;
    const title = clean(maintenanceForm.title);
    if (!title) {
      setMsg("Informe o título da manutenção.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const { error } = await supabase.from("pd_equipment_maintenance").insert({
        equipment_id: selected.id,
        maintenance_type: maintenanceForm.maintenance_type,
        status: maintenanceForm.status,
        title,
        details: clean(maintenanceForm.details) || null,
        provider: clean(maintenanceForm.provider) || null,
        cost: maintenanceForm.cost ? Number(maintenanceForm.cost.replace(",", ".")) : null,
        scheduled_for: maintenanceForm.scheduled_for || null,
        performed_at: maintenanceForm.performed_at ? new Date(maintenanceForm.performed_at).toISOString() : null,
        next_due_at: maintenanceForm.next_due_at || null,
        created_by: userId,
        updated_by: userId,
      });
      if (error) throw new Error(error.message);

      const nextStatus =
        maintenanceForm.status === "completed" || maintenanceForm.status === "cancelled"
          ? selected.current_holder_user_id
            ? "allocated"
            : "available"
          : "maintenance";

      const { error: assetError } = await supabase.from("pd_equipment_assets").update({ status: nextStatus, updated_by: userId }).eq("id", selected.id);
      if (assetError) throw new Error(assetError.message);

      setMaintenanceForm(EMPTY_MAINTENANCE);
      setMsg("Manutenção registrada.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar manutenção.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setSelectedId("");
    setForm(EMPTY_FORM);
    setAllocationUserId("");
    setAllocationNotes("");
    setMaintenanceForm(EMPTY_MAINTENANCE);
    setMsg("");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">P&D - Equipamentos</h1>
            <p className="mt-1 text-sm text-slate-600">Cadastre computadores, monitores e periféricos, registre manutenções e controle a alocação por colaborador.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Novo equipamento</button>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60">
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Equipamentos", value: stats.total, icon: Cpu }, { label: "Disponíveis", value: stats.available, icon: HardDrive }, { label: "Alocados", value: stats.allocated, icon: UserPlus }, { label: "Em manutenção", value: stats.maintenance, icon: Wrench }].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                <Icon size={18} className="text-slate-500" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Nome do equipamento<input value={form.equipment_name} onChange={(e) => setForm((prev) => ({ ...prev, equipment_name: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" placeholder="Ex.: Notebook Dell Latitude 5430" /></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Tipo<select value={form.equipment_type} onChange={(e) => setForm((prev) => ({ ...prev, equipment_type: e.target.value as EquipmentType }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900"><option value="computer">Computador</option><option value="monitor">Monitor</option><option value="keyboard">Teclado</option><option value="mouse">Mouse</option><option value="headset">Fone</option><option value="other">Outro</option></select></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Marca<input value={form.brand} onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Status<select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as EquipmentStatus }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900"><option value="available">Disponível</option><option value="allocated">Alocado</option><option value="maintenance">Em manutenção</option><option value="retired">Inativo</option></select></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Número de série<input value={form.serial_number} onChange={(e) => setForm((prev) => ({ ...prev, serial_number: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Hostname / patrimônio<input value={form.hostname} onChange={(e) => setForm((prev) => ({ ...prev, hostname: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Processador<input value={form.processor} onChange={(e) => setForm((prev) => ({ ...prev, processor: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">RAM<input value={form.ram} onChange={(e) => setForm((prev) => ({ ...prev, ram: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" placeholder="Ex.: 16 GB DDR4" /></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Placa de vídeo<input value={form.gpu} onChange={(e) => setForm((prev) => ({ ...prev, gpu: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Disco<input value={form.disk} onChange={(e) => setForm((prev) => ({ ...prev, disk: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" placeholder="Ex.: SSD 512 GB" /></label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Informações do monitor<textarea value={form.monitor_details} onChange={(e) => setForm((prev) => ({ ...prev, monitor_details: e.target.value }))} className="min-h-[90px] rounded-xl border border-slate-200 p-3 text-sm text-slate-900" placeholder="Ex.: Dell 24'', HDMI, base ajustável" /></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Informações adicionais<textarea value={form.additional_info} onChange={(e) => setForm((prev) => ({ ...prev, additional_info: e.target.value }))} className="min-h-[90px] rounded-xl border border-slate-200 p-3 text-sm text-slate-900" placeholder="Observações de uso, acessórios e conservação." /></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Teclado<input value={form.keyboard_details} onChange={(e) => setForm((prev) => ({ ...prev, keyboard_details: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Mouse<input value={form.mouse_details} onChange={(e) => setForm((prev) => ({ ...prev, mouse_details: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">Fone<input value={form.headset_details} onChange={(e) => setForm((prev) => ({ ...prev, headset_details: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <div className="grid gap-2">
                <p className="text-xs font-semibold text-slate-700">Conectividade</p>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.wifi_enabled} onChange={(e) => setForm((prev) => ({ ...prev, wifi_enabled: e.target.checked }))} />Wi-Fi</label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.ethernet_enabled} onChange={(e) => setForm((prev) => ({ ...prev, ethernet_enabled: e.target.checked }))} />Ethernet</label>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => void saveEquipment()} disabled={!canManage || saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save size={16} />{form.id ? "Atualizar equipamento" : "Salvar equipamento"}</button>
              <button onClick={resetForm} type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Limpar</button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 md:col-span-2" placeholder="Buscar por nome, marca, série ou host..." />
              <div className="grid grid-cols-2 gap-3">
                <select value={filterType} onChange={(e) => setFilterType(e.target.value as EquipmentType | "all")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900"><option value="all">Todos os tipos</option><option value="computer">Computador</option><option value="monitor">Monitor</option><option value="keyboard">Teclado</option><option value="mouse">Mouse</option><option value="headset">Fone</option><option value="other">Outro</option></select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as EquipmentStatus | "all")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900"><option value="all">Todos os status</option><option value="available">Disponível</option><option value="allocated">Alocado</option><option value="maintenance">Em manutenção</option><option value="retired">Inativo</option></select>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-700"><tr><th className="p-3">Equipamento</th><th className="p-3">Tipo</th><th className="p-3">Marca</th><th className="p-3">Responsável atual</th><th className="p-3">Status</th><th className="p-3">Atualizado</th></tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td className="p-3 text-slate-500" colSpan={6}>Carregando...</td></tr>
                  ) : filteredRows.length ? (
                    filteredRows.map((item) => (
                      <tr key={item.id} onClick={() => setSelectedId(item.id)} className={`cursor-pointer border-t ${item.id === selectedId ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                        <td className="p-3"><p className="font-semibold text-slate-900">{item.equipment_name}</p><p className="mt-1 text-xs text-slate-500">{item.serial_number || item.hostname || "Sem identificação adicional"}</p></td>
                        <td className="p-3">{typeLabel(item.equipment_type)}</td>
                        <td className="p-3">{item.brand || "-"}</td>
                        <td className="p-3">{item.current_holder_user_id ? profileMap[item.current_holder_user_id]?.full_name || profileMap[item.current_holder_user_id]?.email || item.current_holder_user_id : "-"}</td>
                        <td className="p-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{statusLabel(item.status)}</span></td>
                        <td className="p-3">{fmtDateTime(item.updated_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td className="p-3 text-slate-500" colSpan={6}>Nenhum equipamento encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><MonitorCheck size={16} />Detalhes do equipamento</div>
            {selected ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{selected.equipment_name}</p>
                  <p className="mt-1 text-slate-600">{typeLabel(selected.equipment_type)} · {selected.brand || "Sem marca"}</p>
                  <p className="mt-3 text-slate-700">Processador: {selected.processor || "-"}</p>
                  <p className="mt-1 text-slate-700">RAM: {selected.ram || "-"}</p>
                  <p className="mt-1 text-slate-700">Placa de vídeo: {selected.gpu || "-"}</p>
                  <p className="mt-1 text-slate-700">Disco: {selected.disk || "-"}</p>
                  <p className="mt-1 text-slate-700">Monitor: {selected.monitor_details || "-"}</p>
                  <p className="mt-1 text-slate-700">Teclado: {selected.keyboard_details || "-"}</p>
                  <p className="mt-1 text-slate-700">Mouse: {selected.mouse_details || "-"}</p>
                  <p className="mt-1 text-slate-700">Fone: {selected.headset_details || "-"}</p>
                  <p className="mt-1 text-slate-700">Observações: {selected.additional_info || "-"}</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Alocação</p>
                  <p className="mt-2 text-sm text-slate-700">Atual: {selected.current_holder_user_id ? profileMap[selected.current_holder_user_id]?.full_name || profileMap[selected.current_holder_user_id]?.email || selected.current_holder_user_id : "Não alocado"}</p>
                  <div className="mt-3 grid gap-3">
                    <select value={allocationUserId} onChange={(e) => setAllocationUserId(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900">
                      <option value="">Selecionar colaborador</option>
                      {profiles.map((person) => (<option key={person.id} value={person.id}>{person.full_name || person.email || person.id}</option>))}
                    </select>
                    <textarea value={allocationNotes} onChange={(e) => setAllocationNotes(e.target.value)} className="min-h-[90px] rounded-xl border border-slate-200 p-3 text-sm text-slate-900" placeholder="Observações sobre entrega, troca ou devolução..." />
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void saveAllocation(allocationUserId || null)} disabled={!canManage || saving || !selected} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Salvar alocação</button>
                      <button onClick={() => void saveAllocation(null)} disabled={!canManage || saving || !openAllocation} type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">Desalocar</button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Registrar manutenção</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input value={maintenanceForm.title} onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, title: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 md:col-span-2" placeholder="Título da manutenção" />
                    <select value={maintenanceForm.maintenance_type} onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, maintenance_type: e.target.value as MaintenanceType }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900"><option value="preventive">Preventiva</option><option value="corrective">Corretiva</option><option value="upgrade">Upgrade</option><option value="inspection">Inspeção</option><option value="other">Outra</option></select>
                    <select value={maintenanceForm.status} onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, status: e.target.value as MaintenanceStatus }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900"><option value="scheduled">Agendada</option><option value="in_progress">Em andamento</option><option value="completed">Concluída</option><option value="cancelled">Cancelada</option></select>
                    <input value={maintenanceForm.provider} onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, provider: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" placeholder="Fornecedor / técnico" />
                    <input value={maintenanceForm.cost} onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, cost: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" placeholder="Custo" />
                    <label className="grid gap-1 text-xs font-semibold text-slate-700">Agendada para<input type="date" value={maintenanceForm.scheduled_for} onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, scheduled_for: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-700">Próxima revisão<input type="date" value={maintenanceForm.next_due_at} onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, next_due_at: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">Realizada em<input type="datetime-local" value={maintenanceForm.performed_at} onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, performed_at: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
                    <textarea value={maintenanceForm.details} onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, details: e.target.value }))} className="min-h-[100px] rounded-xl border border-slate-200 p-3 text-sm text-slate-900 md:col-span-2" placeholder="Descreva o serviço executado ou a pendência." />
                  </div>
                  <button onClick={() => void addMaintenance()} disabled={!canManage || saving || !selected} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Registrar manutenção</button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">Selecione um equipamento para ver detalhes, alocação e manutenções.</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">Histórico de alocação</p>
            <div className="mt-3 space-y-3">
              {selectedAllocations.length ? selectedAllocations.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{profileMap[item.user_id]?.full_name || profileMap[item.user_id]?.email || item.user_id}</p>
                  <p className="mt-1 text-slate-600">Entrega: {fmtDateTime(item.allocated_at)}</p>
                  <p className="mt-1 text-slate-600">Devolução: {fmtDateTime(item.returned_at)}</p>
                  {item.allocation_notes ? <p className="mt-2 text-slate-700">Entrega: {item.allocation_notes}</p> : null}
                  {item.returned_notes ? <p className="mt-1 text-slate-700">Devolução: {item.returned_notes}</p> : null}
                </div>
              )) : <p className="text-sm text-slate-500">Nenhuma alocação registrada.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">Histórico de manutenção</p>
            <div className="mt-3 space-y-3">
              {selectedMaintenance.length ? selectedMaintenance.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">{maintenanceLabel(item.status)}</span>
                  </div>
                  <p className="mt-1 text-slate-600">Tipo: {item.maintenance_type}</p>
                  <p className="mt-1 text-slate-600">Agendada: {fmtDate(item.scheduled_for)} · Próxima: {fmtDate(item.next_due_at)}</p>
                  <p className="mt-1 text-slate-600">Executada: {fmtDateTime(item.performed_at)}</p>
                  {item.provider ? <p className="mt-1 text-slate-700">Fornecedor: {item.provider}</p> : null}
                  {item.cost != null ? <p className="mt-1 text-slate-700">Custo: {item.cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p> : null}
                  {item.details ? <p className="mt-2 text-slate-700">{item.details}</p> : null}
                </div>
              )) : <p className="text-sm text-slate-500">Nenhuma manutenção registrada.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
