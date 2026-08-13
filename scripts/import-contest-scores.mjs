import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const PROJECT_REF = "qpaoucyjitbmfcahxrqu";
const NOTE_BASE = "Đạt giải cuộc thi tìm hiểu pháp luật";
const SOURCE = "phap_luat_2026";

function readDbPassword() {
  return fs.readFileSync(path.join(projectRoot, "pas data.txt"), "utf8").trim();
}

function findScoreExcel() {
  const preferred = path.join(projectRoot, "Ket_qua_cuoc_thi_da_dien_ma_nv.xlsx");
  if (fs.existsSync(preferred)) return preferred;
  const hit = fs
    .readdirSync(projectRoot)
    .find((n) => n.toLowerCase().includes("ket_qua") && n.toLowerCase().endsWith(".xlsx"));
  if (!hit) throw new Error("Không tìm thấy file Excel kết quả cuộc thi");
  return path.join(projectRoot, hit);
}

/** Tách các khoản điểm theo quy tắc giải */
function buildAwards(row) {
  const awards = [];
  const city = String(row["Giải Thành Phố"] || "").trim();
  const ilv = String(row["Giải ILV"] || "").trim();

  if (/cống\s*hiến/i.test(city)) {
    awards.push({
      points: 20,
      award_label: "Giải Cống hiến thành phố",
      note: `${NOTE_BASE} — Giải Cống hiến thành phố (+20)`,
    });
  }

  const ilvNorm = ilv.toLowerCase();
  if (ilvNorm === "nhất") {
    awards.push({
      points: 50,
      award_label: "Giải ILV Nhất",
      note: `${NOTE_BASE} — Giải nội bộ Nhất (+50)`,
    });
  } else if (ilvNorm === "nhì") {
    awards.push({
      points: 40,
      award_label: "Giải ILV Nhì",
      note: `${NOTE_BASE} — Giải nội bộ Nhì (+40)`,
    });
  } else if (ilvNorm === "ba") {
    awards.push({
      points: 30,
      award_label: "Giải ILV Ba",
      note: `${NOTE_BASE} — Giải nội bộ Ba (+30)`,
    });
  } else if (/khuyến\s*khích/i.test(ilv)) {
    awards.push({
      points: 20,
      award_label: "Giải ILV Khuyến khích",
      note: `${NOTE_BASE} — Giải nội bộ Khuyến khích (+20)`,
    });
  } else if (/cống\s*hiến/i.test(ilv)) {
    awards.push({
      points: 10,
      award_label: "Giải Cống hiến công ty",
      note: `${NOTE_BASE} — Cống hiến công ty (+10)`,
    });
  }

  return awards;
}

async function main() {
  const password = readDbPassword();
  const excelPath = findScoreExcel();
  const workbook = XLSX.readFile(excelPath);
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
    defval: "",
  });

  // Mỗi mã NV chỉ giữ 1 dòng — ưu tiên xếp hạng thành phố tốt hơn (số nhỏ hơn)
  const rankKey = "Xếp hạng cá nhân theo thành phố";
  const bestByCode = new Map();
  for (const row of rawRows) {
    const code = String(row["Mã Nhân Viên"] || "").trim();
    if (!code) continue;
    const rank = Number(row[rankKey]);
    const rankNum = Number.isFinite(rank) ? rank : Number.POSITIVE_INFINITY;
    const prev = bestByCode.get(code);
    if (!prev || rankNum < prev.rankNum) {
      bestByCode.set(code, { row, rankNum });
    }
  }
  const rows = [...bestByCode.values()].map((x) => x.row);
  if (rawRows.length !== rows.length) {
    console.log(
      `Deduped excel rows: ${rawRows.length} → ${rows.length} (kept best city rank per mã NV)`,
    );
  }

  const client = new pg.Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Excel:", excelPath);
  console.log("Rows:", rows.length);

  const migration = fs.readFileSync(
    path.join(projectRoot, "supabase", "migration_score_seed.sql"),
    "utf8",
  );
  console.log("Applying migration_score_seed.sql...");
  await client.query(migration);

  // Xóa seed cũ cùng source (cho phép chạy lại)
  await client.query(
    `delete from public.employee_score_events where source = $1 and transferred_to is null`,
    [SOURCE],
  );

  let eventCount = 0;
  let people = 0;
  const totals = new Map();

  for (const row of rows) {
    const code = String(row["Mã Nhân Viên"] || "").trim();
    const name = String(row["Tên người thi"] || "").trim();
    if (!code) continue;

    const awards = buildAwards(row);
    if (awards.length === 0) continue;

    people += 1;

    // Bổ sung whitelist nếu thiếu
    await client.query(
      `insert into public.employee_whitelist (employee_code, full_name, department, is_active)
       values ($1, $2, null, true)
       on conflict (employee_code) do update set
         full_name = coalesce(nullif(excluded.full_name, ''), public.employee_whitelist.full_name),
         is_active = true`,
      [code, name || code],
    );

    for (const award of awards) {
      await client.query(
        `insert into public.employee_score_events
          (employee_code, points, note, award_label, source)
         values ($1, $2, $3, $4, $5)`,
        [code, award.points, award.note, award.award_label, SOURCE],
      );
      eventCount += 1;
      totals.set(code, (totals.get(code) || 0) + award.points);
    }

    // Nếu đã có profile cùng mã NV → transfer ngay
    const profile = await client.query(
      `select id from public.profiles where upper(employee_code) = upper($1) limit 1`,
      [code],
    );
    if (profile.rows[0]) {
      await client.query(`select public.transfer_employee_scores($1, $2)`, [
        profile.rows[0].id,
        code,
      ]);
    }
  }

  const lb = await client.query(
    `select full_name, employee_code, total_score, rank
     from public.leaderboard
     order by rank asc
     limit 10`,
  );

  console.log("People with awards:", people);
  console.log("Score events inserted:", eventCount);
  console.log("TOP10:");
  for (const r of lb.rows) console.log(JSON.stringify(r));

  await client.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("ERR:", err.message);
  process.exit(1);
});
