import fs from "node:fs";
import path from "node:path";

const AXES = ["executor", "comunicador", "planejador", "analista"];
const MAX_WEIGHT = 3;

function parseArgs(argv) {
  const args = {
    primaryFile: "scripts/behavior-calibration-cases.json",
    guardFile: "scripts/behavior-calibration-cases.json",
    maxPasses: 20,
    guardWeight: 3,
    guardDrift: 0.01,
    write: false,
    primaryIncludeAudit: false,
    guardIncludeAudit: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--write") args.write = true;
    else if (token === "--primary" && argv[i + 1]) args.primaryFile = argv[++i];
    else if (token === "--guard" && argv[i + 1]) args.guardFile = argv[++i];
    else if (token === "--max-passes" && argv[i + 1]) args.maxPasses = Number(argv[++i]);
    else if (token === "--guard-weight" && argv[i + 1]) args.guardWeight = Number(argv[++i]);
    else if (token === "--guard-drift" && argv[i + 1]) args.guardDrift = Number(argv[++i]);
    else if (token === "--include-auditoria") {
      args.primaryIncludeAudit = true;
      args.guardIncludeAudit = true;
    } else if (token === "--primary-include-auditoria") args.primaryIncludeAudit = true;
    else if (token === "--guard-include-auditoria") args.guardIncludeAudit = true;
  }
  return args;
}

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
  return { map, source };
}

function loadCases(filePath, includeAudit = false) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const allCases = Array.isArray(raw?.cases) ? raw.cases : [];
  return includeAudit
    ? allCases
    : allCases.filter((c) => String(c?.status ?? "ativo") !== "auditoria");
}

function calculatePercents(selectedIds, adjectiveMap) {
  const totals = { executor: 0, comunicador: 0, planejador: 0, analista: 0 };
  for (const id of selectedIds) {
    const adjective = adjectiveMap[id];
    if (!adjective) continue;
    for (const axis of AXES) totals[axis] += adjective.weights[axis];
  }
  const total = AXES.reduce((sum, axis) => sum + totals[axis], 0) || 1;
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

function evaluateCases(cases, adjectiveMap) {
  let count = 0;
  let maeSum = 0;
  let rmseSum = 0;
  const caseMae = {};
  for (const c of cases) {
    const expected = c?.expected?.self;
    if (!expected) continue;
    const caseId = String(c.id ?? "sem-id");
    const selected = Array.isArray(c.self_selected_ids) ? c.self_selected_ids : [];
    const actual = calculatePercents(selected, adjectiveMap);
    const m = metric(actual, expected);
    count += 1;
    maeSum += m.mae;
    rmseSum += m.rmse;
    caseMae[caseId] = Number(m.mae.toFixed(2));
  }
  return {
    count,
    mae: count ? maeSum / count : Number.POSITIVE_INFINITY,
    rmse: count ? rmseSum / count : Number.POSITIVE_INFINITY,
    caseMae,
  };
}

function cloneMap(adjectiveMap) {
  const next = {};
  for (const [id, item] of Object.entries(adjectiveMap)) {
    next[id] = { ...item, weights: { ...item.weights } };
  }
  return next;
}

function buildTargetIds(cases) {
  const ids = new Set();
  for (const c of cases) {
    const list = Array.isArray(c.self_selected_ids) ? c.self_selected_ids : [];
    for (const id of list) ids.add(id);
  }
  return Array.from(ids);
}

function objective(primaryMae, guardEval, guardCap, guardWeight, caseCaps) {
  if (guardEval.mae > guardCap) return Number.POSITIVE_INFINITY;
  for (const [caseId, cap] of Object.entries(caseCaps)) {
    const currentMae = Number(guardEval.caseMae[caseId] ?? NaN);
    if (Number.isFinite(currentMae) && currentMae > cap) return Number.POSITIVE_INFINITY;
  }
  const guardPenalty = Math.max(0, guardEval.mae - (guardCap - 0.02)) * guardWeight;
  return primaryMae + guardPenalty;
}

function applyWeightsToSource(source, updates) {
  let nextSource = source;
  for (const [id, w] of Object.entries(updates)) {
    const pattern = new RegExp(
      `(id:\\s*"${id}"[\\s\\S]{0,140}?weights:\\s*weights\\()(\\d+),\\s*(\\d+),\\s*(\\d+),\\s*(\\d+)(\\))`
    );
    nextSource = nextSource.replace(
      pattern,
      `$1${w.executor}, ${w.comunicador}, ${w.planejador}, ${w.analista}$6`
    );
  }
  return nextSource;
}

function main() {
  const args = parseArgs(process.argv);
  const repoRoot = process.cwd();
  const matrixFile = path.join(repoRoot, "src", "lib", "behaviorProfile.ts");
  const versionFile = path.join(repoRoot, "scripts", "behavior-matrix-version.json");
  const primaryFile = path.resolve(repoRoot, args.primaryFile);
  const guardFile = path.resolve(repoRoot, args.guardFile);

  if (!fs.existsSync(primaryFile) || !fs.existsSync(guardFile) || !fs.existsSync(versionFile)) {
    console.error("Arquivos obrigatorios nao encontrados (primary/guard/version).");
    process.exit(1);
  }

  const version = JSON.parse(fs.readFileSync(versionFile, "utf8"));
  const baselineMae = Number(version?.metrics?.mae_mean ?? NaN);
  const baselineCaseMae = version?.metrics?.case_mae ?? {};
  if (!Number.isFinite(baselineMae)) {
    console.error("Baseline de MAE invalido em behavior-matrix-version.json.");
    process.exit(1);
  }
  const caseCaps = {};
  for (const [caseId, mae] of Object.entries(baselineCaseMae)) {
    const n = Number(mae);
    if (!Number.isFinite(n)) continue;
    caseCaps[caseId] = Number((n + args.guardDrift).toFixed(2));
  }

  const guardCap = baselineMae + args.guardDrift;
  const primaryCases = loadCases(primaryFile, args.primaryIncludeAudit);
  const guardCases = loadCases(guardFile, args.guardIncludeAudit);
  const { map: initialMap, source } = parseWeightsFromTs(matrixFile);
  const targetIds = buildTargetIds(primaryCases).filter((id) => initialMap[id]);

  let currentMap = cloneMap(initialMap);
  let currentPrimary = evaluateCases(primaryCases, currentMap);
  let currentGuard = evaluateCases(guardCases, currentMap);
  let currentObjective = objective(
    currentPrimary.mae,
    currentGuard,
    guardCap,
    args.guardWeight,
    caseCaps
  );
  const changes = {};

  for (let pass = 1; pass <= args.maxPasses; pass += 1) {
    let improvedInPass = false;
    for (const id of targetIds) {
      for (const axis of AXES) {
        let bestLocal = null;
        for (const delta of [-1, 1]) {
          const nextValue = currentMap[id].weights[axis] + delta;
          if (nextValue < 0 || nextValue > MAX_WEIGHT) continue;
          const candidate = cloneMap(currentMap);
          candidate[id].weights[axis] = nextValue;
          const sum = AXES.reduce((acc, a) => acc + candidate[id].weights[a], 0);
          if (sum === 0) continue;

          const candidatePrimary = evaluateCases(primaryCases, candidate);
          const candidateGuard = evaluateCases(guardCases, candidate);
          const candidateObjective = objective(
            candidatePrimary.mae,
            candidateGuard,
            guardCap,
            args.guardWeight,
            caseCaps
          );

          if (!bestLocal || candidateObjective < bestLocal.objective) {
            bestLocal = {
              objective: candidateObjective,
              primary: candidatePrimary,
              guard: candidateGuard,
              map: candidate,
            };
          }
        }

        if (bestLocal && bestLocal.objective + 1e-9 < currentObjective) {
          currentMap = bestLocal.map;
          currentPrimary = bestLocal.primary;
          currentGuard = bestLocal.guard;
          currentObjective = bestLocal.objective;
          improvedInPass = true;
          changes[id] = { ...currentMap[id].weights };
        }
      }
    }
    if (!improvedInPass) break;
  }

  const changedIds = Object.keys(changes).sort();
  console.log("=== Otimizacao de Matriz Comportamental ===");
  console.log(`Primary: ${path.relative(repoRoot, primaryFile)} | casos=${currentPrimary.count}`);
  console.log(`Guard:   ${path.relative(repoRoot, guardFile)} | casos=${currentGuard.count}`);
  console.log(`Guard cap (MAE): ${guardCap.toFixed(2)} (baseline ${baselineMae.toFixed(2)} + drift ${args.guardDrift.toFixed(2)})`);
  console.log("");
  console.log(`Resultado -> Primary MAE ${currentPrimary.mae.toFixed(2)} | RMSE ${currentPrimary.rmse.toFixed(2)}`);
  console.log(`Resultado -> Guard   MAE ${currentGuard.mae.toFixed(2)} | RMSE ${currentGuard.rmse.toFixed(2)}`);
  console.log(`Adjetivos alterados: ${changedIds.length}`);

  if (!changedIds.length) {
    console.log("Nenhuma alteracao encontrada com melhora de objetivo.");
    return;
  }

  console.log("\nTop alteracoes:");
  for (const id of changedIds.slice(0, 20)) {
    const before = initialMap[id].weights;
    const after = currentMap[id].weights;
    console.log(
      `- ${id}: (${before.executor},${before.comunicador},${before.planejador},${before.analista}) -> (${after.executor},${after.comunicador},${after.planejador},${after.analista})`
    );
  }

  if (!args.write) {
    console.log("\nModo leitura: use --write para gravar no behaviorProfile.ts");
    return;
  }

  const updatedSource = applyWeightsToSource(source, changes);
  fs.writeFileSync(matrixFile, updatedSource, "utf8");
  console.log("\nArquivo atualizado: src/lib/behaviorProfile.ts");
}

main();
