import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import XLSX from "xlsx";

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

function findExcelFile() {
  const files = fs.readdirSync(projectRoot).filter((n) => n.toLowerCase().endsWith(".xlsx"));
  if (files.length === 0) {
    throw new Error("Không tìm thấy file .xlsx danh sách nhân viên trong D:\\CDCS");
  }
  return path.join(projectRoot, files[0]);
}

function loadEmployees() {
  const excelPath = findExcelFile();
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const employees = [];
  for (const row of rows) {
    const codeRaw = row["Mã NV  (Staff code)"] ?? row["Mã NV (Staff code)"] ?? "";
    const nameRaw =
      row["Họ và Tên\r\n( Full Name)"] ??
      row["Họ và Tên ( Full Name)"] ??
      row["Họ và Tên"] ??
      "";
    const deptRaw = row["Bộ phận\r\n( Dept)"] ?? row["Bộ phận ( Dept)"] ?? row["Bộ phận"] ?? "";

    const employee_code = String(codeRaw).trim();
    const full_name = String(nameRaw).trim();
    const department = String(deptRaw).trim() || null;

    if (!employee_code || !full_name) continue;
    if (/^no\s*stt$/i.test(employee_code)) continue;

    employees.push({ employee_code, full_name, department });
  }

  return { excelPath, employees };
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

  const migrationPath = path.join(projectRoot, "supabase", "migration_auth_approval.sql");
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  const { excelPath, employees } = loadEmployees();

  console.log("Excel:", excelPath);
  console.log("Số nhân viên đọc được:", employees.length);
  console.log("Đang kết nối Supabase...");
  await client.connect();

  console.log("Đang chạy migration_auth_approval.sql...");
  await client.query(migrationSql);

  console.log("Đang upsert whitelist...");
  let upserted = 0;
  for (const emp of employees) {
    await client.query(
      `insert into public.employee_whitelist (employee_code, full_name, department, is_active)
       values ($1, $2, $3, true)
       on conflict (employee_code) do update set
         full_name = excluded.full_name,
         department = excluded.department,
         is_active = true`,
      [emp.employee_code, emp.full_name, emp.department],
    );
    upserted += 1;
  }

  const { rows } = await client.query(
    "select count(*)::int as c from public.employee_whitelist where is_active = true",
  );
  console.log("Upsert xong:", upserted);
  console.log("Whitelist active:", rows[0].c);

  await client.end();
  console.log("Hoàn tất migration + import whitelist.");
}

main().catch((err) => {
  console.error("Lỗi:", err.message);
  process.exit(1);
});
