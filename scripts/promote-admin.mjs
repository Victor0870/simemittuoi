import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const PROJECT_REF = "qpaoucyjitbmfcahxrqu";

async function main() {
  const password = fs.readFileSync(path.join(projectRoot, "pas data.txt"), "utf8").trim();
  const emailArg = process.argv[2] || null;

  const client = new pg.Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const list = await client.query(`
    select p.id, p.full_name, p.employee_code, p.role, p.approval_status, p.created_at, u.email
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc
    limit 10
  `);

  console.log("USERS_RECENT:");
  for (const row of list.rows) {
    console.log(JSON.stringify(row));
  }

  if (list.rows.length === 0) {
    throw new Error("Chưa có profile nào trong database.");
  }

  let target = list.rows[0];
  if (emailArg) {
    const found = list.rows.find(
      (r) => (r.email || "").toLowerCase() === emailArg.toLowerCase(),
    );
    if (!found) {
      throw new Error(`Không tìm thấy email trong 10 user mới nhất: ${emailArg}`);
    }
    target = found;
  }

  const upd = await client.query(
    `
    update public.profiles
    set role = 'admin',
        approval_status = 'approved',
        approved_at = now()
    where id = $1
    returning id, full_name, employee_code, role, approval_status
  `,
    [target.id],
  );

  console.log("PROMOTED:");
  console.log(JSON.stringify({ ...upd.rows[0], email: target.email }));

  await client.end();
}

main().catch((err) => {
  console.error("ERR:", err.message);
  process.exit(1);
});
