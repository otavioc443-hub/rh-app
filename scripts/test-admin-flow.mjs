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
    "Usage (PowerShell): $env:ADMIN_EMAIL='admin@x.com'; $env:ADMIN_PASSWORD='***'; npm run test:admin-flow"
  );
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const baseUrl = process.env.PORTAL_BASE_URL || "http://localhost:3000";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function printResult(name, ok, details) {
  const status = ok ? "PASS" : "FAIL";
  console.log(`[${status}] ${name}${details ? ` :: ${details}` : ""}`);
}

async function requestJson(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  return { status: res.status, payload };
}

async function main() {
  console.log(`Running admin flow checks against ${baseUrl}`);

  const login = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (login.error || !login.data.session?.access_token || !login.data.user) {
    printResult("Admin login", false, login.error?.message || "No session returned");
    process.exit(1);
  }
  printResult("Admin login", true, `user=${login.data.user.id}`);

  const token = login.data.session.access_token;

  const profile = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", login.data.user.id)
    .maybeSingle();

  if (profile.error || !profile.data) {
    printResult("Profile fetch", false, profile.error?.message || "Profile not found");
  } else {
    const role = profile.data.role;
    const active = profile.data.active === true;
    printResult("Profile fetch", role === "admin" && active, `role=${role} active=${active}`);
  }

  // This route is cookie-based in middleware. Without browser cookie, it should redirect.
  const adminPage = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
  const loc = adminPage.headers.get("location");
  printResult("GET /admin (manual, no browser cookie)", adminPage.status === 307, `status=${adminPage.status} location=${loc}`);

  // Guard test without side effects: invalid email should return 400 if authz passed.
  const inviteGuard = await requestJson("/api/admin/invite", {
    method: "POST",
    token,
    body: { email: "invalid-email", role: "colaborador" },
  });
  printResult(
    "POST /api/admin/invite authz",
    inviteGuard.status === 400,
    `status=${inviteGuard.status} body=${JSON.stringify(inviteGuard.payload)}`
  );

  const companies = await requestJson("/api/admin/companies", { token });
  printResult(
    "GET /api/admin/companies",
    companies.status === 200,
    `status=${companies.status} count=${Array.isArray(companies.payload?.companies) ? companies.payload.companies.length : "n/a"}`
  );

  const rhAccess = await requestJson("/api/rh/enviar-acesso", {
    method: "POST",
    token,
    body: { collaboratorId: "00000000-0000-0000-0000-000000000000" },
  });
  const rhOk = [400, 404].includes(rhAccess.status);
  printResult(
    "POST /api/rh/enviar-acesso authz",
    rhOk,
    `status=${rhAccess.status} body=${JSON.stringify(rhAccess.payload)}`
  );

  await supabase.auth.signOut();
}

main().catch((err) => {
  printResult("Unexpected error", false, err instanceof Error ? err.message : String(err));
  process.exit(1);
});
