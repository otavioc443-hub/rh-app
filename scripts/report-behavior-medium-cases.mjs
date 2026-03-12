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
      id: match[1],
      label: match[2],
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

function sharedAdjectives(cases) {
  const counts = new Map();
  for (const c of cases) {
    for (const id of c.self_selected_ids ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function main() {
  const repoRoot = process.cwd();
  const casesFile = path.join(repoRoot, "scripts", "behavior-calibration-cases.json");
  const matrixFile = path.join(repoRoot, "src", "lib", "behaviorProfile.ts");
  const outFile = path.join(repoRoot, "tmp", "behavior-medium-cases-report.json");

  const adjectiveMap = parseWeightsFromTs(matrixFile);
  const cases = JSON.parse(fs.readFileSync(casesFile, "utf8"))?.cases ?? [];

  const rows = cases
    .filter((c) => c?.expected?.self)
    .map((c) => {
      const actual = calculatePercents(c.self_selected_ids, adjectiveMap);
      const expected = c.expected.self;
      const caseMae = mae(actual, expected);
      return {
        id: String(c.id ?? "sem-id"),
        status: String(c.status ?? "ativo"),
        mae: Number(caseMae.toFixed(2)),
        selfCount: Array.isArray(c.self_selected_ids) ? c.self_selected_ids.length : 0,
        othersCount: Array.isArray(c.others_selected_ids) ? c.others_selected_ids.length : 0,
        actual,
        expected,
        diff: Object.fromEntries(
          AXES.map((axis) => [axis, Number(((actual[axis] ?? 0) - (expected[axis] ?? 0)).toFixed(2))])
        ),
        self_selected_ids: c.self_selected_ids ?? [],
      };
    })
    .filter((row) => row.mae >= 1 && row.mae < 2)
    .sort((a, b) => b.mae - a.mae);

  const report = {
    generated_at: new Date().toISOString(),
    medium_cases: rows,
    shared_adjectives: sharedAdjectives(rows),
    heuristic_notes: [
      "Q1 continua sendo a ancora do perfil natural.",
      "Casos medios devem ser revisados manualmente antes de qualquer ajuste na matriz principal.",
      "Se um ajuste melhorar apenas os casos medios, mas piorar a base total, o ajuste nao deve ser aplicado.",
    ],
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");

  console.log("=== Casos Medios para Revisao ===");
  console.log(`Casos medios: ${rows.length}`);
  for (const row of rows) {
    console.log(
      `- ${row.id}: MAE ${row.mae.toFixed(2)} | diff E=${row.diff.executor} C=${row.diff.comunicador} P=${row.diff.planejador} A=${row.diff.analista}`
    );
  }
  console.log("\nAdjetivos compartilhados (Q1) entre casos medios:");
  for (const [id, count] of report.shared_adjectives) {
    console.log(`- ${id}: ${count}`);
  }
  console.log(`\nRelatorio salvo em: ${path.relative(repoRoot, outFile)}`);
}

main();
