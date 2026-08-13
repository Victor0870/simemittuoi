import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const PROJECT_REF = "qpaoucyjitbmfcahxrqu";
const EXCEL = path.join(projectRoot, "Ket_qua_cuoc_thi_da_dien_ma_nv.xlsx");
const NOTE_BASE = "Đạt giải cuộc thi tìm hiểu pháp luật";
const SOURCE = "phap_luat_2026";

function readDbPassword() {
  return fs.readFileSync(path.join(projectRoot, "pas data.txt"), "utf8").trim();
}

async function main() {
  // 1) Sửa Excel: bỏ dòng Vinh hạng TP kém hơn; Yến → Khuyến khích
  const wb = XLSX.readFile(EXCEL);
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
  const rankKey = "Xếp hạng cá nhân theo thành phố";

  const vinhRows = rows.filter(
    (r) => String(r["Mã Nhân Viên"] || "").trim() === "0387",
  );
  if (vinhRows.length < 2) {
    console.log("Vinh rows in excel:", vinhRows.length);
  }

  const bestVinhRank = Math.min(
    ...vinhRows.map((r) => Number(r[rankKey]) || Number.POSITIVE_INFINITY),
  );

  const cleaned = [];
  let removedVinh = 0;
  for (const row of rows) {
    const code = String(row["Mã Nhân Viên"] || "").trim();
    if (code === "0387") {
      const rank = Number(row[rankKey]) || Number.POSITIVE_INFINITY;
      if (rank !== bestVinhRank) {
        removedVinh += 1;
        console.log("Drop Vinh excel row city-rank", rank);
        continue;
      }
    }
    if (code === "0234") {
      row["Giải ILV"] = "Khuyến Khích";
      row["Phần Thưởng của giải ILV\n(VND)"] = 200000;
      console.log("Promote Yen 0234 → Khuyến khích");
    }
    cleaned.push(row);
  }

  const newSheet = XLSX.utils.json_to_sheet(cleaned);
  wb.Sheets[sheetName] = newSheet;
  XLSX.writeFile(wb, EXCEL);
  console.log("Excel updated. Removed Vinh rows:", removedVinh, "Total:", cleaned.length);

  // 2) Sửa DB
  const password = readDbPassword();
  const client = new pg.Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Xóa 1 dòng KK trùng của Vinh (giữ 1)
  const dup = await client.query(
    `select id from public.employee_score_events
     where employee_code = '0387' and award_label = 'Giải ILV Khuyến khích'
     order by created_at asc, id asc`,
  );
  if (dup.rows.length > 1) {
    const dropIds = dup.rows.slice(1).map((r) => r.id);
    await client.query(
      `delete from public.employee_score_events where id = any($1::uuid[])`,
      [dropIds],
    );
    console.log("Deleted duplicate Vinh KK events:", dropIds.length);
  } else {
    console.log("Vinh KK events already unique:", dup.rows.length);
  }

  // Nếu Vinh đã transfer KK trùng sang score_events thì dọn luôn
  const seDup = await client.query(
    `select se.id
     from public.score_events se
     join public.profiles p on p.id = se.user_id
     where upper(p.employee_code) = '0387'
       and se.award_label = 'Giải ILV Khuyến khích'
     order by se.created_at asc, se.id asc`,
  );
  if (seDup.rows.length > 1) {
    const dropIds = seDup.rows.slice(1).map((r) => r.id);
    await client.query(`delete from public.score_events where id = any($1::uuid[])`, [
      dropIds,
    ]);
    console.log("Deleted duplicate transferred Vinh KK score_events:", dropIds.length);
  }

  // Yến: Cống hiến công ty → Khuyến khích
  const yenNote = `${NOTE_BASE} — Giải nội bộ Khuyến khích (+20)`;
  const yenUp = await client.query(
    `update public.employee_score_events
     set points = 20,
         award_label = 'Giải ILV Khuyến khích',
         note = $1
     where employee_code = '0234'
       and (award_label = 'Giải Cống hiến công ty' or points = 10)
     returning id, points, award_label`,
    [yenNote],
  );
  console.log("Yen employee_score_events updated:", yenUp.rows);

  // Nếu đã transfer cho Yến thì cập nhật score_events tương ứng
  const yenSe = await client.query(
    `update public.score_events se
     set points = 20,
         award_label = 'Giải ILV Khuyến khích',
         note = $1
     from public.profiles p
     where se.user_id = p.id
       and upper(p.employee_code) = '0234'
       and (se.award_label = 'Giải Cống hiến công ty' or se.points = 10 and se.note ilike '%cống hiến công ty%')
     returning se.id, se.points, se.award_label`,
    [yenNote],
  );
  console.log("Yen score_events updated:", yenSe.rows);

  const lb = await client.query(
    `select rank, full_name, employee_code, total_score
     from public.leaderboard
     where employee_code in ('0387', '0234')
     order by rank`,
  );
  console.log("Updated leaderboard rows:");
  for (const r of lb.rows) console.log(JSON.stringify(r));

  const vinhEvents = await client.query(
    `select points, award_label from public.employee_score_events where employee_code = '0387' order by award_label`,
  );
  console.log("Vinh events now:", vinhEvents.rows);

  await client.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("ERR:", err.message);
  process.exit(1);
});
