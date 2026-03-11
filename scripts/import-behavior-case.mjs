import fs from "node:fs";
import path from "node:path";

const TARGET_FILES = {
  pending: "scripts/behavior-calibration-cases.pending.json",
  prod: "scripts/behavior-calibration-cases.json",
};

function usageAndExit() {
  console.log(
    "Uso: node scripts/import-behavior-case.mjs <arquivo.csv|arquivo.json> [--target pending|prod] [--dry-run]"
  );
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (!args.length) usageAndExit();

  const inputPath = args[0];
  let target = "prod";
  let dryRun = false;

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--target") {
      const value = args[i + 1];
      if (!value || !(value in TARGET_FILES)) usageAndExit();
      target = value;
      i += 1;
      continue;
    }
    usageAndExit();
  }

  return { inputPath, target, dryRun };
}

function toNumber(value, fieldName) {
  const normalized = String(value ?? "").replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Campo numerico invalido: ${fieldName}="${value}"`);
  }
  return parsed;
}

function parseIds(value) {
  return String(value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCase(raw) {
  const id = String(raw.id ?? "").trim();
  if (!id) throw new Error("Caso sem id.");

  const self = Array.isArray(raw.self_selected_ids)
    ? raw.self_selected_ids
    : parseIds(raw.self_selected_ids);
  const others = Array.isArray(raw.others_selected_ids)
    ? raw.others_selected_ids
    : parseIds(raw.others_selected_ids);

  const statusRaw = String(raw.status ?? "ativo").trim().toLowerCase();
  const status = statusRaw === "auditoria" ? "auditoria" : "ativo";

  return {
    id,
    status,
    self_selected_ids: self,
    others_selected_ids: others,
    expected: {
      self: {
        executor: toNumber(raw.expected_executor ?? raw?.expected?.self?.executor, "expected_executor"),
        comunicador: toNumber(
          raw.expected_comunicador ?? raw?.expected?.self?.comunicador,
          "expected_comunicador"
        ),
        planejador: toNumber(
          raw.expected_planejador ?? raw?.expected?.self?.planejador,
          "expected_planejador"
        ),
        analista: toNumber(raw.expected_analista ?? raw?.expected?.self?.analista, "expected_analista"),
      },
    },
    ...(raw.notes ? { notes: String(raw.notes) } : {}),
  };
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error("CSV sem dados.");

  const headers = lines[0].split(";").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(";").map((c) => c.trim());
    /** @type {Record<string, string>} */
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    return obj;
  });

  return rows.map(normalizeCase);
}

function parseJson(content) {
  const parsed = JSON.parse(content);
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.cases) ? parsed.cases : [parsed];
  return rows.map(normalizeCase);
}

function loadCasesFromInput(inputFile) {
  const content = fs.readFileSync(inputFile, "utf8");
  if (inputFile.toLowerCase().endsWith(".csv")) return parseCsv(content);
  if (inputFile.toLowerCase().endsWith(".json")) return parseJson(content);
  throw new Error("Formato nao suportado. Use .csv ou .json");
}

function main() {
  const { inputPath, target, dryRun } = parseArgs();
  const repoRoot = process.cwd();
  const inputFile = path.resolve(repoRoot, inputPath);
  if (!fs.existsSync(inputFile)) throw new Error(`Arquivo de entrada nao encontrado: ${inputFile}`);

  const targetFile = path.resolve(repoRoot, TARGET_FILES[target]);
  if (!fs.existsSync(targetFile)) throw new Error(`Arquivo de destino nao encontrado: ${targetFile}`);

  const incoming = loadCasesFromInput(inputFile);
  const targetJson = JSON.parse(fs.readFileSync(targetFile, "utf8"));
  const currentCases = Array.isArray(targetJson?.cases) ? targetJson.cases : [];

  const byId = new Map(currentCases.map((item) => [String(item.id), item]));
  const added = [];
  const replaced = [];

  for (const row of incoming) {
    if (byId.has(row.id)) {
      byId.set(row.id, row);
      replaced.push(row.id);
    } else {
      byId.set(row.id, row);
      added.push(row.id);
    }
  }

  const nextCases = Array.from(byId.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const nextPayload = { cases: nextCases };

  console.log("=== Importacao de Casos Comportamentais ===");
  console.log(`Entrada: ${inputFile}`);
  console.log(`Destino: ${targetFile}`);
  console.log(`Casos lidos: ${incoming.length}`);
  console.log(`Novos: ${added.length}${added.length ? ` -> ${added.join(", ")}` : ""}`);
  console.log(`Atualizados: ${replaced.length}${replaced.length ? ` -> ${replaced.join(", ")}` : ""}`);

  if (dryRun) {
    console.log("Dry-run ativo: nenhuma escrita realizada.");
    return;
  }

  fs.writeFileSync(targetFile, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf8");
  console.log("Arquivo atualizado com sucesso.");
}

main();
