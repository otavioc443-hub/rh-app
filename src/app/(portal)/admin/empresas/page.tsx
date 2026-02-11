"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Building2,
  Plus,
  Save,
  Trash2,
  Search,
  RefreshCcw,
  Layers,
  Pencil,
  X,
  Image as ImageIcon,
} from "lucide-react";

type Role = "colaborador" | "rh" | "admin";

type Company = {
  id: string;
  name: string;
  cnpj: string | null;

  razao_social: string | null;
  nome_fantasia: string | null;
  ie: string | null;
  email: string | null;
  telefone: string | null;

  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;

  logo_url: string | null;
  primary_color: string | null;

  created_at: string | null;
};

type Department = {
  id: string;
  company_id: string;
  name: string;
  created_at: string | null;
  parent_department_id: string | null;
  head_id: string | null;
};

type DeptMode = "departamento" | "setor";

const LOGO_BUCKET = "company-logos";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function formatCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function fileExt(filename: string) {
  const parts = filename.split(".");
  return (parts[parts.length - 1] || "").toLowerCase();
}

export default function AdminEmpresasPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [meRole, setMeRole] = useState<Role | null>(null);

  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [q, setQ] = useState("");

  const [selectedCnpj, setSelectedCnpj] = useState<string>("");

  // departamentos / setores
  const [departments, setDepartments] = useState<Department[]>([]);
  const [savingDept, setSavingDept] = useState(false);
  const [deptMode, setDeptMode] = useState<DeptMode>("departamento");
  const [deptName, setDeptName] = useState("");
  const [deptParentId, setDeptParentId] = useState<string>("");

  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [editDeptParentId, setEditDeptParentId] = useState<string>("");

  // empresa
  const [editingId, setEditingId] = useState<string | null>(null);

  const [cnpj, setCnpj] = useState("");
  const [name, setName] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [ie, setIe] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  // upload logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>(""); // blob:... ou URL do banco
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [primaryColor, setPrimaryColor] = useState("#111827");
  const [savingCompany, setSavingCompany] = useState(false);

  // =========================
  // Guard
  // =========================
  useEffect(() => {
    let alive = true;

    async function guard() {
      setMsg("");
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;

      if (!user) {
        router.replace("/");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .maybeSingle();

      if (!alive) return;

      if (error || !profile) {
        setMsg("Não foi possível validar seu perfil. Verifique as policies (RLS).");
        router.replace("/home");
        return;
      }

      if (!profile.active) {
        setMsg("Seu usuário está inativo. Procure um administrador.");
        router.replace("/home");
        return;
      }

      const role = profile.role as Role;
      setMeRole(role);

      if (role !== "admin") {
        router.replace("/unauthorized");
        return;
      }

      setChecking(false);
    }

    guard();

    return () => {
      alive = false;
    };
  }, [router]);

  // =========================
  // Loads
  // =========================
  async function loadCompanies() {
    setLoading(true);
    setMsg("");

    const { data, error } = await supabase
      .from("companies")
      .select(
        "id,name,cnpj,razao_social,nome_fantasia,ie,email,telefone,cep,logradouro,numero,complemento,bairro,cidade,estado,logo_url,primary_color,created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMsg(`Erro ao carregar empresas: ${error.message}`);
      setCompanies([]);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as Company[];
    setCompanies(list);

    setSelectedCnpj((prev) => {
      const prevNorm = onlyDigits(prev);
      if (prevNorm && list.some((c) => (c.cnpj ?? "") === prevNorm)) return prevNorm;
      const first = list.find((c) => (c.cnpj ?? "").length === 14)?.cnpj ?? "";
      return first || "";
    });

    setLoading(false);
  }

  async function getCompanyIdByCnpj(inputCnpj: string) {
    const normalized = onlyDigits(inputCnpj);
    if (normalized.length !== 14) return null;

    const { data, error } = await supabase
      .from("companies")
      .select("id")
      .eq("cnpj", normalized)
      .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
  }

  async function loadDepartmentsByCnpj(inputCnpj: string) {
    setMsg("");
    const companyId = await getCompanyIdByCnpj(inputCnpj);

    if (!companyId) {
      setDepartments([]);
      setDeptParentId("");
      setEditingDeptId(null);
      return;
    }

    const { data, error } = await supabase
      .from("departments")
      .select("id,company_id,name,created_at,parent_department_id,head_id")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMsg(`Erro ao carregar departamentos: ${error.message}`);
      setDepartments([]);
      setDeptParentId("");
      setEditingDeptId(null);
      return;
    }

    setDepartments((data ?? []) as Department[]);
  }

  useEffect(() => {
    if (!checking && meRole === "admin") {
      loadCompanies();
    }
  }, [checking, meRole]);

  useEffect(() => {
    if (onlyDigits(selectedCnpj).length === 14) loadDepartmentsByCnpj(selectedCnpj);
    else {
      setDepartments([]);
      setDeptParentId("");
      setEditingDeptId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCnpj]);

  // =========================
  // filtros
  // =========================
  const filteredCompanies = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return companies;

    const termDigits = onlyDigits(term);

    return companies.filter((c) => {
      const cnpjTxt = (c.cnpj ?? "").toLowerCase();
      const n = (c.name ?? "").toLowerCase();
      const rs = (c.razao_social ?? "").toLowerCase();
      const nf = (c.nome_fantasia ?? "").toLowerCase();

      return (
        (termDigits && cnpjTxt.includes(termDigits)) ||
        n.includes(term) ||
        rs.includes(term) ||
        nf.includes(term)
      );
    });
  }, [q, companies]);

  const topDepartments = useMemo(
    () => departments.filter((d) => !d.parent_department_id),
    [departments]
  );

  // =========================
  // Upload logo
  // =========================
  useEffect(() => {
    return () => {
      if (logoPreviewUrl && logoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  function onPickLogo(file: File | null) {
    setMsg("");

    if (!file) {
      setLogoFile(null);
      setLogoPreviewUrl("");
      return;
    }

    const ext = fileExt(file.name);
    const isImage = file.type.startsWith("image/");

    if (!isImage) {
      setMsg("Arquivo inválido. Envie uma imagem.");
      return;
    }

    if (ext !== "png") {
      setMsg("Envie a logo em PNG (.png).");
      return;
    }

    const max = 2 * 1024 * 1024;
    if (file.size > max) {
      setMsg("Arquivo muito grande. Use até 2MB (PNG).");
      return;
    }

    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
  }

  async function uploadLogoIfNeeded(normalizedCnpj: string): Promise<string | null> {
    if (!logoFile) return null;

    setUploadingLogo(true);
    try {
      const path = `${normalizedCnpj}/logo.png`;

      const { error: upErr } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, logoFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/png",
        });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      return data?.publicUrl ?? null;
    } finally {
      setUploadingLogo(false);
    }
  }

  // =========================
  // Helpers
  // =========================
  function resetCompanyForm() {
    setEditingId(null);

    setCnpj("");
    setName("");
    setRazaoSocial("");
    setNomeFantasia("");
    setIe("");
    setEmail("");
    setTelefone("");

    setCep("");
    setLogradouro("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setEstado("");

    setLogoFile(null);
    setLogoPreviewUrl("");

    setPrimaryColor("#111827");
  }

  function startEditCompany(c: Company) {
    setEditingId(c.id);

    setCnpj(formatCnpj(c.cnpj ?? ""));
    setName(c.name ?? "");
    setRazaoSocial(c.razao_social ?? "");
    setNomeFantasia(c.nome_fantasia ?? "");
    setIe(c.ie ?? "");
    setEmail(c.email ?? "");
    setTelefone(c.telefone ?? "");

    setCep(c.cep ?? "");
    setLogradouro(c.logradouro ?? "");
    setNumero(c.numero ?? "");
    setComplemento(c.complemento ?? "");
    setBairro(c.bairro ?? "");
    setCidade(c.cidade ?? "");
    setEstado(c.estado ?? "");

    setLogoFile(null);
    setLogoPreviewUrl(c.logo_url ?? "");

    setPrimaryColor(c.primary_color ?? "#111827");
  }

  function resetDeptCreateForm() {
    setDeptName("");
    setDeptParentId("");
    setDeptMode("departamento");
  }

  // =========================
  // CRUD empresa
  // =========================
  async function saveCompany() {
    setMsg("");

    const normalizedCnpj = onlyDigits(cnpj);
    if (normalizedCnpj.length !== 14) {
      setMsg("Informe um CNPJ válido (14 dígitos).");
      return;
    }

    if (!name.trim()) {
      setMsg("Informe o Nome (curto no Portal) da empresa.");
      return;
    }

    setSavingCompany(true);

    try {
      const uploadedLogoUrl = await uploadLogoIfNeeded(normalizedCnpj);

      const payload = {
        cnpj: normalizedCnpj,
        name: name.trim(),
        razao_social: razaoSocial.trim() || null,
        nome_fantasia: nomeFantasia.trim() || null,
        ie: ie.trim() || null,
        email: email.trim() || null,
        telefone: telefone.trim() || null,

        cep: cep.trim() || null,
        logradouro: logradouro.trim() || null,
        numero: numero.trim() || null,
        complemento: complemento.trim() || null,
        bairro: bairro.trim() || null,
        cidade: cidade.trim() || null,
        estado: estado.trim() || null,

        // compatível com o resto do portal
        logo_url: uploadedLogoUrl ?? (logoPreviewUrl || null),
        primary_color: primaryColor.trim() || "#111827",
      };

      if (editingId) {
        const { error } = await supabase.from("companies").update(payload).eq("id", editingId);
        if (error) throw error;
        setMsg("Empresa atualizada com sucesso.");
      } else {
        const { error } = await supabase.from("companies").insert(payload);
        if (error) throw error;
        setMsg("Empresa cadastrada com sucesso.");
      }

      resetCompanyForm();
      await loadCompanies();
      setSelectedCnpj(normalizedCnpj);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar empresa.");
    } finally {
      setSavingCompany(false);
    }
  }

  async function deleteCompany(id: string, cnpjValue: string | null) {
    const ok = window.confirm("Excluir esta empresa?");
    if (!ok) return;

    setMsg("");
    try {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;

      setMsg("Empresa removida.");
      if (cnpjValue && onlyDigits(selectedCnpj) === (cnpjValue ?? "")) setSelectedCnpj("");
      await loadCompanies();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir empresa.");
    }
  }

  // =========================
  // CRUD departamentos/setores
  // =========================
  async function addDepartmentOrSector() {
    setMsg("");

    const normalizedCnpj = onlyDigits(selectedCnpj);
    if (normalizedCnpj.length !== 14) {
      setMsg("Selecione uma empresa (CNPJ) para cadastrar.");
      return;
    }

    const companyId = await getCompanyIdByCnpj(normalizedCnpj);
    if (!companyId) {
      setMsg("Empresa não encontrada para o CNPJ selecionado.");
      return;
    }

    const nameValue = deptName.trim();
    if (!nameValue) {
      setMsg(deptMode === "setor" ? "Informe o nome do setor." : "Informe o nome do departamento.");
      return;
    }

    if (deptMode === "setor" && !deptParentId) {
      setMsg("Para cadastrar um setor, selecione o Departamento pai.");
      return;
    }

    const parentId = deptMode === "setor" ? deptParentId : null;

    setSavingDept(true);
    try {
      const { error } = await supabase.from("departments").insert({
        company_id: companyId,
        name: nameValue,
        parent_department_id: parentId,
      });
      if (error) throw error;

      setMsg(deptMode === "setor" ? "Setor cadastrado." : "Departamento cadastrado.");
      resetDeptCreateForm();
      await loadDepartmentsByCnpj(normalizedCnpj);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao cadastrar.");
    } finally {
      setSavingDept(false);
    }
  }

  function startEditDept(d: Department) {
    setEditingDeptId(d.id);
    setEditDeptName(d.name);
    setEditDeptParentId(d.parent_department_id ?? "");
  }

  function cancelEditDept() {
    setEditingDeptId(null);
    setEditDeptName("");
    setEditDeptParentId("");
  }

  async function saveEditDept(d: Department) {
    setMsg("");

    const normalizedCnpj = onlyDigits(selectedCnpj);
    if (normalizedCnpj.length !== 14) {
      setMsg("Selecione uma empresa (CNPJ) para editar.");
      return;
    }

    const newName = editDeptName.trim();
    if (!newName) {
      setMsg("Informe um nome válido.");
      return;
    }

    if (editDeptParentId && editDeptParentId === d.id) {
      setMsg("Um item não pode ser pai dele mesmo.");
      return;
    }

    if (editDeptParentId) {
      const parent = topDepartments.find((x) => x.id === editDeptParentId);
      if (!parent) {
        setMsg("O pai selecionado deve ser um Departamento de topo.");
        return;
      }
    }

    setSavingDept(true);
    try {
      const { error } = await supabase
        .from("departments")
        .update({
          name: newName,
          parent_department_id: editDeptParentId || null,
        })
        .eq("id", d.id);

      if (error) throw error;

      setMsg("Atualizado com sucesso.");
      cancelEditDept();
      await loadDepartmentsByCnpj(normalizedCnpj);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar.");
    } finally {
      setSavingDept(false);
    }
  }

  async function deleteDept(id: string) {
    const ok = window.confirm("Excluir este item?");
    if (!ok) return;

    setMsg("");
    try {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;

      setMsg("Removido.");
      if (onlyDigits(selectedCnpj).length === 14) await loadDepartmentsByCnpj(selectedCnpj);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  if (checking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Validando acesso...</p>
      </div>
    );
  }

  const selectedCompanyName =
    companies.find((c) => (c.cnpj ?? "") === onlyDigits(selectedCnpj))?.name ?? "";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
              <Building2 size={18} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Cadastro de empresas</h1>
              <p className="mt-1 text-sm text-slate-600">
                Cadastre CNPJ, dados cadastrais, endereço e logo (PNG). Gerencie departamentos e setores.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[320px]">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por CNPJ, nome, razão social..."
                className="w-full rounded-xl border border-slate-200 bg-white px-9 py-2 text-sm outline-none focus:border-slate-300"
              />
            </div>

            <button
              onClick={() => loadCompanies()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
              disabled={loading}
            >
              <RefreshCcw size={16} className={cx(loading && "animate-spin")} />
              Atualizar
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {msg}
          </div>
        )}
      </div>

      {/* Seletor por CNPJ + botão novo */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Empresa ativa</p>
            <p className="text-sm text-slate-600">Selecione a empresa pelo CNPJ.</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={onlyDigits(selectedCnpj)}
              onChange={(e) => setSelectedCnpj(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            >
              <option value="">— Selecione por CNPJ —</option>
              {companies
                .filter((c) => (c.cnpj ?? "").length === 14)
                .map((c) => (
                  <option key={c.id} value={c.cnpj ?? ""}>
                    {formatCnpj(c.cnpj ?? "")} — {c.name}
                  </option>
                ))}
            </select>

            <button
              onClick={() => resetCompanyForm()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Plus size={16} />
              Nova empresa
            </button>
          </div>
        </div>
      </div>

      {/* Form cadastro */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-3 md:grid-cols-4">
          {/* CNPJ */}
          <div>
            <label className="block text-xs font-semibold text-slate-600">CNPJ</label>
            <input
              value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          {/* Logo estilo placeholder (como o exemplo) */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600">Logo (PNG)</label>

            <div className="mt-1 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {logoPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreviewUrl}
                    alt="Logo da empresa"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <ImageIcon size={26} />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {logoPreviewUrl ? "Logo selecionada" : "Nenhuma logo"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Envie um arquivo <b>PNG</b> (até 2MB). Recomendado: 512x512.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-95">
                    <ImageIcon size={14} />
                    Selecionar imagem
                    <input
                      type="file"
                      accept="image/png"
                      className="hidden"
                      onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setLogoFile(null);
                      setLogoPreviewUrl("");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <X size={14} />
                    Remover
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cor primária */}
          <div>
            <label className="block text-xs font-semibold text-slate-600">Cor primária</label>
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#111827"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600">
              Nome (curto no Portal)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sólida Energias Renováveis"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600">Razão social</label>
            <input
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="Razão social"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600">Nome fantasia</label>
            <input
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              placeholder="Nome fantasia"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">IE</label>
            <input
              value={ie}
              onChange={(e) => setIe(e.target.value)}
              placeholder="Inscrição estadual"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@empresa.com.br"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">Telefone</label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div className="md:col-span-4 mt-2">
            <p className="text-sm font-semibold text-slate-900">Endereço</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">CEP</label>
            <input
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              placeholder="00000-000"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600">Logradouro</label>
            <input
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
              placeholder="Rua / Avenida"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">Número</label>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Nº"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600">Complemento</label>
            <input
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              placeholder="Sala / Andar / Bloco"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">Bairro</label>
            <input
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              placeholder="Bairro"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">Cidade</label>
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Cidade"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">Estado</label>
            <input
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              placeholder="UF"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={saveCompany}
            disabled={savingCompany || uploadingLogo}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            <Save size={16} />
            {uploadingLogo
              ? "Enviando logo..."
              : savingCompany
              ? "Salvando..."
              : editingId
              ? "Salvar edição"
              : "Cadastrar empresa"}
          </button>

          {editingId && (
            <button
              onClick={() => resetCompanyForm()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Cancelar edição
            </button>
          )}
        </div>
      </div>

      {/* Lista empresas */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <p className="text-sm font-semibold text-slate-900">Empresas ({filteredCompanies.length})</p>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredCompanies.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-2 px-6 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-3">
                {c.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.logo_url}
                    alt="Logo"
                    className="h-9 w-9 rounded-lg border border-slate-200 bg-white object-contain"
                  />
                ) : (
                  <div className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                    <ImageIcon size={16} />
                  </div>
                )}

                <div>
                  <div className="font-medium text-slate-900">
                    {c.name}{" "}
                    <span className="text-xs font-semibold text-slate-500">
                      {c.cnpj ? `— ${formatCnpj(c.cnpj)}` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{c.razao_social ?? c.nome_fantasia ?? ""}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    startEditCompany(c);
                    setSelectedCnpj(c.cnpj ?? "");
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Editar
                </button>

                <button
                  onClick={() => deleteCompany(c.id, c.cnpj)}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 size={14} />
                  Excluir
                </button>
              </div>
            </div>
          ))}

          {filteredCompanies.length === 0 && (
            <div className="px-6 py-10 text-center text-slate-500">Nenhuma empresa encontrada.</div>
          )}
        </div>
      </div>

      {/* Departamentos / Setores */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
            <Layers size={18} />
          </div>

          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Departamentos e Setores</h2>
            <p className="mt-1 text-sm text-slate-600">
              Departamento = topo. Setor = filho (vinculado a um departamento pai).
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600">Tipo</label>
                <select
                  value={deptMode}
                  onChange={(e) => {
                    const next = e.target.value as DeptMode;
                    setDeptMode(next);
                    if (next === "departamento") setDeptParentId("");
                  }}
                  disabled={onlyDigits(selectedCnpj).length !== 14}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300 disabled:opacity-60"
                >
                  <option value="departamento">Departamento (topo)</option>
                  <option value="setor">Setor (filho)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  {deptMode === "setor" ? "Novo setor" : "Novo departamento"}
                </label>
                <input
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder={
                    deptMode === "setor"
                      ? "Ex: Obras, Projetos, Folha..."
                      : "Ex: Diretoria, RH, Engenharia..."
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                  disabled={onlyDigits(selectedCnpj).length !== 14}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600">
                  Departamento pai {deptMode === "setor" ? "(obrigatório)" : "(opcional)"}
                </label>
                <select
                  value={deptParentId}
                  onChange={(e) => setDeptParentId(e.target.value)}
                  disabled={onlyDigits(selectedCnpj).length !== 14 || deptMode === "departamento"}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300 disabled:opacity-60"
                >
                  <option value="">— Sem pai (topo) —</option>
                  {topDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4 flex items-end">
                <button
                  onClick={addDepartmentOrSector}
                  disabled={savingDept || onlyDigits(selectedCnpj).length !== 14}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                >
                  <Plus size={16} />
                  {savingDept ? "Salvando..." : deptMode === "setor" ? "Adicionar setor" : "Adicionar departamento"}
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                Itens ({departments.length}) {selectedCompanyName ? `— ${selectedCompanyName}` : ""}
              </div>

              <div className="divide-y divide-slate-200">
                {departments.map((d) => {
                  const isSector = !!d.parent_department_id;
                  const parentName = isSector
                    ? topDepartments.find((x) => x.id === d.parent_department_id)?.name ?? "—"
                    : null;

                  const isEditing = editingDeptId === d.id;

                  return (
                    <div key={d.id} className="px-4 py-3">
                      {!isEditing && (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">
                              {d.name}{" "}
                              <span
                                className={cx(
                                  "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
                                  isSector ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"
                                )}
                              >
                                {isSector ? "Setor" : "Departamento"}
                              </span>
                            </div>
                            {parentName && <div className="text-xs text-slate-500">Pai: {parentName}</div>}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEditDept(d)}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              <Pencil size={14} />
                              Editar
                            </button>

                            <button
                              onClick={() => deleteDept(d.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              <Trash2 size={14} />
                              Excluir
                            </button>
                          </div>
                        </div>
                      )}

                      {isEditing && (
                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-600">Nome</label>
                            <input
                              value={editDeptName}
                              onChange={(e) => setEditDeptName(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-600">
                              Departamento pai (vazio = topo)
                            </label>
                            <select
                              value={editDeptParentId}
                              onChange={(e) => setEditDeptParentId(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                            >
                              <option value="">— Sem pai (topo) —</option>
                              {topDepartments.filter((p) => p.id !== d.id).map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>

                            <p className="mt-1 text-xs text-slate-500">
                              Com pai vira <b>Setor</b>. Sem pai vira <b>Departamento</b>.
                            </p>
                          </div>

                          <div className="flex items-end gap-2">
                            <button
                              onClick={() => saveEditDept(d)}
                              disabled={savingDept}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                            >
                              <Save size={16} />
                              Salvar
                            </button>

                            <button
                              onClick={cancelEditDept}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              <X size={16} />
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {onlyDigits(selectedCnpj).length !== 14 && (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    Selecione uma empresa (CNPJ) para ver/cadastrar departamentos e setores.
                  </div>
                )}

                {onlyDigits(selectedCnpj).length === 14 && departments.length === 0 && (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    Nenhum departamento/setor cadastrado para esta empresa.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Dica: crie primeiro os <b>Departamentos</b> e depois os <b>Setores</b>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
