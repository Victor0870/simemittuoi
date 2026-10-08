import fs from "node:fs";
import pg from "pg";

const EMAIL = "tthanghp87@gmail.com";
const OLD_REF = "qpaoucyjitbmfcahxrqu";
const NEW_REF = "pzcwwylxrojvcoihtxep";

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

const biz = loadBiz();
const oldPass = fs.readFileSync("D:/CDCS/pas data.txt", "utf8").trim();
const oldC = await connect(OLD_REF, oldPass);
const newC = await connect(NEW_REF, biz.SUPABASE_DB_PASSWORD);

const ou = await oldC.query(
  `select id from auth.users where lower(email)=lower($1)`,
  [EMAIL],
);
const nu = await newC.query(
  `select id from auth.users where lower(email)=lower($1)`,
  [EMAIL],
);

if (!ou.rows[0] || !nu.rows[0]) {
  console.log("Missing user on old or new", ou.rows[0], nu.rows[0]);
  process.exit(1);
}

const { rows: profiles } = await oldC.query(
  `select * from public.profiles where id=$1`,
  [ou.rows[0].id],
);
const p = profiles[0];
if (!p) {
  console.log("No old profile");
  process.exit(1);
}

const newId = nu.rows[0].id;
await newC.query(
  `insert into public.cdilv_profiles (
    id, full_name, department, role, avatar_url, employee_code,
    approval_status, approved_at, total_score, rank, created_at
  ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    employee_code = coalesce(excluded.employee_code, public.cdilv_profiles.employee_code),
    approval_status = excluded.approval_status,
    approved_at = excluded.approved_at`,
  [
    newId,
    p.full_name,
    p.department,
    p.role || "admin",
    p.avatar_url,
    p.employee_code,
    p.approval_status || "approved",
    p.approved_at || new Date().toISOString(),
    p.total_score || 0,
    p.rank,
    p.created_at,
  ],
);
console.log("linked", newId, p.full_name, p.role, p.employee_code);

if (p.employee_code) {
  const t = await newC.query(
    `select public.cdilv_transfer_employee_scores($1,$2) as n`,
    [newId, p.employee_code],
  );
  console.log("transferred", t.rows[0].n);
}

await newC.query(`select public.cdilv_refresh_leaderboard_cache()`);
const cnt = await newC.query(
  `select count(*)::int as n from public.cdilv_profiles`,
);
console.log("cdilv_profiles", cnt.rows[0].n);

await oldC.end();
await newC.end();
