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

const sql = `
  drop policy if exists "cdilv_score_events_admin_write" on public.cdilv_score_events;
  drop policy if exists "cdilv_score_events_admin_all" on public.cdilv_score_events;
  create policy "cdilv_score_events_admin_all" on public.cdilv_score_events
    for all
    using (
      exists (
        select 1 from public.cdilv_profiles
        where id = auth.uid() and role = 'admin' and approval_status = 'approved'
      )
    )
    with check (
      exists (
        select 1 from public.cdilv_profiles
        where id = auth.uid() and role = 'admin' and approval_status = 'approved'
      )
    );
`;

const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();

for (const [ref, pass, label] of [
  ["qpaoucyjitbmfcahxrqu", oldPass, "OLD"],
  ["pzcwwylxrojvcoihtxep", biz.SUPABASE_DB_PASSWORD, "SHARED"],
]) {
  try {
    const client = new pg.Client({
      host: `db.${ref}.supabase.co`,
      port: 5432,
      user: "postgres",
      password: pass,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(sql);
    console.log(label, "RLS policy cdilv_score_events_admin_all updated successfully!");
    await client.end();
  } catch (e) {
    console.error(label, "error:", e.message);
  }
}
