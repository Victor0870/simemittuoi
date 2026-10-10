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

const ALTER_SQL = `
alter table public.cdilv_polls add column if not exists is_active boolean not null default true;
alter table public.cdilv_poll_options add column if not exists is_active boolean not null default true;
`;

async function runAlter(ref, password, label) {
  const conn = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`[${label}] Connected. Adding is_active columns...`);
  await client.query(ALTER_SQL);
  console.log(`[${label}] Columns added successfully.`);
  await client.end();
}

const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();

console.log("=== Add is_active on OLD project ===");
await runAlter("qpaoucyjitbmfcahxrqu", oldPass, "OLD");

console.log("=== Add is_active on SHARED project ===");
await runAlter("pzcwwylxrojvcoihtxep", biz.SUPABASE_DB_PASSWORD, "SHARED");

console.log("Done adding is_active columns!");
