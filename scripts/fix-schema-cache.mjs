/**
 * 1) Reload PostgREST schema cache trên project shared (và old nếu có).
 * 2) Báo cáo bảng cdilv_* có/không.
 * 3) Nếu project cũ thiếu bảng — apply cdilv_on_shared_project.sql (idempotent).
 */
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

async function connect(ref, password) {
  const c = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  return c;
}

async function listCdilv(client) {
  const r = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_name like 'cdilv_%'
    order by 1
  `);
  return r.rows.map((x) => x.table_name);
}

async function reloadSchema(client, label) {
  await client.query(`notify pgrst, 'reload schema'`);
  await client.query(`notify pgrst, 'reload config'`);
  console.log(`${label}: notified PostgREST reload schema/config`);
}

const SHARED = "pzcwwylxrojvcoihtxep";
const OLD = "qpaoucyjitbmfcahxrqu";
const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();
const sql = fs.readFileSync(
  path.join(root, "supabase", "cdilv_on_shared_project.sql"),
  "utf8",
);

const shared = await connect(SHARED, biz.SUPABASE_DB_PASSWORD);
let tables = await listCdilv(shared);
console.log("SHARED tables:", tables.join(", ") || "(none)");
await reloadSchema(shared, "SHARED");
await shared.end();

const old = await connect(OLD, oldPass);
tables = await listCdilv(old);
console.log("OLD tables:", tables.join(", ") || "(none)");

if (!tables.includes("cdilv_posts")) {
  console.log("OLD thiếu cdilv_* — đang apply cdilv_on_shared_project.sql ...");
  await old.query(sql);
  tables = await listCdilv(old);
  console.log("OLD tables after apply:", tables.join(", ") || "(none)");
}

await reloadSchema(old, "OLD");
await old.end();

// REST smoke trên cả hai (shared cần publishable; old thử lấy từ env nếu có)
const pub = biz.SUPABASE_PUBLISHABLE_KEY;
for (const [ref, key] of [[SHARED, pub]]) {
  const url = `https://${ref}.supabase.co/rest/v1/cdilv_posts?select=id&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  console.log(`REST ${ref} cdilv_posts:`, res.status, await res.text().then((t) => t.slice(0, 80)));
}

console.log("Done. Nếu Vercel trỏ project cũ — đã có bảng. Nếu trỏ shared — đã reload cache.");
