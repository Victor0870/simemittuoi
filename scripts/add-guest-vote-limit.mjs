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
alter table public.cdilv_polls add column if not exists max_guest_votes integer not null default 250;
alter table public.cdilv_polls add column if not exists guest_vote_count integer not null default 0;
alter table public.cdilv_poll_votes add column if not exists submission_id uuid;
`;

async function runAlter(ref, password, label) {
  const conn = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`[${label}] Connected. Adding max_guest_votes & guest_vote_count columns...`);
  await client.query(ALTER_SQL);
  console.log(`[${label}] Columns added successfully.`);
  await client.end();
}

const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();

console.log("=== Add max_guest_votes on OLD project ===");
await runAlter("qpaoucyjitbmfcahxrqu", oldPass, "OLD");

console.log("=== Add max_guest_votes on SHARED project ===");
await runAlter("pzcwwylxrojvcoihtxep", biz.SUPABASE_DB_PASSWORD, "SHARED");

console.log("Done adding max_guest_votes columns!");
