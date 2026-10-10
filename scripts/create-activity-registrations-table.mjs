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

const MIGRATION_SQL = `
-- Add is_registration_open column to cdilv_activities if not exists
alter table public.cdilv_activities
  add column if not exists is_registration_open boolean not null default true;

-- Create cdilv_activity_registrations table
create table if not exists public.cdilv_activity_registrations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.cdilv_activities(id) on delete cascade,
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  registered_at timestamptz not null default now(),
  unique (activity_id, user_id)
);

create index if not exists cdilv_activity_registrations_act_idx
  on public.cdilv_activity_registrations (activity_id, registered_at asc);

create index if not exists cdilv_activity_registrations_user_idx
  on public.cdilv_activity_registrations (user_id);

alter table public.cdilv_activity_registrations disable row level security;
grant all on public.cdilv_activity_registrations to anon, authenticated, service_role;
grant all on public.cdilv_activities to anon, authenticated, service_role;
`;

async function runSql(ref, password, label) {
  const conn = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`[${label}] Connected. Applying activity registrations schema...`);
  await client.query(MIGRATION_SQL);
  console.log(`[${label}] Schema applied successfully.`);
  await client.end();
}

const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();

console.log("=== Running migration on OLD project ===");
await runSql("qpaoucyjitbmfcahxrqu", oldPass, "OLD");

console.log("=== Running migration on SHARED project ===");
await runSql("pzcwwylxrojvcoihtxep", biz.SUPABASE_DB_PASSWORD, "SHARED");

console.log("Done!");
