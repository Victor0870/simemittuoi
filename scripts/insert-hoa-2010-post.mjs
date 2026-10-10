/**
 * Thêm thông báo: Tổ chức cuộc thi cắm hoa ngày 20-10
 * vào public.cdilv_posts (project cũ + shared).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

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

const TITLE = "Tổ chức cuộc thi cắm hoa chào mừng ngày 20-10";
const CONTENT = `Công đoàn cơ sở CDILV trân trọng thông báo tổ chức Cuộc thi cắm hoa chào mừng Ngày Phụ nữ Việt Nam 20/10.

Thời gian: ngày 20 tháng 10.
Đối tượng: toàn thể đoàn viên, người lao động (ưu tiên các chị em phụ nữ tham gia).
Hình thức: thi cắm hoa theo chủ đề tôn vinh vẻ đẹp, sự đảm đang và tinh thần đoàn kết của người phụ nữ Việt Nam.

Ban Tổ chức sẽ công bố chi tiết địa điểm, khung giờ đăng ký và tiêu chí chấm điểm trong các thông báo tiếp theo. Đoàn viên quan tâm vui lòng theo dõi mục Thông báo quan trọng và đăng ký đúng hạn để Ban Tổ chức sắp xếp vật liệu, không gian thi.

Mọi thắc mắc xin liên hệ Ban Chấp hành Công đoàn cơ sở CDILV.`;

const TAG = "Sự kiện";
const TAG_TONE = "primary";

async function upsertPost(ref, password, label) {
  const client = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const existing = await client.query(
    `select id from public.cdilv_posts
     where title = $1
     limit 1`,
    [TITLE],
  );

  let id;
  if (existing.rows[0]) {
    id = existing.rows[0].id;
    await client.query(
      `update public.cdilv_posts
       set content = $2,
           tag = $3,
           tag_tone = $4,
           published_at = now()
       where id = $1`,
      [id, CONTENT, TAG, TAG_TONE],
    );
    console.log(`${label}: updated`, id);
  } else {
    const ins = await client.query(
      `insert into public.cdilv_posts (title, content, tag, tag_tone, published_at)
       values ($1, $2, $3, $4, now())
       returning id`,
      [TITLE, CONTENT, TAG, TAG_TONE],
    );
    id = ins.rows[0].id;
    console.log(`${label}: inserted`, id);
  }

  const list = await client.query(
    `select title, tag, published_at
     from public.cdilv_posts
     order by published_at desc
     limit 5`,
  );
  console.log(
    `${label} latest:`,
    list.rows.map((r) => r.title).join(" | "),
  );

  await client.end();
}

const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();

await upsertPost("qpaoucyjitbmfcahxrqu", oldPass, "OLD/prod");
await upsertPost("pzcwwylxrojvcoihtxep", biz.SUPABASE_DB_PASSWORD, "SHARED");
console.log("Xong — thông báo cuộc thi cắm hoa 20-10 đã có trên cả hai project.");
