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

const CREATE_SQL = `
create table if not exists public.cdilv_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.cdilv_posts(id) on delete cascade,
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists cdilv_post_comments_post_idx
  on public.cdilv_post_comments (post_id, created_at desc);

create index if not exists cdilv_post_comments_user_post_idx
  on public.cdilv_post_comments (post_id, user_id);

alter table public.cdilv_post_comments disable row level security;
grant all on public.cdilv_post_comments to anon, authenticated, service_role;
`;

async function runSql(ref, password, label) {
  const conn = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`[${label}] Connected. Creating cdilv_post_comments...`);
  await client.query(CREATE_SQL);
  console.log(`[${label}] Table created and permissions granted successfully.`);
  await client.end();
}

const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();

console.log("=== Creating table on OLD project ===");
await runSql("qpaoucyjitbmfcahxrqu", oldPass, "OLD");

console.log("=== Creating table on SHARED project ===");
await runSql("pzcwwylxrojvcoihtxep", biz.SUPABASE_DB_PASSWORD, "SHARED");

console.log("Done!");
