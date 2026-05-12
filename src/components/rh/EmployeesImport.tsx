"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { UsersRound, Upload } from "lucide-react";
import type { ColaboradorPayload } from "./EmployeeForm";
import { Card, CardBody } from "@/components/ui/PageShell";

type Props = { onImport: (rows: ColaboradorPayload[]) => Promise<void> };
type CsvRow = Record<string, string | undefined>;

function normalizeHeader(value: string) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactHeader(value: string) {
  return normalizeHeader(value).replace(/[^a-z0-9]/g, "");
}

function cell(row: CsvRow, ...headers: string[]) {
  const wanted = new Set(headers.flatMap((h) => [normalizeHeader(h), compactHeader(h)]));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(normalizeHeader(key)) || wanted.has(compactHeader(key))) return value ?? "";
  }
  return "";
}

function hasContent(row: CsvRow) {
  return Object.values(row).some((value) => String(value ?? "").trim());
}

function maskCpf(value?: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return value ?? "";
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

function cleanCpf(value?: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length < 11 ? digits.padStart(11, "0") : digits.slice(0, 11);
}

function isDateLike(value?: string) {
  const v = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{2}\/\d{2}\/\d{4}$/.test(v);
}

function toISODate(value?: string) {
  if (!value) return "";
  const v = String(value).trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

function looksLikeSalary(value?: string) {
  const v = String(value ?? "").trim();
  return /^r\$/i.test(v) || /^\d{1,3}(\.\d{3})*,\d{2}$/.test(v) || /^\d+,\d{2}$/.test(v);
}

function toBoolSimNao(value: unknown) {
  const v = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (!v) return undefined;
  if (v === "sim" || v === "true" || v === "1") return true;
  if (v === "nao" || v === "false" || v === "0") return false;
  return undefined;
}

export default function EmployeesImport({ onImport }: Props) {
  const [fileName, setFileName] = useState("");
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [preview, setPreview] = useState<ColaboradorPayload[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const required = useMemo(
    () => ["Nome", "E-mail", "Cargo", "Departamento"],
    []
  );

  function validate(rows: CsvRow[]) {
    const errs: string[] = [];
    if (!rows.length) errs.push("A planilha veio vazia.");
    const headerKeys = Object.keys(rows[0] ?? {});
    const headers = new Set(headerKeys.flatMap((h) => [normalizeHeader(h), compactHeader(h)]));
    const missing = required.filter((h) => !headers.has(normalizeHeader(h)) && !headers.has(compactHeader(h)));
    if (missing.length) errs.push(`Faltando colunas obrigatórias: ${missing.join(", ")}`);
    return errs;
  }

  function missingRequiredValues(row: ColaboradorPayload) {
    const missing: string[] = [];
    if (!String(row.nome ?? "").trim()) missing.push("Nome");
    if (!String(row.email ?? "").trim()) missing.push("E-mail");
    if (!String(row.cargo ?? "").trim()) missing.push("Cargo");
    if (!String(row.departamento ?? "").trim()) missing.push("Departamento");
    return missing;
  }

  function mapRow(r: CsvRow): ColaboradorPayload {
    const rawCbo = cell(r, "CBO");
    const rawSalario = cell(r, "Salário", "Salario");
    const rawTurno = cell(r, "Turno");
    const rawMoeda = cell(r, "Moeda");
    const rawTipoContrato = cell(r, "Tipo de contrato");
    const rawDataContrato = cell(r, "Data do contrato");
    const rawEscolaridade = cell(r, "Escolaridade");
    const rawSuperiorDireto = cell(r, "Superior direto");
    const rawEmailSuperiorDireto = cell(r, "Email superior direto", "E-mail superior direto");
    const rawGrauHierarquico = cell(r, "Grau hierárquico", "Grau hierarquico");
    const rawDuracaoContrato = cell(r, "Duração do contrato", "Duracao do contrato");
    const rawVencimentoContrato = cell(r, "Vencimento do contrato");
    const rawDepartamento = cell(r, "Departamento");
    const rawEmail = cell(r, "E-mail", "Email");
    const rawCpf = cell(r, "CPF");
    const shiftedAfterCargo =
      looksLikeSalary(rawCbo) &&
      !String(rawSalario ?? "").trim() &&
      !isDateLike(rawDataContrato) &&
      Boolean(String(rawVencimentoContrato ?? "").trim()) &&
      Boolean(String(rawDepartamento ?? "").includes("@"));

    return {
      nome: cell(r, "Nome"),
      matricula: cell(r, "Matrícula", "Matricula"),
      data_nascimento: toISODate(cell(r, "Data de Nascimento")),
      sexo: cell(r, "Sexo"),
      estado_civil: cell(r, "Estado Civil"),
      saudacao: cell(r, "Saudação", "Saudacao"),
      nacionalidade: cell(r, "Nacionalidade"),
      naturalidade: cell(r, "Naturalidade"),
      etnia: cell(r, "Etnia"),
      nome_pai: cell(r, "Nome do Pai"),
      nome_mae: cell(r, "Nome da mãe", "Nome da mae"),
      pne: toBoolSimNao(cell(r, "PNE")),
      data_admissao: toISODate(cell(r, "Data de admissão", "Data de admissao")),
      data_demissao: toISODate(cell(r, "Data de demissão", "Data de demissao")),
      motivo_demissao: cell(r, "Motivo da demissão", "Motivo da demissao"),
      valor_rescisao: cell(r, "Valor da Rescisão", "Valor da Rescisao"),
      cep: cell(r, "Cep", "CEP"),
      logradouro: cell(r, "Logradouro"),
      numero: cell(r, "Número", "Numero"),
      complemento: cell(r, "Complemento"),
      bairro: cell(r, "Bairro"),
      cidade: cell(r, "Cidade"),
      telefone: cell(r, "Telefone"),
      celular: cell(r, "Celular"),
      telefone_emergencia: cell(r, "Telefone de emergência", "Telefone de emergencia"),
      email_pessoal: cell(r, "Email pessoal", "E-mail pessoal"),
      email_empresarial: cell(r, "Email empresarial", "E-mail empresarial"),
      cargo: cell(r, "Cargo"),
      cbo: shiftedAfterCargo ? "" : rawCbo,
      salario: shiftedAfterCargo ? rawCbo : rawSalario,
      turno: shiftedAfterCargo ? rawSalario : rawTurno,
      moeda: shiftedAfterCargo ? rawTurno : rawMoeda,
      tipo_contrato: shiftedAfterCargo ? rawMoeda : rawTipoContrato,
      data_contrato: toISODate(shiftedAfterCargo ? rawTipoContrato : rawDataContrato),
      escolaridade: shiftedAfterCargo ? rawDataContrato : rawEscolaridade,
      superior_direto: shiftedAfterCargo ? rawEscolaridade : rawSuperiorDireto,
      email_superior_direto: shiftedAfterCargo ? rawSuperiorDireto : rawEmailSuperiorDireto,
      grau_hierarquico: shiftedAfterCargo ? rawEmailSuperiorDireto : rawGrauHierarquico,
      duracao_contrato: shiftedAfterCargo ? rawGrauHierarquico : rawDuracaoContrato,
      vencimento_contrato: toISODate(shiftedAfterCargo ? rawDuracaoContrato : rawVencimentoContrato),
      departamento: shiftedAfterCargo ? rawVencimentoContrato : rawDepartamento,
      email: shiftedAfterCargo ? rawDepartamento : rawEmail,
      cpf: cleanCpf(shiftedAfterCargo ? rawEmail : rawCpf),
      rg: cell(r, "RG"),
      titulo_eleitor: cell(r, "Título de eleitor", "Titulo de eleitor"),
      zona_eleitoral: cell(r, "Zona Eleitoral"),
      secao_eleitoral: cell(r, "Seção Eleitoral", "Secao Eleitoral"),
      ctps_num: cell(r, "CTPS NUM"),
      ctps_serie: cell(r, "CTPS Série", "CTPS Serie"),
      reservista: cell(r, "Reservista"),
      cnh: cell(r, "CNH"),
      banco: cell(r, "Banco"),
      agencia: cell(r, "Agência", "Agencia"),
      conta_corrente: cell(r, "Conta Corrente"),
      pis: cell(r, "PIS"),
      sistema: cell(r, "Sistema"),
      id_colaborador_externo: cell(r, "ID Colaborador"),
      id_departamento_externo: cell(r, "ID Departamento"),
      id_cargo_externo: cell(r, "ID Cargo"),
      unidade: cell(r, "Unidade"),
      id_unidade_externo: cell(r, "ID Unidade"),
    };
  }

  async function onPickFile(file?: File | null) {
    setErrors([]);
    setPreview([]);
    setAllRows([]);
    setFileName(file?.name ?? "");
    if (!file) return;

    const parseWith = (delimiter?: string) =>
      new Promise<CsvRow[]>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: "greedy",
          delimiter: delimiter ?? "",
          complete: (res) => resolve((res.data ?? []) as CsvRow[]),
          error: (err) => reject(err),
        });
      });

    try {
      let rows = (await parseWith()).filter(hasContent);
      const headers = Object.keys(rows[0] ?? {});
      const looksBroken = headers.length === 1 && headers[0]?.includes(";");

      if (looksBroken) rows = (await parseWith(";")).filter(hasContent);

      const errs = validate(rows);
      if (errs.length) {
        setErrors(errs);
        return;
      }

      const mappedRows = rows.map(mapRow);
      const rowErrors = mappedRows
        .map((row, index) => ({ index, missing: missingRequiredValues(row) }))
        .filter((row) => row.missing.length)
        .slice(0, 10);

      if (rowErrors.length) {
        setPreview(mappedRows.slice(0, 6));
        setErrors(
          rowErrors.map(
            (row) => `Linha ${row.index + 2}: preencha ${row.missing.join(", ")} para importar este colaborador.`
          )
        );
        return;
      }

      setAllRows(rows);
      setPreview(mappedRows.slice(0, 6));
    } catch (e: unknown) {
      setErrors([e instanceof Error ? e.message : "Falha ao ler o arquivo."]);
    }
  }

  async function handleImport() {
    setLoading(true);
    setErrors([]);
    try {
      const mapped = allRows.map(mapRow);
      await onImport(mapped);
      setAllRows([]);
      setPreview([]);
      setFileName("");
    } catch (e: unknown) {
      setErrors([e instanceof Error ? e.message : "Falha ao importar."]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <UsersRound size={22} />
          </div>

          <div className="flex-1">
            <div className="text-lg font-bold text-slate-900">Adicionar colaboradores em massa</div>
            <div className="text-sm text-slate-600">
              Envie um CSV no padrão da planilha (separador <b>;</b>). Cabeçalhos com ou sem <b>*</b> são aceitos.
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => onPickFile(e.target.files?.[0])}
                className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-800 hover:file:bg-slate-200"
              />

              <button
                onClick={handleImport}
                disabled={loading || allRows.length === 0}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                title="Importar colaboradores do CSV"
              >
                <Upload size={16} />
                {loading ? "Importando..." : `Importar (${allRows.length})`}
              </button>
            </div>

            {fileName ? <div className="mt-2 text-xs text-slate-500">Arquivo: {fileName}</div> : null}

            {errors.length ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <ul className="list-disc pl-5">
                  {errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.length ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
                  Prévia (primeiras {preview.length} linhas)
                </div>
                <div className="overflow-auto">
                  <table className="min-w-[900px] w-full text-left text-sm">
                    <thead className="text-slate-700">
                      <tr className="border-t">
                        <th className="p-3">Nome</th>
                        <th className="p-3">CPF</th>
                        <th className="p-3">E-mail</th>
                        <th className="p-3">Departamento</th>
                        <th className="p-3">Cargo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-3">{r.nome}</td>
                          <td className="p-3">{maskCpf(r.cpf)}</td>
                          <td className="p-3">{r.email}</td>
                          <td className="p-3">{r.departamento}</td>
                          <td className="p-3">{r.cargo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500">Envie um CSV para visualizar a prévia.</div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
