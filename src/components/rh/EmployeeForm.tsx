"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type ColaboradorPayload = {
  // vínculo portal
  empresa?: string;
  departamento?: string;
  setor?: string;

  // planilha
  nome?: string;
  matricula?: string;
  data_nascimento?: string | null;
  sexo?: string;
  estado_civil?: string;
  saudacao?: string;
  nacionalidade?: string;
  naturalidade?: string;
  etnia?: string;
  nome_pai?: string;
  nome_mae?: string;
  pne?: boolean | string;

  data_admissao?: string | null;
  data_demissao?: string | null;
  motivo_demissao?: string;
  valor_rescisao?: string;

  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;

  telefone?: string;
  celular?: string;
  telefone_emergencia?: string;
  email_pessoal?: string;
  email_empresarial?: string;

  cargo?: string;
  cbo?: string;
  salario?: string;
  turno?: string;
  moeda?: string;
  tipo_contrato?: string;
  data_contrato?: string | null;
  escolaridade?: string;
  superior_direto?: string;
  email_superior_direto?: string;
  grau_hierarquico?: string;
  duracao_contrato?: string;
  vencimento_contrato?: string | null;

  email?: string;
  cpf?: string;
  rg?: string;
  titulo_eleitor?: string;
  zona_eleitoral?: string;
  secao_eleitoral?: string;
  ctps_num?: string;
  ctps_serie?: string;
  reservista?: string;
  cnh?: string;

  banco?: string;
  agencia?: string;
  conta_corrente?: string;
  pis?: string;

  sistema?: string;
  id_colaborador_externo?: string;
  id_departamento_externo?: string;
  id_cargo_externo?: string;
  unidade?: string;
  id_unidade_externo?: string;

  [key: string]: any;
};

type Props = {
  initial?: Partial<ColaboradorPayload>;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (payload: ColaboradorPayload) => void | Promise<void>;
};

type Company = { id: string; name: string; cnpj: string | null };
type Department = { id: string; company_id: string; name: string; parent_department_id: string | null };

type CargoRow = { id: string; name: string; cbo: string | null };
type ColabRow = { id: string; nome: string | null; email: string | null; cargo: string | null; cpf: string | null };

function digits(v: string) {
  return (v ?? "").replace(/\D/g, "");
}
function formatCnpj(cnpj?: string | null) {
  const d = digits(cnpj ?? "");
  if (d.length !== 14) return cnpj ?? "";
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*$/, "$1.$2.$3/$4-$5");
}

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Section({ title, subtitle, children }: any) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="text-base font-semibold text-slate-900">{title}</div>
      {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({ label, required, children, helper }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600">
        {label} {required ? <span className="text-rose-600">*</span> : null}
      </label>
      <div className="mt-1">{children}</div>
      {helper ? <div className="mt-1 text-xs text-slate-500">{helper}</div> : null}
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

export default function EmployeeForm({
  initial,
  submitting = false,
  submitLabel = "Salvar colaborador",
  onSubmit,
}: Props) {
  // ========= Planilha (state) =========
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [matricula, setMatricula] = useState(initial?.matricula ?? "");
  const [dataNascimento, setDataNascimento] = useState<string>(initial?.data_nascimento ?? "");
  const [sexo, setSexo] = useState(initial?.sexo ?? "");
  const [estadoCivil, setEstadoCivil] = useState(initial?.estado_civil ?? "");
  const [saudacao, setSaudacao] = useState(initial?.saudacao ?? "");
  const [nacionalidade, setNacionalidade] = useState(initial?.nacionalidade ?? "");
  const [naturalidade, setNaturalidade] = useState(initial?.naturalidade ?? "");
  const [etnia, setEtnia] = useState(initial?.etnia ?? "");
  const [nomePai, setNomePai] = useState(initial?.nome_pai ?? "");
  const [nomeMae, setNomeMae] = useState(initial?.nome_mae ?? "");
  const [pne, setPne] = useState<string>(() => {
    const v: any = initial?.pne;
    if (typeof v === "boolean") return v ? "sim" : "nao";
    const s = String(v ?? "").toLowerCase();
    if (s === "sim" || s === "true" || s === "1") return "sim";
    if (s === "não" || s === "nao" || s === "false" || s === "0") return "nao";
    return "";
  });

  const [dataAdmissao, setDataAdmissao] = useState<string>(initial?.data_admissao ?? "");
  const [dataDemissao, setDataDemissao] = useState<string>(initial?.data_demissao ?? "");
  const [motivoDemissao, setMotivoDemissao] = useState(initial?.motivo_demissao ?? "");
  const [valorRescisao, setValorRescisao] = useState(initial?.valor_rescisao ?? "");

  const [cep, setCep] = useState(initial?.cep ?? "");
  const [logradouro, setLogradouro] = useState(initial?.logradouro ?? "");
  const [numero, setNumero] = useState(initial?.numero ?? "");
  const [complemento, setComplemento] = useState(initial?.complemento ?? "");
  const [bairro, setBairro] = useState(initial?.bairro ?? "");
  const [cidade, setCidade] = useState(initial?.cidade ?? "");

  const [telefone, setTelefone] = useState(initial?.telefone ?? "");
  const [celular, setCelular] = useState(initial?.celular ?? "");
  const [telefoneEmergencia, setTelefoneEmergencia] = useState(initial?.telefone_emergencia ?? "");
  const [emailPessoal, setEmailPessoal] = useState(initial?.email_pessoal ?? "");
  const [emailEmpresarial, setEmailEmpresarial] = useState(initial?.email_empresarial ?? "");

  // ✅ Cargo (agora vem de tabela + opção digitar)
  const [cargo, setCargo] = useState(initial?.cargo ?? "");
  const [cargoMode, setCargoMode] = useState<"select" | "manual">("select");

  const [cbo, setCbo] = useState(initial?.cbo ?? "");
  const [salario, setSalario] = useState(initial?.salario ?? "");
  const [turno, setTurno] = useState(initial?.turno ?? "");
  const [moeda, setMoeda] = useState(initial?.moeda ?? "");
  const [tipoContrato, setTipoContrato] = useState(initial?.tipo_contrato ?? "");
  const [dataContrato, setDataContrato] = useState<string>(initial?.data_contrato ?? "");
  const [escolaridade, setEscolaridade] = useState(initial?.escolaridade ?? "");

  // ✅ Superior direto (agora lista de colaboradores)
  const [superiorDireto, setSuperiorDireto] = useState(initial?.superior_direto ?? "");
  const [emailSuperiorDireto, setEmailSuperiorDireto] = useState(initial?.email_superior_direto ?? "");

  const [grauHierarquico, setGrauHierarquico] = useState(initial?.grau_hierarquico ?? "");
  const [duracaoContrato, setDuracaoContrato] = useState(initial?.duracao_contrato ?? "");
  const [vencimentoContrato, setVencimentoContrato] = useState<string>(initial?.vencimento_contrato ?? "");

  const [email, setEmail] = useState(initial?.email ?? "");
  const [cpf, setCpf] = useState(initial?.cpf ?? "");
  const [rg, setRg] = useState(initial?.rg ?? "");
  const [tituloEleitor, setTituloEleitor] = useState(initial?.titulo_eleitor ?? "");
  const [zonaEleitoral, setZonaEleitoral] = useState(initial?.zona_eleitoral ?? "");
  const [secaoEleitoral, setSecaoEleitoral] = useState(initial?.secao_eleitoral ?? "");
  const [ctpsNum, setCtpsNum] = useState(initial?.ctps_num ?? "");
  const [ctpsSerie, setCtpsSerie] = useState(initial?.ctps_serie ?? "");
  const [reservista, setReservista] = useState(initial?.reservista ?? "");
  const [cnh, setCnh] = useState(initial?.cnh ?? "");

  const [banco, setBanco] = useState(initial?.banco ?? "");
  const [agencia, setAgencia] = useState(initial?.agencia ?? "");
  const [contaCorrente, setContaCorrente] = useState(initial?.conta_corrente ?? "");
  const [pis, setPis] = useState(initial?.pis ?? "");

  const [sistema, setSistema] = useState(initial?.sistema ?? "");
  const [idColabExt, setIdColabExt] = useState(initial?.id_colaborador_externo ?? "");
  const [idDepExt, setIdDepExt] = useState(initial?.id_departamento_externo ?? "");
  const [idCargoExt, setIdCargoExt] = useState(initial?.id_cargo_externo ?? "");
  const [unidade, setUnidade] = useState(initial?.unidade ?? "");
  const [idUnidadeExt, setIdUnidadeExt] = useState(initial?.id_unidade_externo ?? "");

  // ========= vínculo portal (selects dinâmicos) =========
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  const [companyId, setCompanyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [sectorId, setSectorId] = useState("");

  // ========= NOVO: cargos e colaboradores =========
  const [cargos, setCargos] = useState<CargoRow[]>([]);
  const [colabs, setColabs] = useState<ColabRow[]>([]);
  const [loadingCargos, setLoadingCargos] = useState(true);
  const [loadingColabs, setLoadingColabs] = useState(true);

  const [msg, setMsg] = useState("");

  // carrega empresas
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingCompanies(true);
      const { data, error } = await supabase.from("companies").select("id,name,cnpj").order("name", { ascending: true });
      if (!alive) return;
      if (error) {
        setCompanies([]);
        setMsg(`❌ Erro ao carregar empresas: ${error.message}`);
      } else {
        setCompanies((data ?? []) as Company[]);
      }
      setLoadingCompanies(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // carrega cargos
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingCargos(true);
      const { data, error } = await supabase.from("cargos").select("id,name,cbo").order("name", { ascending: true });
      if (!alive) return;
      if (error) {
        setCargos([]);
        setMsg((p) => p || `❌ Erro ao carregar cargos: ${error.message}`);
      } else {
        setCargos((data ?? []) as CargoRow[]);
      }
      setLoadingCargos(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // carrega colaboradores para superior direto
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingColabs(true);
      // puxa apenas o necessário (fica leve)
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id,nome,email,cargo,cpf")
        .order("nome", { ascending: true })
        .limit(2000);

      if (!alive) return;

      if (error) {
        setColabs([]);
        setMsg((p) => p || `❌ Erro ao carregar colaboradores: ${error.message}`);
      } else {
        setColabs((data ?? []) as ColabRow[]);
      }
      setLoadingColabs(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // tenta preselecionar empresa pelo texto salvo
  useEffect(() => {
    if (!companies.length) return;
    const empresaTxt = (initial?.empresa ?? "").trim().toLowerCase();
    if (!empresaTxt) return;
    const found = companies.find((c) => c.name.trim().toLowerCase() === empresaTxt);
    if (found) setCompanyId(found.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies.length]);

  // carrega departments por empresa
  useEffect(() => {
    let alive = true;

    async function loadDeps(company_id: string) {
      setLoadingDepartments(true);
      const { data, error } = await supabase
        .from("departments")
        .select("id,company_id,name,parent_department_id")
        .eq("company_id", company_id)
        .order("name", { ascending: true });

      if (!alive) return;

      if (error) {
        setDepartments([]);
        setMsg((p) => p || `❌ Erro ao carregar departamentos: ${error.message}`);
      } else {
        setDepartments((data ?? []) as Department[]);
      }
      setLoadingDepartments(false);
    }

    if (!companyId) {
      setDepartments([]);
      setDepartmentId("");
      setSectorId("");
      return;
    }

    setDepartmentId("");
    setSectorId("");
    loadDeps(companyId);

    return () => {
      alive = false;
    };
  }, [companyId]);

  const topDepartments = useMemo(() => departments.filter((d) => d.parent_department_id === null), [departments]);
  const sectorsOfDepartment = useMemo(() => {
    if (!departmentId) return [];
    return departments.filter((d) => d.parent_department_id === departmentId);
  }, [departments, departmentId]);

  // quando selecionar cargo do select -> se cargo tem CBO, preenche o campo cbo (editável)
  const cargoByName = useMemo(() => {
    const map = new Map<string, CargoRow>();
    cargos.forEach((c) => map.set((c.name ?? "").toLowerCase(), c));
    return map;
  }, [cargos]);

  useEffect(() => {
    if (!cargo || cargoMode !== "select") return;
    const row = cargoByName.get(cargo.trim().toLowerCase());
    if (row?.cbo && !cbo) setCbo(row.cbo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargo, cargoMode]);

  // quando selecionar superior -> preencher email_superior_direto
  const colabByName = useMemo(() => {
    const map = new Map<string, ColabRow>();
    colabs.forEach((c) => {
      const n = (c.nome ?? "").trim().toLowerCase();
      if (n) map.set(n, c);
    });
    return map;
  }, [colabs]);

  useEffect(() => {
    if (!superiorDireto) return;
    const row = colabByName.get(superiorDireto.trim().toLowerCase());
    if (row?.email) setEmailSuperiorDireto(row.email);
  }, [superiorDireto, colabByName]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    const company = companies.find((c) => c.id === companyId);
    const dep = departments.find((d) => d.id === departmentId);
    const setor = departments.find((d) => d.id === sectorId);

    const payload: ColaboradorPayload = {
      empresa: company?.name ?? "",
      departamento: dep?.name ?? "",
      setor: setor?.name ?? "",

      nome,
      matricula,
      data_nascimento: dataNascimento || null,
      sexo,
      estado_civil: estadoCivil,
      saudacao,
      nacionalidade,
      naturalidade,
      etnia,
      nome_pai: nomePai,
      nome_mae: nomeMae,
      pne: pne === "" ? "" : pne === "sim",

      data_admissao: dataAdmissao || null,
      data_demissao: dataDemissao || null,
      motivo_demissao: motivoDemissao,
      valor_rescisao: valorRescisao,

      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,

      telefone,
      celular,
      telefone_emergencia: telefoneEmergencia,
      email_pessoal: emailPessoal,
      email_empresarial: emailEmpresarial,

      cargo,
      cbo,
      salario,
      turno,
      moeda,
      tipo_contrato: tipoContrato,
      data_contrato: dataContrato || null,
      escolaridade,
      superior_direto: superiorDireto,
      email_superior_direto: emailSuperiorDireto,
      grau_hierarquico: grauHierarquico,
      duracao_contrato: duracaoContrato,
      vencimento_contrato: vencimentoContrato || null,

      email,
      cpf,
      rg,
      titulo_eleitor: tituloEleitor,
      zona_eleitoral: zonaEleitoral,
      secao_eleitoral: secaoEleitoral,
      ctps_num: ctpsNum,
      ctps_serie: ctpsSerie,
      reservista,
      cnh,

      banco,
      agencia,
      conta_corrente: contaCorrente,
      pis,

      sistema,
      id_colaborador_externo: idColabExt,
      id_departamento_externo: idDepExt,
      id_cargo_externo: idCargoExt,
      unidade,
      id_unidade_externo: idUnidadeExt,

      ...(initial ?? {}),
    };

    await onSubmit(payload);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {msg ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{msg}</div>
      ) : null}

      {/* VÍNCULO NO PORTAL */}
      <Section title="Vínculo no Portal" subtitle="Selecione empresa, departamento e setor já cadastrados.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Empresa" required>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={loadingCompanies}
              className={inputCls}
            >
              <option value="">{loadingCompanies ? "Carregando empresas..." : "— Selecione a empresa —"}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cnpj ? `${formatCnpj(c.cnpj)} — ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Departamento" required>
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setSectorId("");
              }}
              disabled={!companyId || loadingDepartments}
              className={inputCls}
            >
              <option value="">
                {!companyId ? "Selecione uma empresa primeiro" : loadingDepartments ? "Carregando..." : "— Selecione —"}
              </option>
              {topDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="md:col-span-2">
            <Field label="Setor">
              <select value={sectorId} onChange={(e) => setSectorId(e.target.value)} disabled={!departmentId} className={inputCls}>
                <option value="">{!departmentId ? "Selecione um departamento" : "— Selecione o setor —"}</option>
                {sectorsOfDepartment.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </Section>

      {/* DADOS PESSOAIS */}
      <Section title="Dados pessoais" subtitle="Campos conforme a planilha de colaboradores.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Nome" required>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} placeholder="Nome*" />
          </Field>
          <Field label="Matrícula">
            <input value={matricula} onChange={(e) => setMatricula(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Data de Nascimento" required>
            <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Sexo" required>
            <input value={sexo} onChange={(e) => setSexo(e.target.value)} className={inputCls} placeholder="Sexo*" />
          </Field>
          <Field label="Estado Civil">
            <input value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Saudação">
            <input value={saudacao} onChange={(e) => setSaudacao(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Nacionalidade">
            <input value={nacionalidade} onChange={(e) => setNacionalidade(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Naturalidade">
            <input value={naturalidade} onChange={(e) => setNaturalidade(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Etnia">
            <input value={etnia} onChange={(e) => setEtnia(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Nome do Pai">
            <input value={nomePai} onChange={(e) => setNomePai(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Nome da mãe">
            <input value={nomeMae} onChange={(e) => setNomeMae(e.target.value)} className={inputCls} />
          </Field>
          <Field label="PNE">
            <select value={pne} onChange={(e) => setPne(e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* CONTRATO / EMPREGO */}
      <Section title="Contrato e emprego">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Data de admissão" required>
            <input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Data de demissão">
            <input type="date" value={dataDemissao} onChange={(e) => setDataDemissao(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Motivo da demissão">
            <input value={motivoDemissao} onChange={(e) => setMotivoDemissao(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Valor da Rescisão">
            <input value={valorRescisao} onChange={(e) => setValorRescisao(e.target.value)} className={inputCls} />
          </Field>

          {/* ✅ CARGO (select + opção digitar) */}
          <div className="md:col-span-2">
            <Field label="Cargo" required helper="Selecione um cargo cadastrado ou mude para 'Digitar manualmente'.">
              <div className="grid gap-3 md:grid-cols-3">
                <select
                  value={cargoMode}
                  onChange={(e) => {
                    const v = e.target.value as "select" | "manual";
                    setCargoMode(v);
                    if (v === "select") {
                      // mantém cargo atual
                    }
                  }}
                  className={inputCls}
                >
                  <option value="select">Selecionar</option>
                  <option value="manual">Digitar manualmente</option>
                </select>

                {cargoMode === "select" ? (
                  <select
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    disabled={loadingCargos}
                    className={cx(inputCls, "md:col-span-2")}
                  >
                    <option value="">{loadingCargos ? "Carregando cargos..." : "— Selecione um cargo —"}</option>
                    {cargos.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    className={cx(inputCls, "md:col-span-2")}
                    placeholder="Cargo*"
                  />
                )}
              </div>
            </Field>
          </div>

          <Field label="CBO" helper="Se o cargo cadastrado tiver CBO, ele preenche automaticamente (você pode editar).">
            <input value={cbo} onChange={(e) => setCbo(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Salário">
            <input value={salario} onChange={(e) => setSalario(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Turno">
            <input value={turno} onChange={(e) => setTurno(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Moeda">
            <input value={moeda} onChange={(e) => setMoeda(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Tipo de contrato">
            <input value={tipoContrato} onChange={(e) => setTipoContrato(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Data do contrato">
            <input type="date" value={dataContrato} onChange={(e) => setDataContrato(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Escolaridade">
            <input value={escolaridade} onChange={(e) => setEscolaridade(e.target.value)} className={inputCls} />
          </Field>

          {/* ✅ SUPERIOR DIRETO (select de colaboradores) */}
          <Field
            label="Superior direto"
            helper="Selecione um colaborador já cadastrado para montar o organograma. (Preenche e-mail automaticamente.)"
          >
            <select
              value={superiorDireto}
              onChange={(e) => setSuperiorDireto(e.target.value)}
              disabled={loadingColabs}
              className={inputCls}
            >
              <option value="">{loadingColabs ? "Carregando colaboradores..." : "— Selecione —"}</option>
              {colabs.map((c) => {
                const n = (c.nome ?? "").trim();
                if (!n) return null;
                const extra = [c.cargo ? ` • ${c.cargo}` : null, c.email ? ` • ${c.email}` : null].filter(Boolean).join("");
                return (
                  <option key={c.id} value={n}>
                    {n}
                    {extra}
                  </option>
                );
              })}
            </select>
          </Field>

          <Field label="Email superior direto">
            <input
              value={emailSuperiorDireto}
              onChange={(e) => setEmailSuperiorDireto(e.target.value)}
              className={inputCls}
              placeholder="email@empresa.com"
            />
          </Field>

          <Field label="Grau hierárquico">
            <input value={grauHierarquico} onChange={(e) => setGrauHierarquico(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Duração do contrato">
            <input value={duracaoContrato} onChange={(e) => setDuracaoContrato(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Vencimento do contrato">
            <input
              type="date"
              value={vencimentoContrato}
              onChange={(e) => setVencimentoContrato(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* CONTATOS */}
      <Section title="Contatos">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Telefone">
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Celular">
            <input value={celular} onChange={(e) => setCelular(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Telefone de emergência">
            <input value={telefoneEmergencia} onChange={(e) => setTelefoneEmergencia(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Email pessoal">
            <input value={emailPessoal} onChange={(e) => setEmailPessoal(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email empresarial">
            <input value={emailEmpresarial} onChange={(e) => setEmailEmpresarial(e.target.value)} className={inputCls} />
          </Field>

          <Field label="E-mail (portal)" required>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="E-mail*" />
          </Field>
        </div>
      </Section>

      {/* ENDEREÇO */}
      <Section title="Endereço">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="CEP">
            <input value={cep} onChange={(e) => setCep(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Logradouro">
            <input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Número">
            <input value={numero} onChange={(e) => setNumero(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Complemento">
            <input value={complemento} onChange={(e) => setComplemento(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Bairro">
            <input value={bairro} onChange={(e) => setBairro(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Cidade">
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </Section>

      {/* DOCUMENTOS */}
      <Section title="Documentos">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="CPF" required>
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} className={inputCls} placeholder="CPF*" />
          </Field>
          <Field label="RG">
            <input value={rg} onChange={(e) => setRg(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Título de eleitor">
            <input value={tituloEleitor} onChange={(e) => setTituloEleitor(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Zona Eleitoral">
            <input value={zonaEleitoral} onChange={(e) => setZonaEleitoral(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Seção Eleitoral">
            <input value={secaoEleitoral} onChange={(e) => setSecaoEleitoral(e.target.value)} className={inputCls} />
          </Field>

          <Field label="CTPS NUM">
            <input value={ctpsNum} onChange={(e) => setCtpsNum(e.target.value)} className={inputCls} />
          </Field>
          <Field label="CTPS Série">
            <input value={ctpsSerie} onChange={(e) => setCtpsSerie(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Reservista">
            <input value={reservista} onChange={(e) => setReservista(e.target.value)} className={inputCls} />
          </Field>

          <Field label="CNH">
            <input value={cnh} onChange={(e) => setCnh(e.target.value)} className={inputCls} />
          </Field>
          <Field label="PIS">
            <input value={pis} onChange={(e) => setPis(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </Section>

      {/* DADOS BANCÁRIOS */}
      <Section title="Dados bancários">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Banco">
            <input value={banco} onChange={(e) => setBanco(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Agência">
            <input value={agencia} onChange={(e) => setAgencia(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Conta Corrente">
            <input value={contaCorrente} onChange={(e) => setContaCorrente(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </Section>

      {/* INTEGRAÇÕES / IDS */}
      <Section title="Integrações e IDs">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Sistema">
            <input value={sistema} onChange={(e) => setSistema(e.target.value)} className={inputCls} />
          </Field>
          <Field label="ID Colaborador">
            <input value={idColabExt} onChange={(e) => setIdColabExt(e.target.value)} className={inputCls} />
          </Field>
          <Field label="ID Departamento">
            <input value={idDepExt} onChange={(e) => setIdDepExt(e.target.value)} className={inputCls} />
          </Field>

          <Field label="ID Cargo">
            <input value={idCargoExt} onChange={(e) => setIdCargoExt(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Unidade">
            <input value={unidade} onChange={(e) => setUnidade(e.target.value)} className={inputCls} />
          </Field>
          <Field label="ID Unidade">
            <input value={idUnidadeExt} onChange={(e) => setIdUnidadeExt(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </Section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
        >
          {submitting ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
