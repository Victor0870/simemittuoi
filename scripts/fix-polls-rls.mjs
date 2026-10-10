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

const FIX_SQL = `
-- Drop restrictive admin policy and allow full server operations on polls
drop policy if exists "cdilv_polls_admin_all" on public.cdilv_polls;
drop policy if exists "cdilv_poll_options_admin_all" on public.cdilv_poll_options;
drop policy if exists "cdilv_poll_members_admin_all" on public.cdilv_poll_option_members;

-- Disable RLS on polls configuration tables so API routes can manage them directly
alter table public.cdilv_polls disable row level security;
alter table public.cdilv_poll_options disable row level security;
alter table public.cdilv_poll_option_members disable row level security;

-- Keep RLS on votes and predictions with public read & insert
alter table public.cdilv_poll_votes enable row level security;
alter table public.cdilv_poll_predictions enable row level security;
`;

async function runFix(ref, password, label) {
  const conn = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`[${label}] Connected. Applying RLS fixes...`);
  await client.query(FIX_SQL);
  console.log(`[${label}] RLS fixes applied successfully.`);
  await client.end();
}

const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();

console.log("=== Fixing RLS on OLD project ===");
await runFix("qpaoucyjitbmfcahxrqu", oldPass, "OLD");

console.log("=== Fixing RLS on SHARED project ===");
await runFix("pzcwwylxrojvcoihtxep", biz.SUPABASE_DB_PASSWORD, "SHARED");

console.log("Done fixing polls RLS!");
