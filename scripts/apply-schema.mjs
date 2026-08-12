import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const PROJECT_REF = "qpaoucyjitbmfcahxrqu";

function readDbPassword() {
  const passFile = path.join(projectRoot, "pas data.txt");
  if (!fs.existsSync(passFile)) {
    throw new Error("Không tìm thấy pas data.txt");
  }
  return fs.readFileSync(passFile, "utf8").trim();
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

  const schemaPath = path.join(projectRoot, "supabase", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  console.log("Đang kết nối Supabase Postgres...");
  await client.connect();
  console.log("Đang chạy schema.sql...");
  await client.query(sql);
  console.log("Hoàn tất schema + seed posts/activities.");
  await client.end();
}

main().catch((err) => {
  console.error("Lỗi apply schema:", err.message);
  process.exit(1);
});
