# Curso-modelo para testar o LMS

Este guia acompanha o modelo `Laboratorio completo do LMS`, disponivel no criador de cursos.

## Objetivo

Validar o modulo de treinamentos de ponta a ponta, cobrindo:

- criacao do curso por etapas
- estrutura em fases e aulas
- uploads e links
- preview do colaborador
- atribuicao
- progresso
- quiz com correcao automatica
- quiz com revisao manual
- certificado
- notificacoes
- ranking, XP e badges

## Como criar pela interface

1. Acesse `RH > Treinamentos > Cursos`.
2. Clique em `Novo curso`.
3. Na etapa inicial, selecione o modelo `Laboratorio completo do LMS`.
4. Revise os textos, troque imagens e complete os arquivos reais.
5. Passe pela revisao final.
6. Publique o curso.

## Estrutura do curso-modelo

### Fase 1 - Entrada na jornada

- Aula 1: `Boas-vindas em video`
  - testa video
  - testa preview liberado
  - testa conclusao automatica
- Aula 2: `Guia textual de navegacao`
  - testa aula em texto
  - testa leitura dentro do portal

### Fase 2 - Midias e materiais

- Aula 1: `Leitura de politica em PDF`
  - testa upload e leitura de PDF
- Aula 2: `Acesso a formulario externo`
  - testa link externo
- Aula 3: `Download de material complementar`
  - testa anexo de arquivo

### Fase 3 - Checkpoint automatico

- Aula 1: `Checkpoint automatico da trilha`
  - objetiva com uma resposta
  - multipla escolha
  - verdadeiro ou falso
  - resposta curta
  - escolha por imagem
  - testa nota imediata
  - testa respostas corretas exibidas

### Fase 4 - Avaliacao com revisao manual

- Aula 1: `Avaliacao final com revisao manual`
  - questao discursiva
  - testa fila de correcao do RH
  - testa liberacao de nota apos revisao

## O que preencher para testar tudo

### Midias

- imagem do card do curso
- banner do curso
- video curto de demonstracao
- um PDF institucional
- um arquivo complementar

### Publicacao

- status: `Publicado`
- visibilidade: `Publico interno`
- curso obrigatorio: `Sim`
- emitir certificado: `Sim`
- exigir ordem das aulas: `Sim`
- nota minima: `75`

## Fluxo de testes recomendado

### 1. RH

- criar o curso com o modelo
- publicar
- atribuir para um usuario de teste

### 2. Colaborador

- abrir `Meus treinamentos`
- iniciar a trilha
- concluir video, texto, PDF, link e arquivo
- responder o quiz automatico
- responder a questao discursiva

### 3. RH novamente

- abrir `Correção de avaliações`
- revisar a questao discursiva
- aprovar a tentativa

### 4. Validacoes finais

- confirmar conclusao do curso
- confirmar emissao do certificado
- verificar notificacoes
- verificar ganho de XP, badges e ranking
- validar post automatico no PulseHub, se habilitado

## Checklist de homologacao

- [ ] curso aparece no catalogo
- [ ] preview do aluno reflete o que foi criado
- [ ] video carrega corretamente
- [ ] PDF abre ou baixa corretamente
- [ ] arquivo complementar baixa corretamente
- [ ] link externo abre corretamente
- [ ] quiz automatico calcula nota
- [ ] quiz discursivo entra em revisao manual
- [ ] progresso por fase atualiza
- [ ] certificado fica disponivel ao concluir
- [ ] notificacoes aparecem no sino
- [ ] badges/XP/ranking sao atualizados

## Sugestao de uso continuo

Depois da homologacao, esse mesmo modelo pode virar:

- curso interno de onboarding
- curso de reciclarem anual
- curso de treinamento de gestores
- curso demonstrativo para apresentar o LMS a novas empresas
