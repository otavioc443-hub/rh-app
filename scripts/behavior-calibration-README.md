# Calibracao do Mapa Comportamental

## Arquivos
- `scripts/behavior-calibration-cases.json`: base unica de casos para calibracao (controle por `status`).
- `scripts/behavior-calibration-cases.pending.json`: legado/opcional (nao recomendado para operacao diaria).
- `scripts/behavior-calibration-cases.sample.json`: exemplo de formato.
- `scripts/calibrate-behavior-weights.mjs`: script que mede erro e sugere ajustes.
- `scripts/import-behavior-case.mjs`: importa casos por CSV/JSON para `pending` ou `prod`.
- `scripts/optimize-behavior-matrix.mjs`: otimiza pesos da matriz com trava de baseline (guard).
- `scripts/diagnose-behavior-cases.mjs`: verifica se o `expected.self` esta mais proximo das marcacoes de Q1 (self) ou Q2 (others).
- `scripts/report-behavior-calibration-quality.mjs`: gera ranking de casos por erro (MAE/RMSE) e prioridade de revisao.
- `scripts/behavior-case-template.csv` e `scripts/behavior-case-template.json`: modelos de coleta padronizada.

## Formato de caso
Cada caso deve conter:
- `id`
- `status` (`ativo` ou `auditoria`; padrao: `ativo`)
- `self_selected_ids`
- `others_selected_ids`
- `expected.self` com percentuais do Profiler (`executor`, `comunicador`, `planejador`, `analista`)

## Comandos
- `npm run calibrate:behavior:prod`
- `npm run calibrate:behavior:pending` (legado/opcional)
- `npm run calibrate:behavior:import -- <arquivo.csv|arquivo.json> [--target pending|prod] [--dry-run]` (padrao agora: `prod`)
- `npm run calibrate:behavior:optimize -- [--primary scripts/behavior-calibration-cases.json] [--guard scripts/behavior-calibration-cases.json] [--max-passes 20] [--guard-weight 3] [--guard-drift 0.01] [--write]`
- `npm run calibrate:behavior:diagnose -- [arquivo-de-casos.json]`
- `npm run calibrate:behavior:quality -- [arquivo-de-casos.json] [--matrix atual|disc|blend] [--blend-alpha 0.7]`
- `npm run calibrate:behavior:quality:disc`
- `npm run calibrate:behavior:quality:blend`
- `npm run calibrate:behavior:impact -- [arquivo-de-casos.json]`
- `npm run calibrate:behavior:sample`
- `npm run calibrate:behavior:check-baseline` (falha se houver regressao frente ao baseline versionado)

Observacao: por padrao, scripts ignoram casos com `status: "auditoria"`. Para incluir, use `--include-auditoria`.

### Modo dual de matriz
- `--matrix atual`: usa a matriz calibrada em `behaviorProfile.ts`.
- `--matrix disc`: usa matriz semantica baseada no mapeamento DISC (D->Executor, I->Comunicador, S->Planejador, C->Analista), com fallback pelo eixo dominante atual.
- `--matrix blend`: combina `atual` e `disc`.
- `--blend-alpha`: peso da matriz atual no blend (`0..1`). Exemplo: `0.7` = `70% atual + 30% disc`.

## Fluxo recomendado (base unica)
1. Preencher um template (`behavior-case-template.csv` ou `.json`) com:
   - `id`
   - `expected_*`
   - `self_selected_ids`
   - `others_selected_ids`
2. Importar para base oficial com `status` apropriado (`auditoria` para casos novos):
   - `npm run calibrate:behavior:import -- scripts/behavior-case-template.csv --target prod`
3. Validar base ativa e auditoria:
   - `npm run calibrate:behavior:quality`
   - `npm run calibrate:behavior:quality -- --include-auditoria`
4. Opcional: rodar otimizacao (sem gravar) para simular ganho sem degradar oficial:
   - `npm run calibrate:behavior:optimize`
5. Para aplicar de fato os pesos otimizados:
   - `npm run calibrate:behavior:optimize -- --write`
6. Rodar baseline:
   - `npm run calibrate:behavior:prod`
   - `npm run calibrate:behavior:check-baseline`
