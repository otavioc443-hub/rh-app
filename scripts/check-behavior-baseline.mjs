import fs from "node:fs";
import path from "node:path";

const AXES = ["executor", "comunicador", "planejador", "analista"];

function parseWeightsFromTs(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const regex =
    /\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*weights:\s*weights\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/g;

  /** @type {Record<string, { id: string; label: string; weights: Record<string, number> }>} */
  const map = {};
  let match;
  while ((match = regex.exec(source)) !== null) {
    const [, id, label, executor, comunicador, planejador, analista] = match;
    map[id] = {
      id,
      label,
      weights: {
        executor: Number(executor),
        comunicador: Number(comunicador),
        planejador: Number(planejador),
        analista: Number(analista),
      },
    };
  }
  return map;
}

function calculatePercents(selectedIds, adjectiveMap) {
  const totals = { executor: 0, comunicador: 0, planejador: 0, analista: 0 };
  for (const id of selectedIds) {
    const adjective = adjectiveMap[id];
    if (!adjective) continue;
    for (const axis of AXES) totals[axis] += adjective.weights[axis];
  }

  const total = AXES.reduce((sum, axis) => sum + totals[axis], 0) || 1;
  /** @type {Record<string, number>} */
  const percents = {};
  for (const axis of AXES) {
    percents[axis] = Number(((totals[axis] / total) * 100).toFixed(2));
  }
  return percents;
}

function metric(actual, expected) {
  const diffs = AXES.map((axis) => (actual[axis] ?? 0) - (expected[axis] ?? 0));
  const mae = diffs.reduce((sum, d) => sum + Math.abs(d), 0) / AXES.length;
  const rmse = Math.sqrt(diffs.reduce((sum, d) => sum + d * d, 0) / AXES.length);
  return { mae, rmse };
}

function main() {
  const repoRoot = process.cwd();
  const versionFile = path.join(repoRoot, "scripts", "behavior-matrix-version.json");
  const includeAudit = process.argv.includes("--include-auditoria");

  if (!fs.existsSync(versionFile)) {
    console.error(`Arquivo nao encontrado: ${versionFile}`);
    process.exit(1);
  }

  const version = JSON.parse(fs.readFileSync(versionFile, "utf8"));
  const matrixFile = path.resolve(repoRoot, version.matrix_file);
  const casesFile = path.resolve(repoRoot, version.cases_file);

  if (!fs.existsSync(matrixFile) || !fs.existsSync(casesFile)) {
    console.error("Arquivos de matriz/casos definidos no versionamento nao encontrados.");
    process.exit(1);
  }

  const allowedDriftArg = process.argv[2];
  const allowedDrift = allowedDriftArg ? Number(allowedDriftArg) : 0.01;
  if (!Number.isFinite(allowedDrift) || allowedDrift < 0) {
    console.error("Drift invalido. Use um numero >= 0, por exemplo: 0.01");
    process.exit(1);
  }

  const adjectiveMap = parseWeightsFromTs(matrixFile);
  const allCases = JSON.parse(fs.readFileSync(casesFile, "utf8"))?.cases ?? [];
  const cases = includeAudit
    ? allCases
    : allCases.filter((c) => String(c?.status ?? "ativo") !== "auditoria");
  if (!Array.isArray(cases) || !cases.length) {
    console.error("Base de casos vazia para validacao.");
    process.exit(1);
  }

  let evaluated = 0;
  let maeSum = 0;
  let rmseSum = 0;
  /** @type {Record<string, number>} */
  const caseMae = {};

  for (const c of cases) {
    const expectedSelf = c?.expected?.self;
    if (!expectedSelf) continue;
    const selected = Array.isArray(c.self_selected_ids) ? c.self_selected_ids : [];
    const actual = calculatePercents(selected, adjectiveMap);
    const { mae, rmse } = metric(actual, expectedSelf);
    evaluated += 1;
    maeSum += mae;
    rmseSum += rmse;
    caseMae[String(c.id ?? "sem-id")] = Number(mae.toFixed(2));
  }

  if (!evaluated) {
    console.error("Nenhum caso com expected.self encontrado para validacao.");
    process.exit(1);
  }

  const currentMae = Number((maeSum / evaluated).toFixed(2));
  const currentRmse = Number((rmseSum / evaluated).toFixed(2));
  const baselineMae = Number(version?.metrics?.mae_mean ?? NaN);
  const baselineRmse = Number(version?.metrics?.rmse_mean ?? NaN);
  const baselineCaseMae = version?.metrics?.case_mae ?? {};

  if (!Number.isFinite(baselineMae) || !Number.isFinite(baselineRmse)) {
    console.error("Baseline invalido em scripts/behavior-matrix-version.json (mae/rmse).");
    process.exit(1);
  }

  const maeLimit = Number((baselineMae + allowedDrift).toFixed(2));
  const rmseLimit = Number((baselineRmse + allowedDrift).toFixed(2));

  const errors = [];
  if (currentMae > maeLimit) {
    errors.push(
      `MAE atual ${currentMae.toFixed(2)} acima do limite ${maeLimit.toFixed(2)} (baseline ${baselineMae.toFixed(2)} + drift ${allowedDrift.toFixed(2)}).`
    );
  }
  if (currentRmse > rmseLimit) {
    errors.push(
      `RMSE atual ${currentRmse.toFixed(2)} acima do limite ${rmseLimit.toFixed(2)} (baseline ${baselineRmse.toFixed(2)} + drift ${allowedDrift.toFixed(2)}).`
    );
  }

  for (const [caseId, baseMaeRaw] of Object.entries(baselineCaseMae)) {
    const baseMae = Number(baseMaeRaw);
    if (!Number.isFinite(baseMae)) continue;
    const current = Number(caseMae[caseId] ?? NaN);
    if (!Number.isFinite(current)) continue;
    const limit = Number((baseMae + allowedDrift).toFixed(2));
    if (current > limit) {
      errors.push(
        `Caso ${caseId} com MAE ${current.toFixed(2)} acima do limite ${limit.toFixed(2)} (baseline ${baseMae.toFixed(2)}).`
      );
    }
  }

  console.log("=== Baseline Check: Mapa Comportamental ===");
  console.log(`Versao baseline: ${version.version}`);
  console.log(`Drift permitido: ${allowedDrift.toFixed(2)}`);
  if (includeAudit) console.log("Modo: incluindo casos de auditoria");
  console.log(`Atual -> MAE ${currentMae.toFixed(2)} | RMSE ${currentRmse.toFixed(2)}`);
  console.log(`Limite -> MAE ${maeLimit.toFixed(2)} | RMSE ${rmseLimit.toFixed(2)}`);

  if (errors.length) {
    console.error("\nFalha na validacao de baseline:");
    for (const err of errors) console.error(`- ${err}`);
    process.exit(1);
  }

  console.log("\nBaseline validado sem regressao.");
}

main();
