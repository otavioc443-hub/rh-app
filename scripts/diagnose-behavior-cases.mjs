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

function mae(actual, expected) {
  return AXES.reduce((sum, axis) => sum + Math.abs((actual[axis] ?? 0) - (expected[axis] ?? 0)), 0) / AXES.length;
}

function main() {
  const repoRoot = process.cwd();
  const args = process.argv.slice(2);
  const includeAudit = args.includes("--include-auditoria");
  const casesArg = args.find((arg) => !arg.startsWith("--")) ?? "scripts/behavior-calibration-cases.json";
  const matrixFile = path.join(repoRoot, "src", "lib", "behaviorProfile.ts");
  const casesFile = path.resolve(repoRoot, casesArg);

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

  console.log("=== Diagnostico de Origem do Expected ===");
  console.log(
    `Casos: ${path.relative(repoRoot, casesFile)}${includeAudit ? " (incluindo auditoria)" : ""}`
  );

  for (const c of cases) {
    const expected = c?.expected?.self;
    if (!expected) continue;
    const self = calculatePercents(c.self_selected_ids, adjectiveMap);
    const others = calculatePercents(c.others_selected_ids, adjectiveMap);
    const maeSelf = mae(self, expected);
    const maeOthers = mae(others, expected);
    const closer = maeSelf <= maeOthers ? "self (Q1)" : "others (Q2)";
    console.log(
      `- ${c.id}: MAE self=${maeSelf.toFixed(2)} | MAE others=${maeOthers.toFixed(2)} | mais_proximo=${closer}`
    );
  }
}

main();
