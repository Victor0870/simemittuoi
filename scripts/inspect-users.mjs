import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const password = fs.readFileSync(path.join(projectRoot, "pas data.txt"), "utf8").trim();

const client = new pg.Client({
  host: "db.qpaoucyjitbmfcahxrqu.supabase.co",
  port: 5432,
  user: "postgres",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const users = await client.query(
  `select id, email, created_at, raw_user_meta_data
   from auth.users
   order by created_at desc
   limit 10`,
);
console.log("AUTH_USERS", users.rows.length);
for (const row of users.rows) {
  console.log(JSON.stringify(row));
}

const profiles = await client.query(`select count(*)::int as c from public.profiles`);
console.log("PROFILES_COUNT", profiles.rows[0].c);

const profileRows = await client.query(
  `select id, full_name, employee_code, role, approval_status, created_at
   from public.profiles
   order by created_at desc
   limit 10`,
);
console.log("PROFILES");
for (const row of profileRows.rows) {
  console.log(JSON.stringify(row));
}

const trigger = await client.query(
  `select tgname from pg_trigger where tgname = 'on_auth_user_created'`,
);
console.log("TRIGGER", trigger.rows);

await client.end();
