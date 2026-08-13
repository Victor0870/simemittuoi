import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const PROJECT_REF = "qpaoucyjitbmfcahxrqu";

function readDbPassword() {
  return fs.readFileSync(path.join(projectRoot, "pas data.txt"), "utf8").trim();
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

  const sql = fs.readFileSync(
    path.join(projectRoot, "supabase", "migration_bonus_scores.sql"),
    "utf8",
  );

  await client.connect();
  console.log("Applying migration_bonus_scores.sql...");
  await client.query(sql);
  console.log("Done.");
  await client.end();
}

main().catch((err) => {
  console.error("ERR:", err.message);
  process.exit(1);
});
