import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageFile = resolve("src/app/set-password/page.tsx");
const clientFile = resolve("src/lib/supabaseClient.ts");
const recoveryRouteFile = resolve("src/app/api/auth/password-recovery/route.ts");
const source = `${readFileSync(pageFile, "utf8")}\n${readFileSync(clientFile, "utf8")}\n${readFileSync(recoveryRouteFile, "utf8")}`;

const checks = [
  ["checklist de requisitos", "passwordChecklist"],
  ["forca visual da senha", "passwordStrength"],
  ["icone para visualizar senha", "Eye"],
  ["icone para ocultar senha", "EyeOff"],
  ["estado de link expirado", "Este link expirou ou ja foi usado."],
  ["botao solicitar novo link", "Solicitar novo link"],
  ["email do usuario exibido", "Definindo senha para"],
  ["checagem de sessao antes de salvar", "supabase.auth.getSession()"],
  ["mensagem amigavel para sessao ausente", "Sua sessao de redefinicao expirou"],
  ["fluxo implicit no cliente Supabase", "flowType: \"implicit\""],
  ["tratamento de access_token do link", "access_token"],
  ["endpoint proprio de recuperacao", "generateLink"],
  ["uso do action_link oficial do Supabase", "action_link"],
  ["redirect intermediario de recuperacao", "/auth/recovery"],
  ["envio pelo mailer do portal", "sendPortalEmail"],
  ["botao ir para o portal", "Ir para o portal"],
];

const missing = checks.filter(([, needle]) => !source.includes(needle));

if (missing.length) {
  console.error("Fluxo de redefinicao de senha incompleto:");
  for (const [label] of missing) console.error(`- ${label}`);
  process.exit(1);
}

console.log("Fluxo de redefinicao de senha validado.");
