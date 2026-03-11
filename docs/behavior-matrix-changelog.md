# Mapa Comportamental - Changelog de Calibracao

## v1.0.0-calibrada (2026-03-05)

### Baseline congelada
- Arquivo de matriz: `src/lib/behaviorProfile.ts`
- Base de casos: `scripts/behavior-calibration-cases.json`
- Comando de validacao: `npm run calibrate:behavior:prod`

### Lote utilizado
- `lucas-barbosa-rocha-2026-03-04`
- `carlos-vinicius-domingos-da-silva-2026-03-05`
- `isadora-maria-ferreira-de-lima-2026-03-04`
- `rodrigo-augusto-da-c-s-simioni-2026-03-04`

### Resultado consolidado da versao
- MAE medio: `0.59`
- RMSE medio: `0.74`

### MAE por caso
- Lucas: `0.24`
- Carlos: `0.52`
- Isadora: `1.16`
- Rodrigo: `0.46`

### Ajustes finais aplicados antes do congelamento
- `compreensivo`: `(0,1,1,1) -> (0,2,1,0)`
- `idealista`: `(0,1,1,1) -> (0,0,1,2)`
- `sensivel`: `(0,1,1,1) -> (1,1,1,0)`

### Regra de governanca para proximas versoes
1. Adicionar novos casos no `scripts/behavior-calibration-cases.json`.
2. Rodar `npm run calibrate:behavior:prod`.
3. Ajustar pesos em `src/lib/behaviorProfile.ts` somente se reduzir MAE/RMSE global sem degradar casos estaveis.
4. Registrar nova secao neste changelog com:
   - data,
   - lote de casos,
   - MAE/RMSE global,
   - principais alteracoes de peso.

## v1.0.1-calibrada (2026-03-05)

### Atualizacao de lote
- Inclusao de `jesse-2026-03-05`
- Inclusao de `otavio-victor-ferreira-da-silva-2026-03-05` (provisorio por leitura visual dos prints)

### Resultado consolidado da versao
- MAE medio: `0.92`
- RMSE medio: `1.08`

### MAE por caso
- Lucas: `0.24`
- Carlos: `0.52`
- Isadora: `1.16`
- Rodrigo: `0.46`
- Jesse: `0.77`
- Otavio: `2.35`

### Ajustes de peso aplicados
- `contagiante`: `(0,3,0,0) -> (0,2,1,0)`
- `empolgante`: `(0,3,0,0) -> (0,2,1,0)`

## v1.0.2-calibrada (2026-03-05)

### Refinamento de caso
- Revisao das selecoes do caso `otavio-victor-ferreira-da-silva-2026-03-05` com imagens em zoom (passo 2 e passo 3).

### Resultado consolidado da versao
- MAE medio: `0.70`
- RMSE medio: `0.82`

### MAE por caso
- Lucas: `0.24`
- Carlos: `0.52`
- Isadora: `1.16`
- Rodrigo: `0.46`
- Jesse: `0.77`
- Otavio: `1.06`

## v1.0.3-calibrada (2026-03-05)

### Ajuste fino orientado a erro global
- Objetivo: reduzir MAE global sem piorar Lucas, Carlos e Rodrigo.

### Resultado consolidado da versao
- MAE medio: `0.60`
- RMSE medio: `0.71`

### MAE por caso
- Lucas: `0.24`
- Carlos: `0.52`
- Isadora: `0.92`
- Rodrigo: `0.40`
- Jesse: `0.70`
- Otavio: `0.80`

### Ajustes de peso aplicados
- `bem_humorado`: `(0,2,0,0) -> (0,2,1,0)`
- `otimista`: `(0,1,0,1) -> (0,2,0,1)`
- `sentimental`: `(0,1,1,1) -> (0,0,1,1)`

## v1.0.4-calibrada (2026-03-05)

### Governanca operacional
- Adicionado comando de bloqueio de regressao: `npm run calibrate:behavior:check-baseline`
- Script: `scripts/check-behavior-baseline.mjs`

### Regra aplicada automaticamente
- Falhar se MAE/RMSE global ultrapassar baseline versionado (`scripts/behavior-matrix-version.json`) considerando drift permitido.
- Falhar se MAE de qualquer caso baseline ultrapassar seu limite com drift permitido.

### Casos pendentes (nao entram no baseline)
- Jefferson adicionado em `scripts/behavior-calibration-cases.pending.json`.
- Comando para avaliar pendentes sem afetar baseline: `npm run calibrate:behavior:pending`.
- Beatriz adicionada em `scripts/behavior-calibration-cases.pending.json` por incompatibilidade entre selecoes visiveis e percentuais oficiais.

## v1.0.5-calibrada (2026-03-05)

### Atualizacao de lote
- Inclusao do caso oficial: `jefferson-vieira-da-souza-2026-03-05`.
- Dados de Q1 e Q2 mapeados a partir dos prints enviados pelo colaborador.

### Resultado consolidado da versao
- MAE medio: `0.79`
- RMSE medio: `0.93`

### MAE por caso
- Lucas: `0.24`
- Carlos: `0.52`
- Isadora: `0.92`
- Rodrigo: `0.40`
- Jesse: `0.70`
- Otavio: `0.80`
- Jefferson: `1.96`

## v1.0.6-calibrada (2026-03-05)

### Ajuste fino pós-inclusão do Jefferson
- Objetivo: reduzir erro do Jefferson sem regressão dos demais casos baseline.

### Resultado consolidado da versão
- MAE médio: `0.65`
- RMSE médio: `0.77`

### MAE por caso
- Lucas: `0.24`
- Carlos: `0.52`
- Isadora: `0.66`
- Rodrigo: `0.16`
- Jesse: `0.47`
- Otavio: `0.80`
- Jefferson: `1.70`

### Ajustes de peso aplicados
- `calmo`: `(0,0,1,1) -> (0,0,1,2)`
- `tranquilo`: `(0,0,2,0) -> (0,0,2,1)`
- `reservado`: `(0,0,0,2) -> (0,0,0,1)`

## v1.0.7-calibrada (2026-03-05)

### Atualizacao de lote
- Inclusao oficial de `pedro-navar-nascimento-de-andrade-ramos-2026-03-05`.
- Mapeamento adotado com leitura conservadora das selecoes em zoom (passos 2 e 3).

### Resultado consolidado da versao
- MAE medio: `0.68`
- RMSE medio: `0.81`

### MAE por caso
- Lucas: `0.24`
- Carlos: `0.52`
- Isadora: `0.66`
- Rodrigo: `0.16`
- Jesse: `0.47`
- Otavio: `0.80`
- Jefferson: `1.70`
- Pedro: `0.89`

## v1.0.8-calibrada (2026-03-05)

### Ajuste fino orientado ao Jefferson
- Objetivo: reduzir erro do Jefferson mantendo estabilidade global.
- Alteracao aplicada em matriz: `introvertido` de `(0,0,1,2)` para `(0,0,2,2)`.

### Resultado consolidado da versao
- MAE medio: `0.66`
- RMSE medio: `0.78`

### MAE por caso
- Lucas: `0.24`
- Carlos: `0.52`
- Isadora: `0.66`
- Rodrigo: `0.16`
- Jesse: `0.47`
- Otavio: `0.85`
- Jefferson: `1.46`
- Pedro: `0.89`

## v1.0.9-calibrada (2026-03-05)

### Ajuste fino adicional no Jefferson
- Alteracao aplicada em matriz: `introvertido` de `(0,0,2,2)` para `(0,0,2,3)`.

### Resultado consolidado da versao
- MAE medio: `0.64`
- RMSE medio: `0.76`

### MAE por caso
- Lucas: `0.24`
- Carlos: `0.52`
- Isadora: `0.66`
- Rodrigo: `0.16`
- Jesse: `0.47`
- Otavio: `0.94`
- Jefferson: `1.22`
- Pedro: `0.89`

### Observacao de tradeoff
- Houve melhora relevante no Jefferson (`1.46 -> 1.22`) com leve piora no Otavio (`0.85 -> 0.94`).

## v1.0.10-calibrada (2026-03-05)

### Atualizacao de lote
- Inclusao oficial de `ana-beatriz-lopes-nobre-2026-03-05` apos atualizacao das respostas.

### Resultado consolidado da versao
- MAE medio: `0.64`
- RMSE medio: `0.76`

### MAE por caso
- Lucas: `0.24`
- Carlos: `0.52`
- Isadora: `0.66`
- Rodrigo: `0.16`
- Jesse: `0.47`
- Otavio: `0.94`
- Jefferson: `1.22`
- Pedro: `0.89`
- Beatriz: `0.65`
