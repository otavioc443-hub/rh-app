# Recuperacao de senha - Supabase

Checklist operacional para reduzir falhas no fluxo de redefinicao de senha.

## Expiracao do link

No Supabase, revisar em `Authentication > Providers > Email` ou `Authentication > URL Configuration`:

- Manter o link de recuperacao com validade suficiente para o usuario abrir o email com calma.
- Recomendacao inicial: 60 minutos.
- Confirmar que `Site URL` aponta para a URL de producao do portal.
- Confirmar que `Redirect URLs` inclui a URL de producao com `/auth/recovery` e `/set-password`.
- Manter o link de recuperacao redirecionando para `/auth/recovery`, que encaminha para `/set-password` preservando os parametros do Supabase.
- O app usa fluxo `implicit` no cliente Supabase para evitar falha quando o link do e-mail abre em outra aba.

## Envio do email

O portal envia o e-mail de redefinicao pela rota `/api/auth/password-recovery`, usando Brevo e o `action_link` oficial gerado pelo Supabase Admin.

Esse link primeiro valida o token no Supabase e depois redireciona para `/auth/recovery`, que abre `/set-password` com a sessao de redefinicao ativa.

O template padrao de `Reset Password` do Supabase deixa de ser o fluxo principal do portal. Ainda assim, se ele for usado manualmente no painel do Supabase:

- Informar que o link expira e deve ser usado apenas uma vez.
- Orientar o usuario a abrir o link no mesmo navegador/dispositivo em que pretende definir a senha.
- Usar o link oficial do Supabase para recuperacao, apontando para o redirect configurado.
- Preferir o token/link padrao do Supabase para reset de senha, sem reescrever manualmente os parametros da URL.

Texto sugerido:

```text
Voce solicitou a redefinicao da sua senha no Portal de RH.

Clique no botao abaixo para criar uma nova senha. Este link expira em ate 60 minutos e deve ser usado apenas uma vez.

Se o link expirar, solicite um novo acesso pela tela "Esqueci minha senha".
```

## Verificacao apos alterar

- Solicitar um novo link de recuperacao.
- Abrir o link em janela anonima.
- Conferir se a tela `/set-password` exibe o email do usuario.
- Testar uma senha incompleta e confirmar o checklist.
- Salvar uma senha valida e confirmar o redirecionamento para o portal.
