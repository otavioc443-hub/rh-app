"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, RefreshCcw, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ClientRow = {
  id: string;
  company_id: string | null;
  name: string;
  legal_name: string | null;
  document: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

type CompanyRow = {
  id: string;
  name: string;
};

export default function DiretoriaClientesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [editingId, setEditingId] = useState<string>("");

  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [document, setDocument] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companies) map.set(c.id, c.name);
    return map;
  }, [companies]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [{ data: userData, error: userErr }, companyRes, clientRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("companies").select("id,name").order("name", { ascending: true }),
        supabase
          .from("project_clients")
          .select("id,company_id,name,legal_name,document,contact_name,contact_email,contact_phone,notes,active,created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (userErr) throw userErr;
      if (companyRes.error) throw companyRes.error;
      if (clientRes.error) throw clientRes.error;

      const companyRows = (companyRes.data ?? []) as CompanyRow[];
      setCompanies(companyRows);
      setClients((clientRes.data ?? []) as ClientRow[]);

      if (!editingId) {
        const meId = userData.user?.id ?? "";
        if (meId) {
          const profRes = await supabase.from("profiles").select("company_id").eq("id", meId).maybeSingle<{ company_id: string | null }>();
          if (profRes.error) throw profRes.error;

          const preferredCompanyId = (profRes.data?.company_id ?? "") || companyRows[0]?.id || "";
          setCompanyId((prev) => prev || preferredCompanyId);
        } else if (companyRows[0]?.id) {
          setCompanyId((prev) => prev || companyRows[0].id);
        }
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar clientes.");
      setClients([]);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startNew() {
    setEditingId("");
    setName("");
    setLegalName("");
    setDocument("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setNotes("");
    setActive(true);
  }

  function startEdit(row: ClientRow) {
    setEditingId(row.id);
    setCompanyId(row.company_id ?? "");
    setName(row.name ?? "");
    setLegalName(row.legal_name ?? "");
    setDocument(row.document ?? "");
    setContactName(row.contact_name ?? "");
    setContactEmail(row.contact_email ?? "");
    setContactPhone(row.contact_phone ?? "");
    setNotes(row.notes ?? "");
    setActive(!!row.active);
  }

  async function saveClient() {
    if (!companyId) {
      setMsg("Selecione a empresa do cliente.");
      return;
    }
    if (!name.trim()) {
      setMsg("Informe o nome do cliente.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const payload = {
        company_id: companyId,
        name: name.trim(),
        legal_name: legalName.trim() || null,
        document: document.trim() || null,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        notes: notes.trim() || null,
        active,
      };

      if (editingId) {
        const res = await supabase.from("project_clients").update(payload).eq("id", editingId);
        if (res.error) throw res.error;
        setMsg("Cliente atualizado.");
      } else {
        const res = await supabase.from("project_clients").insert(payload);
        if (res.error) throw res.error;
        setMsg("Cliente cadastrado.");
      }

      startNew();
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
              <Building2 size={18} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Diretoria - Clientes</h1>
              <p className="mt-1 text-sm text-slate-600">Cadastro central de clientes para selecao no modulo de projetos.</p>
            </div>
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

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">{editingId ? "Editar cliente" : "Novo cliente"}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Empresa
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
              <option value="">Selecione a empresa...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div />
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Nome fantasia
            <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Razao social
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            CNPJ/Documento
            <input value={document} onChange={(e) => setDocument(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Contato
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            E-mail contato
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Telefone contato
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">
            Observacoes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[90px] rounded-xl border border-slate-200 p-3 text-sm" />
          </label>
        </div>

        <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Cliente ativo
        </label>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void saveClient()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Salvando..." : "Salvar cliente"}
          </button>
          <button type="button" onClick={startNew} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            Limpar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Clientes cadastrados ({clients.length})</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Empresa</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Documento</th>
                <th className="p-3">Contato</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Acao</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    Carregando...
                  </td>
                </tr>
              ) : clients.length ? (
                clients.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-3">{(c.company_id && companyNameById.get(c.company_id)) || "-"}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.legal_name || "-"}</div>
                    </td>
                    <td className="p-3">{c.document || "-"}</td>
                    <td className="p-3">{c.contact_name || c.contact_email || "-"}</td>
                    <td className="p-3">{c.active ? "Ativo" : "Inativo"}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    Nenhum cliente cadastrado.
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

