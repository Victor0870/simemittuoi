/**
 * Copy dữ liệu CDILV từ project cũ → bảng cdilv_* trên project BizMate.
 * Không đụng bảng POS / invoice / hkd.
 *
 * Env: OLD_DB_PASSWORD (hoặc pas data.txt), NEW_DB_PASSWORD (hoặc bizmate supabase.local.env)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const OLD_REF = "qpaoucyjitbmfcahxrqu";
const NEW_REF = "pzcwwylxrojvcoihtxep";

function readPass(candidates) {
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  }
  return null;
}

function loadBizmateEnv() {
  const p = "D:/Flutter/bizmate_app/supabase.local.env";
  if (!fs.existsSync(p)) return {};
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
  const client = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function tableExists(client, name) {
  const r = await client.query(
    `select 1 from information_schema.tables
     where table_schema='public' and table_name=$1`,
    [name],
  );
  return r.rowCount > 0;
}

async function copyTable(oldC, newC, {
  source,
  target,
  columns,
  conflict,
  transform,
}) {
  const exists = await tableExists(oldC, source);
  if (!exists) {
    console.log(`SKIP ${source} (không có trên project cũ)`);
    return 0;
  }
  const cols = columns.join(", ");
  const { rows } = await oldC.query(`select ${cols} from public.${source}`);
  if (!rows.length) {
    console.log(`OK ${source} → ${target}: 0 rows`);
    return 0;
  }

  let n = 0;
  for (const row of rows) {
    const values = columns.map((c) => {
      const v = row[c];
      return transform?.[c] ? transform[c](v, row) : v;
    });
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const sql = conflict
      ? `insert into public.${target} (${cols}) values (${placeholders})
         on conflict ${conflict}`
      : `insert into public.${target} (${cols}) values (${placeholders})
         on conflict do nothing`;
    try {
      await newC.query(sql, values);
      n += 1;
    } catch (e) {
      console.warn(`  warn ${target}:`, e.message);
    }
  }
  console.log(`OK ${source} → ${target}: ${n}/${rows.length}`);
  return n;
}

async function main() {
  const biz = loadBizmateEnv();
  const oldPass =
    process.env.OLD_DB_PASSWORD ||
    readPass([path.join(root, "pas data.txt")]);
  const newPass =
    process.env.NEW_DB_PASSWORD ||
    biz.SUPABASE_DB_PASSWORD ||
    readPass([path.join(root, "pas data bizmate.txt")]);

  if (!oldPass || !newPass) {
    throw new Error("Thiếu mật khẩu DB cũ hoặc mới");
  }

  const oldC = await connect(OLD_REF, oldPass);
  const newC = await connect(NEW_REF, newPass);
  console.log(`OLD ${OLD_REF} → NEW ${NEW_REF} (cdilv_*)`);

  // 1) Whitelist — không phụ thuộc auth
  await copyTable(oldC, newC, {
    source: "employee_whitelist",
    target: "cdilv_employee_whitelist",
    columns: ["employee_code", "full_name", "department", "is_active", "created_at"],
    conflict: `(employee_code) do update set
      full_name = excluded.full_name,
      department = coalesce(excluded.department, public.cdilv_employee_whitelist.department),
      is_active = excluded.is_active`,
  });

  // 2) Posts / activities — author_id có thể null
  await copyTable(oldC, newC, {
    source: "posts",
    target: "cdilv_posts",
    columns: [
      "id",
      "title",
      "content",
      "tag",
      "tag_tone",
      "image_url",
      "author_id",
      "published_at",
    ],
    conflict: "(id) do nothing",
    transform: {
      author_id: () => null, // user chưa migrate → bỏ FK
    },
  });

  await copyTable(oldC, newC, {
    source: "activities",
    target: "cdilv_activities",
    columns: [
      "id",
      "title",
      "description",
      "location",
      "event_date",
      "points",
      "image_url",
      "image_alt",
      "created_at",
    ],
    conflict: "(id) do nothing",
  });

  // 3) Điểm seed theo mã NV
  await copyTable(oldC, newC, {
    source: "employee_score_events",
    target: "cdilv_employee_score_events",
    columns: [
      "id",
      "employee_code",
      "points",
      "note",
      "award_label",
      "source",
      "transferred_to",
      "transferred_at",
      "created_at",
    ],
    conflict: "(id) do nothing",
    transform: {
      transferred_to: () => null,
      transferred_at: () => null,
    },
  });

  // 4) Auth users + profiles (nếu có)
  const oldUsers = await oldC.query(`
    select id, email, encrypted_password, email_confirmed_at, raw_user_meta_data,
           created_at, updated_at, aud, role, instance_id,
           confirmation_token, recovery_token, email_change_token_new,
           email_change, last_sign_in_at, raw_app_meta_data,
           is_super_admin, phone, phone_confirmed_at, confirmation_sent_at,
           recovery_sent_at, email_change_sent_at, email_change_token_current,
           email_change_confirm_status, banned_until, reauthentication_token,
           reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous
    from auth.users
  `);
  console.log(`OLD auth.users: ${oldUsers.rows.length}`);

  for (const u of oldUsers.rows) {
    const exists = await newC.query(`select 1 from auth.users where id=$1`, [
      u.id,
    ]);
    if (exists.rowCount) {
      console.log(`  auth user exists: ${u.email}`);
      continue;
    }
    const emailTaken = await newC.query(
      `select 1 from auth.users where lower(email)=lower($1)`,
      [u.email],
    );
    if (emailTaken.rowCount) {
      console.warn(`  SKIP auth email trùng trên BizMate: ${u.email}`);
      continue;
    }

    try {
      await newC.query(
        `insert into auth.users (
          id, instance_id, aud, role, email, encrypted_password,
          email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
          recovery_token, recovery_sent_at, email_change_token_new, email_change,
          email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
          is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
          email_change_token_current, email_change_confirm_status, banned_until,
          reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at,
          is_anonymous
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
          $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31
        )`,
        [
          u.id,
          u.instance_id,
          u.aud || "authenticated",
          u.role || "authenticated",
          u.email,
          u.encrypted_password,
          u.email_confirmed_at,
          null,
          u.confirmation_token || "",
          u.confirmation_sent_at,
          u.recovery_token || "",
          u.recovery_sent_at,
          u.email_change_token_new || "",
          u.email_change || "",
          u.email_change_sent_at,
          u.last_sign_in_at,
          u.raw_app_meta_data || {},
          {
            ...(u.raw_user_meta_data || {}),
            app: "cdilv",
          },
          u.is_super_admin,
          u.created_at,
          u.updated_at,
          u.phone,
          u.phone_confirmed_at,
          u.email_change_token_current || "",
          u.email_change_confirm_status ?? 0,
          u.banned_until,
          u.reauthentication_token || "",
          u.reauthentication_sent_at,
          u.is_sso_user ?? false,
          u.deleted_at,
          u.is_anonymous ?? false,
        ],
      );
      console.log(`  auth inserted: ${u.email}`);
    } catch (e) {
      console.warn(`  auth insert fail ${u.email}:`, e.message);
    }

    // identities (email provider) nếu có
    const ids = await oldC.query(
      `select * from auth.identities where user_id=$1`,
      [u.id],
    );
    for (const idn of ids.rows) {
      try {
        await newC.query(
          `insert into auth.identities (
            id, user_id, identity_data, provider, provider_id, last_sign_in_at,
            created_at, updated_at, email
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          on conflict do nothing`,
          [
            idn.id,
            idn.user_id,
            idn.identity_data,
            idn.provider,
            idn.provider_id ?? idn.identity_data?.sub ?? idn.id,
            idn.last_sign_in_at,
            idn.created_at,
            idn.updated_at,
            idn.email ?? u.email,
          ],
        );
      } catch (e) {
        console.warn(`  identity warn:`, e.message);
      }
    }
  }

  // Profiles CDILV
  const hasOldProfiles = await tableExists(oldC, "profiles");
  if (hasOldProfiles) {
    const { rows: profiles } = await oldC.query(`select * from public.profiles`);
    for (const p of profiles) {
      const userOk = await newC.query(`select 1 from auth.users where id=$1`, [
        p.id,
      ]);
      if (!userOk.rowCount) {
        console.warn(`  SKIP profile (chưa có auth.users): ${p.full_name}`);
        continue;
      }
      try {
        await newC.query(
          `insert into public.cdilv_profiles (
            id, full_name, department, role, avatar_url, employee_code,
            approval_status, approved_at, approved_by, total_score, rank, created_at
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          on conflict (id) do update set
            full_name = excluded.full_name,
            department = coalesce(excluded.department, public.cdilv_profiles.department),
            role = excluded.role,
            avatar_url = coalesce(excluded.avatar_url, public.cdilv_profiles.avatar_url),
            employee_code = coalesce(excluded.employee_code, public.cdilv_profiles.employee_code),
            approval_status = excluded.approval_status,
            approved_at = excluded.approved_at,
            total_score = excluded.total_score,
            rank = excluded.rank`,
          [
            p.id,
            p.full_name,
            p.department ?? null,
            p.role ?? "user",
            p.avatar_url ?? null,
            p.employee_code ?? null,
            p.approval_status ?? "pending",
            p.approved_at ?? null,
            null,
            p.total_score ?? 0,
            p.rank ?? null,
            p.created_at ?? new Date().toISOString(),
          ],
        );
        console.log(`  profile: ${p.full_name} (${p.employee_code})`);
      } catch (e) {
        console.warn(`  profile fail:`, e.message);
      }
    }
  }

  // score_events gắn user đã có
  if (await tableExists(oldC, "score_events")) {
    const { rows: events } = await oldC.query(
      `select * from public.score_events`,
    );
    let n = 0;
    for (const e of events) {
      const ok = await newC.query(
        `select 1 from public.cdilv_profiles where id=$1`,
        [e.user_id],
      );
      if (!ok.rowCount) continue;
      try {
        await newC.query(
          `insert into public.cdilv_score_events (
            id, user_id, activity_id, points, note, employee_code, award_label,
            created_by, created_at
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          on conflict (id) do nothing`,
          [
            e.id,
            e.user_id,
            null,
            e.points,
            e.note ?? null,
            e.employee_code ?? null,
            e.award_label ?? null,
            null,
            e.created_at,
          ],
        );
        n += 1;
      } catch (err) {
        console.warn(`  score_event warn:`, err.message);
      }
    }
    console.log(`OK score_events → cdilv_score_events: ${n}/${events.length}`);
  }

  // Refresh leaderboard cache
  try {
    await newC.query(`select public.cdilv_refresh_leaderboard_cache()`);
    console.log("OK refresh cdilv_leaderboard_cache");
  } catch (e) {
    console.warn("refresh leaderboard:", e.message);
  }

  // Summary
  for (const t of [
    "cdilv_employee_whitelist",
    "cdilv_posts",
    "cdilv_activities",
    "cdilv_employee_score_events",
    "cdilv_profiles",
    "cdilv_score_events",
    "cdilv_leaderboard_cache",
  ]) {
    const r = await newC.query(`select count(*)::int as n from public.${t}`);
    console.log(`COUNT ${t}: ${r.rows[0].n}`);
  }

  await oldC.end();
  await newC.end();
  console.log("Migrate xong.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
