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
    path.join(projectRoot, "supabase", "migration_leaderboard_cache.sql"),
    "utf8",
  );

  await client.connect();
  console.log("Applying migration_leaderboard_cache.sql...");
  await client.query(sql);

  const top = await client.query(
    `select rank, full_name, total_score from leaderboard order by rank limit 5`,
  );
  console.log("TOP5 from cache view:");
  for (const r of top.rows) console.log(JSON.stringify(r));

  const me = await client.query(
    `select full_name, total_score, rank from profiles where employee_code = '0370'`,
  );
  console.log("Profile cached rank:", me.rows[0]);

  const cnt = await client.query(`select count(*)::int as n from leaderboard_cache`);
  console.log("cache rows:", cnt.rows[0].n);

  await client.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("ERR:", err.message);
  process.exit(1);
});
