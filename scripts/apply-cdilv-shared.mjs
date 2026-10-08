/**
 * Apply schema CDILV (prefix cdilv_*) lên project Supabase dùng chung với BizMate.
 *
 * Env:
 *   SUPABASE_PROJECT_REF  — mặc định project BizMate
 *   SUPABASE_DB_PASSWORD  — hoặc file "pas data.txt" (BizMate / CDILV)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF?.trim() || "pzcwwylxrojvcoihtxep";

function readDbPassword() {
  if (process.env.SUPABASE_DB_PASSWORD?.trim()) {
    return process.env.SUPABASE_DB_PASSWORD.trim();
  }
  for (const name of ["pas data.txt", "pas data bizmate.txt"]) {
    const passFile = path.join(projectRoot, name);
    if (fs.existsSync(passFile)) {
      return fs.readFileSync(passFile, "utf8").trim();
    }
  }
  throw new Error(
    "Thiếu SUPABASE_DB_PASSWORD hoặc file pas data.txt / pas data bizmate.txt",
  );
}

async function main() {
  const password = readDbPassword();
  const client = new pg.Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });

  const schemaPath = path.join(
    projectRoot,
    "supabase",
    "cdilv_on_shared_project.sql",
  );
  const sql = fs.readFileSync(schemaPath, "utf8");

  console.log(`Đang kết nối db.${PROJECT_REF}.supabase.co ...`);
  await client.connect();
  console.log("Đang chạy cdilv_on_shared_project.sql ...");
  await client.query(sql);
  console.log("Hoàn tất: bảng/RPC/view cdilv_* + bucket cdilv-avatars.");
  await client.end();
}

main().catch((err) => {
  console.error("Lỗi apply CDILV shared schema:", err.message);
  process.exit(1);
});
