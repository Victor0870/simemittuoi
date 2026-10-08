/**
 * Tạo admin CDILV: admin@cdilv.vn / admin@123 trên project shared.
 * Gỡ quyền admin khỏi tthanghp87@gmail.com trên cdilv_profiles (nếu còn).
 */
import fs from "node:fs";
import pg from "pg";

const EMAIL = "admin@cdilv.vn";
const PASSWORD = "admin@123";
const FULL_NAME = "Quản trị CDILV";
const OLD_ADMIN_EMAIL = "tthanghp87@gmail.com";
const PROJECT_URL = "https://pzcwwylxrojvcoihtxep.supabase.co";
const PROJECT_REF = "pzcwwylxrojvcoihtxep";

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

async function createViaAdminApi(secretKey) {
  const res = await fetch(`${PROJECT_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        app: "cdilv",
        full_name: FULL_NAME,
      },
      app_metadata: {
        provider: "email",
        providers: ["email"],
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // đã tồn tại → lấy user
    if (
      String(body?.msg || body?.message || "").toLowerCase().includes("already") ||
      res.status === 422
    ) {
      const list = await fetch(
        `${PROJECT_URL}/auth/v1/admin/users?page=1&per_page=200`,
        {
          headers: {
            apikey: secretKey,
            Authorization: `Bearer ${secretKey}`,
          },
        },
      );
      const data = await list.json();
      const users = data?.users || data || [];
      const found = (Array.isArray(users) ? users : []).find(
        (u) => String(u.email || "").toLowerCase() === EMAIL,
      );
      if (found) {
        // cập nhật password
        const upd = await fetch(
          `${PROJECT_URL}/auth/v1/admin/users/${found.id}`,
          {
            method: "PUT",
            headers: {
              apikey: secretKey,
              Authorization: `Bearer ${secretKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              password: PASSWORD,
              email_confirm: true,
              user_metadata: {
                ...(found.user_metadata || {}),
                app: "cdilv",
                full_name: FULL_NAME,
              },
            }),
          },
        );
        if (!upd.ok) {
          const err = await upd.text();
          throw new Error(`Update user failed: ${upd.status} ${err}`);
        }
        return found.id;
      }
    }
    throw new Error(`Admin API create failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.id;
}

async function ensureProfile(client, userId) {
  // trigger có thể đã tạo profile pending — nâng admin + approved
  await client.query(
    `insert into public.cdilv_profiles (
      id, full_name, department, role, approval_status, approved_at, created_at
    ) values ($1, $2, $3, 'admin', 'approved', now(), now())
    on conflict (id) do update set
      full_name = excluded.full_name,
      role = 'admin',
      approval_status = 'approved',
      approved_at = coalesce(public.cdilv_profiles.approved_at, now())`,
    [userId, FULL_NAME, "Ban chấp hành"],
  );
}

async function demoteOldAdmin(client) {
  const r = await client.query(
    `select u.id, p.role, p.approval_status
     from auth.users u
     left join public.cdilv_profiles p on p.id = u.id
     where lower(u.email) = lower($1)`,
    [OLD_ADMIN_EMAIL],
  );
  if (!r.rows[0]) {
    console.log(`Không thấy ${OLD_ADMIN_EMAIL} trên project shared — bỏ qua demote.`);
    return;
  }
  const id = r.rows[0].id;
  if (!r.rows[0].role) {
    console.log(`${OLD_ADMIN_EMAIL} không có cdilv_profiles — bỏ qua.`);
    return;
  }
  await client.query(
    `update public.cdilv_profiles
     set role = 'user'
     where id = $1`,
    [id],
  );
  console.log(`Đã hạ ${OLD_ADMIN_EMAIL} → role=user (giữ hồ sơ/điểm).`);
}

const biz = loadBiz();
const secret = biz.SUPABASE_SECRET_KEY || biz.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) throw new Error("Thiếu SUPABASE_SECRET_KEY");

console.log("Tạo/cập nhật auth user qua Admin API...");
const userId = await createViaAdminApi(secret);
console.log("user id:", userId);

const client = new pg.Client({
  host: `db.${PROJECT_REF}.supabase.co`,
  port: 5432,
  user: "postgres",
  password: biz.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();

await ensureProfile(client, userId);
await demoteOldAdmin(client);

const check = await client.query(
  `select u.email, p.full_name, p.role, p.approval_status
   from auth.users u
   join public.cdilv_profiles p on p.id = u.id
   where u.id = $1`,
  [userId],
);
console.log("Admin CDILV:", check.rows[0]);

await client.end();
console.log("Xong. Đăng nhập:", EMAIL, "/", PASSWORD);
