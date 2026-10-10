import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadBiz() {
  const p = "D:/Flutter/bizmate_app/supabase.local.env";
  return Object.fromEntries(
    fs
      .readFileSync(p, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const GRANT_SQL = `
grant usage on schema public to anon, authenticated, service_role;

grant all on public.cdilv_polls to anon, authenticated, service_role;
grant all on public.cdilv_poll_options to anon, authenticated, service_role;
grant all on public.cdilv_poll_option_members to anon, authenticated, service_role;
grant all on public.cdilv_poll_votes to anon, authenticated, service_role;
grant all on public.cdilv_poll_predictions to anon, authenticated, service_role;

-- Grant usage on sequences if any
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
`;

async function runGrant(ref, password, label) {
  const conn = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`[${label}] Connected. Applying grants...`);
  await client.query(GRANT_SQL);
  console.log(`[${label}] Grants applied successfully.`);
  await client.end();
}

const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();

console.log("=== Applying grants on OLD project ===");
await runGrant("qpaoucyjitbmfcahxrqu", oldPass, "OLD");

console.log("=== Applying grants on SHARED project ===");
await runGrant("pzcwwylxrojvcoihtxep", biz.SUPABASE_DB_PASSWORD, "SHARED");

console.log("Done granting polls table permissions!");
