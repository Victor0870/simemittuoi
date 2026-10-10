/**
 * Project cũ (qpaoucyjitbmfcahxrqu) vừa có bảng cdilv_* trống.
 * Copy từ bảng legacy public.posts/activities/... sang cdilv_* + refresh cache.
 * Reload PostgREST schema.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const REF = "qpaoucyjitbmfcahxrqu";

const pass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();
const client = new pg.Client({
  host: `db.${REF}.supabase.co`,
  port: 5432,
  user: "postgres",
  password: pass,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();

async function exists(name) {
  const r = await client.query(
    `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
    [name],
  );
  return r.rowCount > 0;
}

async function count(name) {
  const r = await client.query(`select count(*)::int as n from public.${name}`);
  return r.rows[0].n;
}

if (await exists("posts")) {
  await client.query(`
    insert into public.cdilv_posts (id, title, content, tag, tag_tone, image_url, author_id, published_at)
    select id, title, content, tag, tag_tone, image_url, null, published_at
    from public.posts
    on conflict (id) do nothing
  `);
  console.log("posts → cdilv_posts:", await count("cdilv_posts"));
}

if (await exists("activities")) {
  await client.query(`
    insert into public.cdilv_activities (
      id, title, description, location, event_date, points, image_url, image_alt, created_at
    )
    select id, title, description, location, event_date, points, image_url, image_alt, created_at
    from public.activities
    on conflict (id) do nothing
  `);
  console.log("activities → cdilv_activities:", await count("cdilv_activities"));
}

if (await exists("employee_whitelist")) {
  await client.query(`
    insert into public.cdilv_employee_whitelist (employee_code, full_name, department, is_active, created_at)
    select employee_code, full_name, department, is_active, created_at
    from public.employee_whitelist
    on conflict (employee_code) do update set
      full_name = excluded.full_name,
      department = coalesce(excluded.department, public.cdilv_employee_whitelist.department),
      is_active = excluded.is_active
  `);
  console.log("whitelist → cdilv_employee_whitelist:", await count("cdilv_employee_whitelist"));
}

if (await exists("employee_score_events")) {
  await client.query(`
    insert into public.cdilv_employee_score_events (
      id, employee_code, points, note, award_label, source,
      transferred_to, transferred_at, created_at
    )
    select id, employee_code, points, note, award_label, source,
           null, null, created_at
    from public.employee_score_events
    on conflict (id) do nothing
  `);
  console.log(
    "employee_score_events → cdilv_employee_score_events:",
    await count("cdilv_employee_score_events"),
  );
}

if (await exists("profiles")) {
  await client.query(`
    insert into public.cdilv_profiles (
      id, full_name, department, role, avatar_url, employee_code,
      approval_status, approved_at, total_score, rank, created_at
    )
    select id, full_name, department, role, avatar_url, employee_code,
           coalesce(approval_status, 'pending'), approved_at,
           coalesce(total_score, 0), rank, created_at
    from public.profiles
    on conflict (id) do update set
      full_name = excluded.full_name,
      role = excluded.role,
      employee_code = coalesce(excluded.employee_code, public.cdilv_profiles.employee_code),
      approval_status = excluded.approval_status,
      approved_at = excluded.approved_at
  `);
  console.log("profiles → cdilv_profiles:", await count("cdilv_profiles"));
}

if (await exists("score_events")) {
  await client.query(`
    insert into public.cdilv_score_events (
      id, user_id, activity_id, points, note, employee_code, award_label, created_by, created_at
    )
    select se.id, se.user_id, null, se.points, se.note, se.employee_code, se.award_label, null, se.created_at
    from public.score_events se
    where exists (select 1 from public.cdilv_profiles p where p.id = se.user_id)
    on conflict (id) do nothing
  `);
  console.log("score_events → cdilv_score_events:", await count("cdilv_score_events"));
}

await client.query(`select public.cdilv_refresh_leaderboard_cache()`);
console.log("leaderboard_cache:", await count("cdilv_leaderboard_cache"));

await client.query(`notify pgrst, 'reload schema'`);
await client.query(`notify pgrst, 'reload config'`);
console.log("PostgREST schema reloaded on", REF);

await client.end();
