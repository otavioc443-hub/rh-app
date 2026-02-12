import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ADMIN_EMAIL", "ADMIN_PASSWORD"];
const missing = required.filter((k) => !process.env[k]);

if (missing.length > 0) {
  console.error("Missing env vars:", missing.join(", "));
  console.error(
    "Usage (PowerShell): $env:ADMIN_EMAIL='admin@x.com'; $env:ADMIN_PASSWORD='***'; npm run test:feature-modules"
  );
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function printResult(name, ok, details) {
  const status = ok ? "PASS" : "FAIL";
  console.log(`[${status}] ${name}${details ? ` :: ${details}` : ""}`);
}

async function checkTable(name, query) {
  const { error, count } = await query;
  printResult(`Table ${name}`, !error, error ? error.message : `ok count=${count ?? "n/a"}`);
  return !error;
}

async function main() {
  console.log("Running feature-modules checks...");

  const login = await supabase.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });

  if (login.error || !login.data.user) {
    printResult("Admin login", false, login.error?.message || "No user returned");
    process.exit(1);
  }
  printResult("Admin login", true, `user=${login.data.user.id}`);

  const userId = login.data.user.id;

  let allOk = true;
  allOk = (await checkTable(
    "pdi_items",
    supabase.from("pdi_items").select("id", { count: "exact", head: true }).eq("user_id", userId)
  )) && allOk;

  allOk = (await checkTable(
    "competencias_assessments",
    supabase
      .from("competencias_assessments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
  )) && allOk;

  allOk = (await checkTable(
    "performance_assessments",
    supabase
      .from("performance_assessments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
  )) && allOk;

  allOk = (await checkTable(
    "institutional_events",
    supabase
      .from("institutional_events")
      .select("id", { count: "exact", head: true })
      .gte("event_date", new Date().toISOString().slice(0, 10))
  )) && allOk;

  await supabase.auth.signOut();
  if (!allOk) process.exit(1);
}

main().catch((err) => {
  printResult("Unexpected error", false, err instanceof Error ? err.message : String(err));
  process.exit(1);
});
