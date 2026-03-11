import fs from "node:fs";
import path from "node:path";

const AXES = ["executor", "comunicador", "planejador", "analista"];
const MAX_WEIGHT = 3;

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
  const totals = {
    executor: 0,
    comunicador: 0,
    planejador: 0,
    analista: 0,
  };

  const missing = [];
  for (const id of selectedIds) {
    const adjective = adjectiveMap[id];
    if (!adjective) {
      missing.push(id);
      continue;
    }
    for (const axis of AXES) totals[axis] += adjective.weights[axis];
  }

  const total = AXES.reduce((sum, axis) => sum + totals[axis], 0) || 1;
  const percents = {};
  for (const axis of AXES) {
    percents[axis] = Number(((totals[axis] / total) * 100).toFixed(2));
  }
  return { totals, percents, missing };
}

function metric(actual, expected) {
  const diffs = AXES.map((axis) => (actual[axis] ?? 0) - (expected[axis] ?? 0));
  const mae = diffs.reduce((sum, d) => sum + Math.abs(d), 0) / AXES.length;
  const rmse = Math.sqrt(diffs.reduce((sum, d) => sum + d * d, 0) / AXES.length);
  return { mae, rmse, diffs };
}

function pushSuggestionScore(suggestions, adjectiveId, axis, delta, currentWeight) {
  if (!suggestions[adjectiveId]) {
    suggestions[adjectiveId] = {
      adjectiveId,
      byAxis: {
        executor: { increase: 0, decrease: 0 },
        comunicador: { increase: 0, decrease: 0 },
        planejador: { increase: 0, decrease: 0 },
        analista: { increase: 0, decrease: 0 },
      },
    };
  }

  if (delta > 0) {
    const room = MAX_WEIGHT - currentWeight;
    suggestions[adjectiveId].byAxis[axis].increase += delta * Math.max(room, 0);
  } else if (delta < 0) {
    const room = currentWeight;
    suggestions[adjectiveId].byAxis[axis].decrease += Math.abs(delta) * Math.max(room, 0);
  }
}

function addCaseSuggestions(suggestions, caseKind, selectedIds, expected, actual, adjectiveMap) {
  const deltaByAxis = {};
  for (const axis of AXES) deltaByAxis[axis] = (expected[axis] ?? 0) - (actual[axis] ?? 0);

  for (const id of selectedIds) {
    const adjective = adjectiveMap[id];
    if (!adjective) continue;
    for (const axis of AXES) {
      pushSuggestionScore(
        suggestions,
        id,
        axis,
        deltaByAxis[axis],
        adjective.weights[axis]
      );
    }
  }

  return { kind: caseKind, deltaByAxis };
}

function renderAxisSuggestion(byAxis) {
  /** @type {Array<{ axis: string; action: "increase"|"decrease"; score: number }>} */
  const rows = [];
  for (const axis of AXES) {
    rows.push({ axis, action: "increase", score: byAxis[axis].increase });
    rows.push({ axis, action: "decrease", score: byAxis[axis].decrease });
  }
  rows.sort((a, b) => b.score - a.score);
  const top = rows[0];
  if (!top || top.score <= 0) return null;
  return top;
}

function main() {
  const repoRoot = process.cwd();
  const matrixFile = path.join(repoRoot, "src", "lib", "behaviorProfile.ts");
  const casesFileArg = process.argv[2];
  const casesFile = casesFileArg
    ? path.resolve(repoRoot, casesFileArg)
    : path.join(repoRoot, "scripts", "behavior-calibration-cases.json");

  if (!fs.existsSync(casesFile)) {
    console.error(
      `Arquivo de casos nao encontrado: ${casesFile}\nUse o sample em scripts/behavior-calibration-cases.sample.json`
    );
    process.exit(1);
  }

  const adjectiveMap = parseWeightsFromTs(matrixFile);
  const raw = JSON.parse(fs.readFileSync(casesFile, "utf8"));
  const includeAudit = process.argv.includes("--include-auditoria");
  const allCases = Array.isArray(raw?.cases) ? raw.cases : [];
  const cases = includeAudit
    ? allCases
    : allCases.filter((c) => String(c?.status ?? "ativo") !== "auditoria");
  if (!cases.length) {
    console.error("Nenhum caso encontrado no JSON (chave esperada: cases).");
    process.exit(1);
  }

  let evaluated = 0;
  let globalMae = 0;
  let globalRmse = 0;
  /** @type {Record<string, any>} */
  const suggestions = {};

  console.log("=== Calibracao de Mapa Comportamental ===");
  console.log(`Casos carregados: ${cases.length}${includeAudit ? " (incluindo auditoria)" : ""}`);
  console.log(`Adjetivos na matriz: ${Object.keys(adjectiveMap).length}\n`);

  for (const c of cases) {
    const caseId = String(c.id ?? "sem-id");
    const selfIds = Array.isArray(c.self_selected_ids) ? c.self_selected_ids : [];
    const othersIds = Array.isArray(c.others_selected_ids) ? c.others_selected_ids : [];
    const expectedSelf = c?.expected?.self ?? null;
    const expectedOthers = c?.expected?.others ?? null;

    console.log(`--- Caso: ${caseId} ---`);
    console.log(`Selecoes: self=${selfIds.length}, others=${othersIds.length}`);

    if (expectedSelf) {
      const current = calculatePercents(selfIds, adjectiveMap);
      const m = metric(current.percents, expectedSelf);
      evaluated += 1;
      globalMae += m.mae;
      globalRmse += m.rmse;
      addCaseSuggestions(suggestions, "self", selfIds, expectedSelf, current.percents, adjectiveMap);

      console.log("SELF esperado:", expectedSelf);
      console.log("SELF atual:   ", current.percents);
      console.log(`SELF erro -> MAE=${m.mae.toFixed(2)} | RMSE=${m.rmse.toFixed(2)}`);
      if (current.missing.length) {
        console.log("SELF ids ausentes na matriz:", current.missing.join(", "));
      }
    }

    if (expectedOthers) {
      const current = calculatePercents(othersIds, adjectiveMap);
      const m = metric(current.percents, expectedOthers);
      evaluated += 1;
      globalMae += m.mae;
      globalRmse += m.rmse;
      addCaseSuggestions(suggestions, "others", othersIds, expectedOthers, current.percents, adjectiveMap);

      console.log("OTHERS esperado:", expectedOthers);
      console.log("OTHERS atual:   ", current.percents);
      console.log(`OTHERS erro -> MAE=${m.mae.toFixed(2)} | RMSE=${m.rmse.toFixed(2)}`);
      if (current.missing.length) {
        console.log("OTHERS ids ausentes na matriz:", current.missing.join(", "));
      }
    }

    if (!expectedSelf && !expectedOthers) {
      console.log("Sem esperado para comparar (adicione expected.self e/ou expected.others).");
    }
    console.log("");
  }

  if (evaluated > 0) {
    console.log("=== Resumo Global ===");
    console.log(`Comparacoes avaliadas: ${evaluated}`);
    console.log(`MAE medio: ${(globalMae / evaluated).toFixed(2)}`);
    console.log(`RMSE medio: ${(globalRmse / evaluated).toFixed(2)}\n`);
  } else {
    console.log("Nenhuma comparacao avaliada (faltam expected.self/expected.others).");
  }

  const ranked = Object.values(suggestions)
    .map((entry) => {
      const top = renderAxisSuggestion(entry.byAxis);
      return top
        ? {
            adjectiveId: entry.adjectiveId,
            axis: top.axis,
            action: top.action,
            score: top.score,
            label: adjectiveMap[entry.adjectiveId]?.label ?? entry.adjectiveId,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  console.log("=== Sugestoes Prioritarias (heuristica) ===");
  if (!ranked.length) {
    console.log("Sem sugestoes fortes com os casos atuais.");
  } else {
    for (const row of ranked.slice(0, 20)) {
      const actionLabel = row.action === "increase" ? "AUMENTAR" : "REDUZIR";
      console.log(
        `- ${row.label} [${row.adjectiveId}] -> ${actionLabel} peso em ${row.axis} (score ${row.score.toFixed(2)})`
      );
    }
  }
}

main();
