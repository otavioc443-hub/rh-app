import fs from "node:fs";
import path from "node:path";

const AXES = ["executor", "comunicador", "planejador", "analista"];

function parseWeightsFromTs(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const regex =
    /\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*weights:\s*weights\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/g;
  const map = {};
  let match;
  while ((match = regex.exec(source)) !== null) {
    map[match[1]] = {
      executor: Number(match[3]),
      comunicador: Number(match[4]),
      planejador: Number(match[5]),
      analista: Number(match[6]),
    };
  }
  return map;
}

function calculatePercents(selectedIds, adjectiveMap) {
  const totals = { executor: 0, comunicador: 0, planejador: 0, analista: 0 };
  for (const id of selectedIds ?? []) {
    const adjective = adjectiveMap[id];
    if (!adjective) continue;
    for (const axis of AXES) totals[axis] += adjective[axis];
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

function evaluate(cases, adjectiveMap) {
  let count = 0;
  let maeSum = 0;
  let rmseSum = 0;
  for (const c of cases) {
    const expected = c?.expected?.self;
    if (!expected) continue;
    const selected = Array.isArray(c.self_selected_ids) ? c.self_selected_ids : [];
    const actual = calculatePercents(selected, adjectiveMap);
    const m = metric(actual, expected);
    count += 1;
    maeSum += m.mae;
    rmseSum += m.rmse;
  }
  return {
    count,
    mae: Number((maeSum / (count || 1)).toFixed(2)),
    rmse: Number((rmseSum / (count || 1)).toFixed(2)),
  };
}

function main() {
  const repoRoot = process.cwd();
  const args = process.argv.slice(2);
  const includeAudit = args.includes("--include-auditoria");
  const casesArg = args.find((arg) => !arg.startsWith("--")) ?? "scripts/behavior-calibration-cases.json";
  const casesFile = path.resolve(repoRoot, casesArg);
  const matrixFile = path.join(repoRoot, "src", "lib", "behaviorProfile.ts");

  if (!fs.existsSync(casesFile)) {
    console.error(`Arquivo de casos nao encontrado: ${casesFile}`);
    process.exit(1);
  }

  const adjectiveMap = parseWeightsFromTs(matrixFile);
  const allCases = JSON.parse(fs.readFileSync(casesFile, "utf8"))?.cases ?? [];
  const cases = includeAudit
    ? allCases
    : allCases.filter((c) => String(c?.status ?? "ativo") !== "auditoria");
  if (!Array.isArray(cases) || !cases.length) {
    console.error("Nenhum caso encontrado.");
    process.exit(1);
  }

  const base = evaluate(cases, adjectiveMap);
  const impacts = [];

  for (const c of cases) {
    const caseId = String(c.id ?? "sem-id");
    const subset = cases.filter((x) => String(x.id ?? "sem-id") !== caseId);
    const evalSubset = evaluate(subset, adjectiveMap);
    impacts.push({
      id: caseId,
      maeWithout: evalSubset.mae,
      rmseWithout: evalSubset.rmse,
      maeImprovement: Number((base.mae - evalSubset.mae).toFixed(2)),
      rmseImprovement: Number((base.rmse - evalSubset.rmse).toFixed(2)),
    });
  }

  impacts.sort((a, b) => b.maeImprovement - a.maeImprovement);

  console.log("=== Impacto por Caso (Leave-One-Out) ===");
  console.log(
    `Fonte: ${path.relative(repoRoot, casesFile)}${includeAudit ? " (incluindo auditoria)" : ""}`
  );
  console.log(`Base: MAE ${base.mae.toFixed(2)} | RMSE ${base.rmse.toFixed(2)} | casos ${base.count}\n`);

  for (const row of impacts) {
    const sign = row.maeImprovement >= 0 ? "+" : "";
    console.log(
      `- ${row.id}: sem caso -> MAE ${row.maeWithout.toFixed(2)} (${sign}${row.maeImprovement.toFixed(
        2
      )}) | RMSE ${row.rmseWithout.toFixed(2)} (${row.rmseImprovement >= 0 ? "+" : ""}${row.rmseImprovement.toFixed(
        2
      )})`
    );
  }
}

main();
