/** Tạo admin@cdilv.vn trên project cũ (production Vercel đang trỏ). */
import fs from "node:fs";
import pg from "pg";

const EMAIL = "admin@cdilv.vn";
const PASSWORD = "admin@123";
const FULL_NAME = "Quản trị CDILV";
const URL = "https://qpaoucyjitbmfcahxrqu.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwYW91Y3lqaXRibWZjYWh4cnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MTY0MzQsImV4cCI6MjEwMjA5MjQzNH0.WeLE_-UV0sIbmj8NyZ4w0ilWtyuGmgXsdLZa5WHGOaQ";

const signup = await fetch(`${URL}/auth/v1/signup`, {
  method: "POST",
  headers: {
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
    data: { app: "cdilv", full_name: FULL_NAME },
  }),
});
const body = await signup.json();
console.log("signup status", signup.status, body?.id || body?.user?.id || body?.msg || body?.message);

const pass = fs.readFileSync("pas data.txt", "utf8").trim();
const c = new pg.Client({
  host: "db.qpaoucyjitbmfcahxrqu.supabase.co",
  port: 5432,
  user: "postgres",
  password: pass,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const u = await c.query(
  `select id from auth.users where lower(email)=lower($1)`,
  [EMAIL],
);
if (!u.rows[0]) {
  console.error("User not found after signup");
  process.exit(1);
}
const id = u.rows[0].id;

await c.query(
  `update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now()),
       raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
         || jsonb_build_object('app', 'cdilv', 'full_name', $2::text)
   where id = $1::uuid`,
  [id, FULL_NAME],
);

await c.query(
  `insert into public.cdilv_profiles (
    id, full_name, department, role, approval_status, approved_at, created_at
  ) values ($1, $2, 'Ban chấp hành', 'admin', 'approved', now(), now())
  on conflict (id) do update set
    role = 'admin',
    approval_status = 'approved',
    approved_at = coalesce(public.cdilv_profiles.approved_at, now()),
    full_name = excluded.full_name`,
  [id, FULL_NAME],
);

const check = await c.query(
  `select u.email, p.role, p.approval_status from auth.users u
   join public.cdilv_profiles p on p.id = u.id where u.id = $1`,
  [id],
);
console.log("admin ready:", check.rows[0]);
await c.end();
