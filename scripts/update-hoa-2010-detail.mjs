/**
 * Cập nhật nội dung chi tiết bài cuộc thi cắm hoa 20-10 trên cả 2 project.
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

const CONTENT = `Công đoàn cơ sở CDILV trân trọng thông báo tổ chức Cuộc thi cắm hoa chào mừng Ngày Phụ nữ Việt Nam 20/10, nhằm tôn vinh vẻ đẹp, sự đảm đang và tinh thần đoàn kết của người phụ nữ trong đơn vị, đồng thời tạo sân chơi lành mạnh, gắn kết đoàn viên.

I. MỤC ĐÍCH – Ý NGHĨA
- Chào mừng Ngày Phụ nữ Việt Nam 20/10.
- Khuyến khích sáng tạo, thẩm mỹ và tinh thần tập thể qua hoạt động cắm hoa.
- Tuyên dương các cá nhân/nhóm có sản phẩm xuất sắc; cộng điểm thi đua theo quy định Công đoàn.

II. THỜI GIAN – ĐỊA ĐIỂM
- Thời gian tổ chức: ngày 20 tháng 10 (buổi sáng, dự kiến bắt đầu 08:00).
- Địa điểm: Hội trường / khu vực do Ban Tổ chức bố trí (sẽ thông báo cụ thể trước ngày thi 03 ngày làm việc).
- Thời gian đăng ký: từ nay đến hết ngày 18/10 (ưu tiên đăng ký sớm để chuẩn bị vật liệu).

III. ĐỐI TƯỢNG – HÌNH THỨC
- Đối tượng: toàn thể đoàn viên, người lao động CDILV (ưu tiên chị em phụ nữ; nam giới có thể tham gia hỗ trợ/đồng đội).
- Hình thức: thi cá nhân hoặc nhóm tối đa 03 người.
- Chủ đề: «Sắc hoa tôn vinh người phụ nữ Việt Nam» — tự do lựa chọn loại hoa, phụ kiện phù hợp văn hóa đơn vị và an toàn lao động.

IV. QUY ĐỊNH THI
1. Mỗi cá nhân/nhóm mang theo dụng cụ cá nhân (kéo, dao, xốp, bình/lọ…). Ban Tổ chức hỗ trợ bàn thi và nước.
2. Thời gian thực hiện tại chỗ: 45–60 phút (Ban Tổ chức phổ biến trước giờ thi).
3. Không sử dụng vật liệu nguy hiểm, dễ cháy nổ hoặc gây mất vệ sinh khu vực thi.
4. Tác phẩm hoàn thành được trưng bày để Ban Giám khảo chấm và đoàn viên tham quan.

V. TIÊU CHÍ CHẤM ĐIỂM (dự kiến)
- Ý tưởng & chủ đề: 30%
- Thẩm mỹ, bố cục, màu sắc: 40%
- Kỹ thuật cắm & hoàn thiện: 20%
- Tinh thần tham gia / thuyết trình ngắn (nếu có): 10%

VI. GIẢI THƯỞNG – ĐIỂM THI ĐUA
- Giải Nhất, Nhì, Ba và giải Khuyến khích (số lượng theo quy mô đăng ký).
- Phần thưởng hiện vật / giấy khen do Công đoàn cơ sở trao.
- Cộng điểm thi đua đoàn viên theo quy chế hiện hành (chi tiết điểm sẽ thông báo kèm danh sách đạt giải).

VII. CÁCH ĐĂNG KÝ
- Đăng ký qua Ban Chấp hành Công đoàn cơ sở / tổ Công đoàn đơn vị (ghi rõ họ tên, mã nhân viên, hình thức cá nhân hoặc nhóm).
- Hoặc theo dõi mục Bài viết / Thông báo quan trọng trên cổng CDILV để nhận mẫu đăng ký (nếu Ban Tổ chức phát hành).

VIII. LIÊN HỆ
Mọi thắc mắc xin liên hệ Ban Chấp hành Công đoàn cơ sở CDILV trong giờ hành chính.

Trân trọng kính mời toàn thể đoàn viên tích cực tham gia!`;

async function update(ref, password, label) {
  const client = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const found = await client.query(
    `select id from public.cdilv_posts where title = $1 limit 1`,
    [TITLE],
  );

  let id;
  if (found.rows[0]) {
    id = found.rows[0].id;
    await client.query(
      `update public.cdilv_posts
       set content = $2, tag = 'Sự kiện', tag_tone = 'primary', published_at = now()
       where id = $1`,
      [id, CONTENT],
    );
    console.log(`${label}: updated detail`, id);
  } else {
    const ins = await client.query(
      `insert into public.cdilv_posts (title, content, tag, tag_tone, published_at)
       values ($1, $2, 'Sự kiện', 'primary', now())
       returning id`,
      [TITLE, CONTENT],
    );
    id = ins.rows[0].id;
    console.log(`${label}: inserted`, id);
  }

  await client.end();
  return id;
}

const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();
const oldId = await update("qpaoucyjitbmfcahxrqu", oldPass, "OLD");
const sharedId = await update(
  "pzcwwylxrojvcoihtxep",
  biz.SUPABASE_DB_PASSWORD,
  "SHARED",
);
console.log("IDs", { oldId, sharedId });
