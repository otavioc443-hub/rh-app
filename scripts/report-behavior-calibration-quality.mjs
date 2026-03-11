import fs from "node:fs";
import path from "node:path";

const AXES = ["executor", "comunicador", "planejador", "analista"];

function normalizeLabel(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

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

function axisWithHighestWeight(weights) {
  let bestAxis = AXES[0];
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const axis of AXES) {
    const value = Number(weights?.[axis] ?? 0);
    if (value > bestValue) {
      bestValue = value;
      bestAxis = axis;
    }
  }
  return bestAxis;
}

function axisWithSecondHighestWeight(weights, firstAxis) {
  const candidates = AXES.filter((axis) => axis !== firstAxis);
  let bestAxis = candidates[0] ?? firstAxis;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const axis of candidates) {
    const value = Number(weights?.[axis] ?? 0);
    if (value > bestValue) {
      bestValue = value;
      bestAxis = axis;
    }
  }
  return bestAxis;
}

function discAxisFromLabel(label, fallbackAxis) {
  const normalized = normalizeLabel(label);
  const includesAny = (terms) => terms.some((term) => normalized.includes(term));

  if (
    includesAny([
      "decid",
      "resolut",
      "lider",
      "corajos",
      "audacios",
      "firme",
      "exigent",
      "independent",
      "auto-suficient",
      "auto suficient",
      "pratic",
      "energi",
      "ativo",
    ])
  ) {
    return "executor";
  }

  if (
    includesAny([
      "comunic",
      "contagi",
      "empolgan",
      "alegr",
      "animad",
      "bem-humor",
      "bem humor",
      "simpatic",
      "extrovert",
      "popular",
      "influenciador",
      "bom companheiro",
      "destacad",
      "estimul",
    ])
  ) {
    return "comunicador";
  }

  if (
    includesAny([
      "calm",
      "pacient",
      "equilibr",
      "leal",
      "compreens",
      "tranquil",
      "cumpridor",
      "rotineir",
      "reservad",
      "sincer",
      "dedicad",
      "sensivel",
    ])
  ) {
    return "planejador";
  }

  if (
    includesAny([
      "calcul",
      "metod",
      "minuc",
      "teoric",
      "racion",
      "perfeccion",
      "discret",
      "critic",
      "conserv",
      "analit",
      "auto-disciplin",
      "auto disciplin",
    ])
  ) {
    return "analista";
  }

  return fallbackAxis;
}

function buildDiscAdjectiveMap(currentMap) {
  const discMap = {};
  for (const [id, item] of Object.entries(currentMap)) {
    const fallbackAxis = axisWithHighestWeight(item);
    const principalAxis = discAxisFromLabel(item.label ?? id, fallbackAxis);
    const secondaryAxis = axisWithSecondHighestWeight(item, principalAxis);
    const base = { executor: 0, comunicador: 0, planejador: 0, analista: 0 };
    base[principalAxis] = 3;
    if (secondaryAxis !== principalAxis && Number(item[secondaryAxis] ?? 0) > 0) {
      base[secondaryAxis] = 1;
    }
    discMap[id] = {
      id,
      label: item.label,
      ...base,
    };
  }
  return discMap;
}

function buildBlendAdjectiveMap(currentMap, discMap, alpha) {
  const blendMap = {};
  for (const [id, item] of Object.entries(currentMap)) {
    const disc = discMap[id] ?? item;
    const merged = { id, label: item.label };
    for (const axis of AXES) {
      merged[axis] = Number((alpha * Number(item[axis] ?? 0) + (1 - alpha) * Number(disc[axis] ?? 0)).toFixed(4));
    }
    blendMap[id] = merged;
  }
  return blendMap;
}

function parseArgs(argv) {
  const args = {
    includeAudit: false,
    matrixMode: "atual",
    blendAlpha: 0.7,
    casesArg: "scripts/behavior-calibration-cases.json",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--include-auditoria") {
      args.includeAudit = true;
      continue;
    }
    if (token === "--matrix" && argv[i + 1]) {
      args.matrixMode = String(argv[++i]).toLowerCase();
      continue;
    }
    if (token === "--blend-alpha" && argv[i + 1]) {
      args.blendAlpha = Number(argv[++i]);
      continue;
    }
    if (!token.startsWith("--")) args.casesArg = token;
  }

  if (!["atual", "disc", "blend"].includes(args.matrixMode)) {
    console.error(`Valor invalido para --matrix: ${args.matrixMode}. Use: atual | disc | blend`);
    process.exit(1);
  }
  if (!Number.isFinite(args.blendAlpha) || args.blendAlpha < 0 || args.blendAlpha > 1) {
    console.error("Valor invalido para --blend-alpha. Use numero entre 0 e 1.");
    process.exit(1);
  }

  return args;
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

function rmse(actual, expected) {
  return Math.sqrt(
    AXES.reduce((sum, axis) => {
      const diff = (actual[axis] ?? 0) - (expected[axis] ?? 0);
      return sum + diff * diff;
    }, 0) / AXES.length
  );
}

function classifyRisk(maeValue) {
  if (maeValue >= 4) return "critico";
  if (maeValue >= 2) return "alto";
  if (maeValue >= 1) return "medio";
  return "baixo";
}

function main() {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const casesFile = path.resolve(repoRoot, args.casesArg);
  const matrixFile = path.join(repoRoot, "src", "lib", "behaviorProfile.ts");

  if (!fs.existsSync(casesFile)) {
    console.error(`Arquivo de casos nao encontrado: ${casesFile}`);
    process.exit(1);
  }

  const currentMap = parseWeightsFromTs(matrixFile);
  const discMap = buildDiscAdjectiveMap(currentMap);
  const blendMap = buildBlendAdjectiveMap(currentMap, discMap, args.blendAlpha);
  const adjectiveMap =
    args.matrixMode === "disc" ? discMap : args.matrixMode === "blend" ? blendMap : currentMap;
  const allCases = JSON.parse(fs.readFileSync(casesFile, "utf8"))?.cases ?? [];
  const cases = args.includeAudit
    ? allCases
    : allCases.filter((c) => String(c?.status ?? "ativo") !== "auditoria");
  if (!Array.isArray(cases) || !cases.length) {
    console.error("Nenhum caso encontrado.");
    process.exit(1);
  }

  const rows = [];
  let maeSum = 0;
  let rmseSum = 0;
  let count = 0;

  for (const c of cases) {
    const expected = c?.expected?.self;
    if (!expected) continue;
    const actual = calculatePercents(c.self_selected_ids, adjectiveMap);
    const caseMae = mae(actual, expected);
    const caseRmse = rmse(actual, expected);
    maeSum += caseMae;
    rmseSum += caseRmse;
    count += 1;
    rows.push({
      id: String(c.id ?? "sem-id"),
      mae: Number(caseMae.toFixed(2)),
      rmse: Number(caseRmse.toFixed(2)),
      risk: classifyRisk(caseMae),
      selfCount: Array.isArray(c.self_selected_ids) ? c.self_selected_ids.length : 0,
      othersCount: Array.isArray(c.others_selected_ids) ? c.others_selected_ids.length : 0,
    });
  }

  rows.sort((a, b) => b.mae - a.mae);

  const report = {
    generated_at: new Date().toISOString(),
    source_file: path.relative(repoRoot, casesFile),
    matrix_mode: args.matrixMode,
    blend_alpha: args.matrixMode === "blend" ? args.blendAlpha : null,
    summary: {
      comparisons: count,
      mae_mean: Number((maeSum / (count || 1)).toFixed(2)),
      rmse_mean: Number((rmseSum / (count || 1)).toFixed(2)),
      critical_cases: rows.filter((r) => r.risk === "critico").length,
      high_cases: rows.filter((r) => r.risk === "alto").length,
      medium_cases: rows.filter((r) => r.risk === "medio").length,
    },
    ranking: rows,
  };

  const outFile = path.join(repoRoot, "tmp", "behavior-calibration-quality-report.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");

  console.log("=== Quality Report ===");
  console.log(`Fonte: ${report.source_file}${args.includeAudit ? " (incluindo auditoria)" : ""}`);
  console.log(`Matriz: ${report.matrix_mode}${report.blend_alpha != null ? ` (alpha=${report.blend_alpha})` : ""}`);
  console.log(`Comparacoes: ${report.summary.comparisons}`);
  console.log(`MAE medio: ${report.summary.mae_mean.toFixed(2)} | RMSE medio: ${report.summary.rmse_mean.toFixed(2)}`);
  console.log(`Criticos: ${report.summary.critical_cases} | Altos: ${report.summary.high_cases} | Medios: ${report.summary.medium_cases}`);
  console.log("\nTop 5 por MAE:");
  for (const row of rows.slice(0, 5)) {
    console.log(
      `- ${row.id}: MAE ${row.mae.toFixed(2)} | RMSE ${row.rmse.toFixed(2)} | risco ${row.risk} | Q1=${row.selfCount} Q2=${row.othersCount}`
    );
  }
  console.log(`\nRelatorio salvo em: ${path.relative(repoRoot, outFile)}`);
}

main();
