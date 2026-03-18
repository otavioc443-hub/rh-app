# Matriz de Tratamento de Dados do Portal

Este documento consolida, em nivel operacional, os principais tratamentos de dados realizados no portal.

Uso recomendado:

- revisar trimestralmente
- atualizar sempre que surgir modulo novo, integracao nova ou nova categoria de dado
- manter alinhado com o aviso de privacidade, com o fluxo de solicitacoes LGPD e com a politica de retencao

## Campos de controle

- `Modulo`: area funcional do portal
- `Finalidade`: para que o dado e tratado
- `Categorias de dados`: principais grupos de dados tratados
- `Titulares`: quem sao os titulares afetados
- `Base legal`: hipotese principal adotada pela operacao
- `Acesso interno`: perfis que acessam ordinariamente
- `Compartilhamento`: terceiros ou operadores envolvidos
- `Retencao`: referencia para a politica de retencao
- `Risco principal`: maior risco de privacidade do modulo
- `Controle principal`: medida tecnica ou operacional dominante

## Matriz

| Modulo | Finalidade | Categorias de dados | Titulares | Base legal sugerida | Acesso interno | Compartilhamento | Retencao | Risco principal | Controle principal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Autenticacao e perfis | autenticar usuario, definir acesso e exibir perfil basico | nome, email, role, empresa, departamento, avatar | colaboradores, gestores, admin | execucao de contrato e exercicio regular de direitos | todos os perfis conforme permissao | Supabase, Vercel | ver politica de retencao | acesso indevido por role incorreta | RLS, middleware, avatar por rota autenticada |
| RH - cadastro de colaborador | manter cadastro funcional e operacional do colaborador | identificacao civil, contato, cargo, dados funcionais, endereco, dados bancarios, desligamento | colaboradores e ex-colaboradores | execucao de contrato, obrigacao legal/regulatoria | RH, Admin, parte restrita a Financeiro quando aplicavel | Supabase | ver politica de retencao | excesso de visualizacao ou manutencao sem necessidade | minimizacao em listagens, trilha de auditoria, perfis segregados |
| RH - solicitacoes cadastrais | registrar pedidos de alteracao cadastral e anexos | dados cadastrais alterados, anexos comprobatórios, observacoes de aprovacao | colaboradores | execucao de contrato e obrigacao legal quando aplicavel | RH, Financeiro, Admin | Supabase Storage | ver politica de retencao | anexo sensivel exposto | anexos por URL assinada, resumo operacional no lugar de payload cru |
| RH - absenteismo | registrar faltas, licencas e atestados | datas, CID, observacoes, indicador de atestado | colaboradores | obrigacao legal, saude ocupacional, execucao de contrato | RH, gestor quando couber | Supabase | ver politica de retencao | tratamento de dado sensivel de saude | acesso restrito, minimizacao, revisao periodica |
| Financeiro - pagamentos extras | processar aprovacoes, anexos e historico de pagamento extra | nome, user id, projeto, valor, anexo, referencia mensal | colaboradores/prestadores | execucao de contrato e obrigacao legal/fiscal | Gestor, Financeiro, Admin | Supabase | ver politica de retencao | exposicao de anexo ou valor fora do escopo | anexos assinados, filas minimizadas |
| Financeiro - CNAB / remessas | gerar arquivos bancarios para pagamentos | CPF, banco, agencia, conta, nome, valores | colaboradores/prestadores | execucao de contrato e obrigacao legal/fiscal | Financeiro | banco parceiro, operador financeiro | ver politica de retencao | vazamento de dados bancarios | mascaramento em tela, geracao local, acesso restrito |
| Financeiro - notas fiscais / remessas | operacao fiscal e conciliacao | dados fiscais, identificadores financeiros, historico de remessa | prestadores/fornecedores | obrigacao legal e execucao de contrato | Financeiro, Admin | integracoes fiscais e bancarias | ver politica de retencao | retencao excessiva ou compartilhamento inadequado | controle de acesso e trilha de processamento |
| Projetos | alocar pessoas, acompanhar entregas e governanca operacional | nome, vinculo a projeto, historico de entregas, comentarios, anexos operacionais | colaboradores, clientes internos | execucao de contrato e legitimo interesse interno quando cabivel | colaborador, gestor, coordenador, diretoria | Supabase | ver politica de retencao | historico excessivo ou acesso transversal | segregacao por membership, limpeza administrativa, auditoria |
| PulseHub / rede social interna | comunicacao interna e interacao institucional | nome, avatar, texto de post, comentarios, reacoes, midia | colaboradores | legitimo interesse interno com transparenica e governanca | usuarios autenticados | Supabase Storage | ver politica de retencao | exposicao de midia interna | bucket privado, URL assinada, moderacao e exclusao operacional |
| Chamados internos | abertura e acompanhamento de solicitacoes internas | identificacao do solicitante, descricao, anexos, status | colaboradores | execucao de contrato e legitimo interesse interno | solicitante, time responsavel, Admin quando necessario | Supabase Storage | ver politica de retencao | anexo com dado pessoal exposto | anexos assinados e validacao de acesso |
| Organograma e visualizacoes institucionais | exibir estrutura organizacional interna | nome, cargo, area, avatar | colaboradores | legitimo interesse interno e execucao de contrato | usuarios autenticados | Supabase | ver politica de retencao | exposicao excessiva de perfil | avatar autenticado e exibicao limitada ao contexto interno |
| Auditorias e trilhas administrativas | registrar alteracoes, decisoes e eventos criticos | user id, role, timestamps, acao, resumo de alteracao | usuarios internos envolvidos | exercicio regular de direitos e legitimo interesse em seguranca/governanca | RH, Financeiro, Admin, Diretoria conforme modulo | Supabase | ver politica de retencao | log conter dado desnecessario | resumo em vez de payload bruto, limpeza controlada |
| Solicitacoes LGPD | receber, acompanhar e auditar pedidos do titular | identificacao do titular, tipo de pedido, andamento, historico de tratamento | titulares internos | cumprimento de obrigacao legal | titular, RH, Admin, encarregado | Supabase | ver politica de retencao | perda de prazo ou resposta inconsistente | fluxo dedicado, fila operacional e auditoria |
| Sessao e seguranca | detectar uso, rastrear sessao e investigar incidente | session id, user agent, timestamps, empresa/departamento, eventos de sessao | usuarios internos | legitimo interesse em seguranca e prevencao a fraude | Admin restrito | Supabase | ver politica de retencao | retencao excessiva | janela de retencao e limpeza administrativa |

## Bases legais que exigem validacao final

As bases abaixo sao sugestoes operacionais. A confirmacao final deve ser validada com juridico/encarregado:

- execucao de contrato: cadastros, operacao de colaborador, projetos, pagamentos
- obrigacao legal ou regulatoria: folha, fiscal, financeiro, trabalhista, auditoria obrigatoria
- legitimo interesse: PulseHub, organograma interno, trilha de seguranca, comunicacao interna
- exercicio regular de direitos: auditorias, trilhas, logs decisorios

## Modulos com maior prioridade de revisao

- RH completo
- Financeiro / CNAB / pagamentos
- mapa comportamental e avaliacoes
- PulseHub com midia
- trilhas administrativas

## Responsavel pela manutencao

- dono operacional: RH + Admin do portal
- validacao juridica: encarregado / consultoria juridica
- revisao tecnica: equipe de desenvolvimento
