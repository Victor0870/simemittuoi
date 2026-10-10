/**
 * So sánh project cũ (simemituoi) vs BizMate shared — quyết định xóa cũ được chưa.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const OLD = "qpaoucyjitbmfcahxrqu";
const SHARED = "pzcwwylxrojvcoihtxep";

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

async function tableExists(c, name) {
  const r = await c.query(
    `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
    [name],
  );
  return r.rowCount > 0;
}

async function count(c, sql, params = []) {
  try {
    const r = await c.query(sql, params);
    return r.rows[0]?.n ?? null;
  } catch {
    return null;
  }
}

async function snapshot(c, label) {
  const cdilv = [
    "cdilv_posts",
    "cdilv_activities",
    "cdilv_profiles",
    "cdilv_score_events",
    "cdilv_employee_whitelist",
    "cdilv_employee_score_events",
    "cdilv_leaderboard_cache",
  ];
  const legacy = [
    "posts",
    "activities",
    "profiles",
    "score_events",
    "employee_whitelist",
    "employee_score_events",
    "leaderboard_cache",
  ];

  const out = { label, counts: {}, authUsers: 0, authEmails: [], storage: [] };

  for (const t of cdilv) {
    out.counts[t] = (await tableExists(c, t))
      ? await count(c, `select count(*)::int as n from public.${t}`)
      : "MISSING";
  }
  for (const t of legacy) {
    if (await tableExists(c, t)) {
      out.counts[`legacy.${t}`] = await count(
        c,
        `select count(*)::int as n from public.${t}`,
      );
    }
  }

  const users = await c.query(
    `select id, email, created_at from auth.users order by created_at`,
  );
  out.authUsers = users.rowCount;
  out.authEmails = users.rows.map((u) => ({
    email: u.email,
    id: u.id,
  }));

  // post titles for diff
  if (await tableExists(c, "cdilv_posts")) {
    const posts = await c.query(
      `select id, title, length(content) as content_len, published_at
       from public.cdilv_posts order by published_at desc`,
    );
    out.posts = posts.rows;
  }

  // profiles detail
  if (await tableExists(c, "cdilv_profiles")) {
    const profiles = await c.query(
      `select id, full_name, employee_code, role, approval_status, total_score, rank
       from public.cdilv_profiles order by created_at`,
    );
    out.profiles = profiles.rows;
  }

  // storage buckets
  try {
    const buckets = await c.query(
      `select id, name, public from storage.buckets where id like '%cdilv%' or id like '%avatar%'`,
    );
    out.storage = buckets.rows;
    for (const b of buckets.rows) {
      const n = await count(
        c,
        `select count(*)::int as n from storage.objects where bucket_id=$1`,
        [b.id],
      );
      out.counts[`storage.${b.id}`] = n;
    }
  } catch {
    /* ignore */
  }

  // top leaderboard sample
  if (await tableExists(c, "cdilv_leaderboard_cache")) {
    const top = await c.query(
      `select rank, full_name, employee_code, total_score
       from public.cdilv_leaderboard_cache
       where total_score > 0
       order by rank nulls last
       limit 5`,
    );
    out.top5 = top.rows;
  }

  return out;
}

function diffEmails(oldEmails, newEmails) {
  const oldSet = new Set(oldEmails.map((e) => e.email?.toLowerCase()));
  const newSet = new Set(newEmails.map((e) => e.email?.toLowerCase()));
  const onlyOld = [...oldSet].filter((e) => !newSet.has(e));
  const onlyNew = [...newSet].filter((e) => !oldSet.has(e));
  return { onlyOld, onlyNew };
}

function diffPosts(oldPosts = [], newPosts = []) {
  const byTitle = (arr) =>
    new Map(arr.map((p) => [p.title, p]));
  const o = byTitle(oldPosts);
  const n = byTitle(newPosts);
  const onlyOld = [...o.keys()].filter((t) => !n.has(t));
  const onlyNew = [...n.keys()].filter((t) => !o.has(t));
  const contentDiff = [];
  for (const [title, op] of o) {
    const np = n.get(title);
    if (np && Number(op.content_len) !== Number(np.content_len)) {
      contentDiff.push({
        title,
        oldLen: op.content_len,
        newLen: np.content_len,
      });
    }
  }
  return { onlyOld, onlyNew, contentDiff };
}

const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();

const oldC = await connect(OLD, oldPass);
const newC = await connect(SHARED, biz.SUPABASE_DB_PASSWORD);

const oldSnap = await snapshot(oldC, "OLD/simemituoi");
const newSnap = await snapshot(newC, "SHARED/BizMate");

await oldC.end();
await newC.end();

console.log("=== COUNTS ===");
const keys = new Set([
  ...Object.keys(oldSnap.counts),
  ...Object.keys(newSnap.counts),
]);
for (const k of [...keys].sort()) {
  const a = oldSnap.counts[k];
  const b = newSnap.counts[k];
  const mark = a === b ? "OK" : "DIFF";
  console.log(`${mark}\t${k}\told=${a}\tshared=${b}`);
}

console.log("\n=== AUTH USERS ===");
console.log("OLD count", oldSnap.authUsers, oldSnap.authEmails.map((e) => e.email));
console.log("SHARED count", newSnap.authUsers, newSnap.authEmails.map((e) => e.email));
const emailDiff = diffEmails(oldSnap.authEmails, newSnap.authEmails);
console.log("emails only on OLD:", emailDiff.onlyOld);
console.log("emails only on SHARED:", emailDiff.onlyNew);

console.log("\n=== POSTS ===");
const postDiff = diffPosts(oldSnap.posts, newSnap.posts);
console.log("titles only OLD:", postDiff.onlyOld);
console.log("titles only SHARED:", postDiff.onlyNew);
console.log("content length diffs:", postDiff.contentDiff);

console.log("\n=== PROFILES OLD ===");
console.log(oldSnap.profiles);
console.log("=== PROFILES SHARED ===");
console.log(newSnap.profiles);

console.log("\n=== TOP5 OLD ===");
console.log(oldSnap.top5);
console.log("=== TOP5 SHARED ===");
console.log(newSnap.top5);

console.log("\n=== STORAGE ===");
console.log("OLD", oldSnap.storage, Object.fromEntries(Object.entries(oldSnap.counts).filter(([k]) => k.startsWith("storage."))));
console.log("SHARED", newSnap.storage, Object.fromEntries(Object.entries(newSnap.counts).filter(([k]) => k.startsWith("storage."))));

// local env
const envLocal = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const urlLine = envLocal.split(/\r?\n/).find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL"));
console.log("\n=== LOCAL ENV ===");
console.log(urlLine);
console.log("points to SHARED?", urlLine?.includes(SHARED));
console.log("points to OLD?", urlLine?.includes(OLD));

const blockers = [];
if (emailDiff.onlyOld.length) {
  blockers.push(`Auth users còn trên OLD chưa có trên SHARED: ${emailDiff.onlyOld.join(", ")}`);
}
for (const k of keys) {
  if (k.startsWith("legacy.")) continue;
  const a = oldSnap.counts[k];
  const b = newSnap.counts[k];
  if (typeof a === "number" && typeof b === "number" && a > b) {
    blockers.push(`Bảng ${k}: OLD có ${a} > SHARED ${b}`);
  }
}
if (postDiff.onlyOld.length) {
  blockers.push(`Bài viết chỉ có trên OLD: ${postDiff.onlyOld.join(" | ")}`);
}
if (postDiff.contentDiff.length) {
  blockers.push(
    `Nội dung bài lệch độ dài: ${postDiff.contentDiff.map((d) => d.title).join(" | ")}`,
  );
}

console.log("\n=== VERDICT ===");
if (blockers.length === 0) {
  console.log(
    "DATA: CDILV trên SHARED đã đủ so với OLD (không thấy thiếu rõ). Có thể xóa OLD SAU KHI Vercel/Auth production đã trỏ SHARED và kiểm tra live OK.",
  );
} else {
  console.log("CHƯA NÊN XÓA — còn lệch:");
  for (const b of blockers) console.log("-", b);
}
