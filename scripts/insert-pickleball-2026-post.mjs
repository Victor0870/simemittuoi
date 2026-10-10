/**
 * Thêm bài viết phát động Giải Pickleball 2026
 * vào public.cdilv_posts và public.cdilv_activities (project cũ + shared).
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

const POST_TITLE = "Phát động Giải thể thao Pickleball CDILV 2026: Bứt phá phong độ – Gắn kết đồng đội";
const POST_TAG = "Thể thao";
const POST_TAG_TONE = "primary";

const POST_CONTENT = `Công đoàn cơ sở CDILV trân trọng thông báo và phát động "Giải Pickleball CDILV 2026" dành cho toàn thể đoàn viên, cán bộ và người lao động trong toàn đơn vị.

Pickleball – bộ môn thể thao hiện đại, sôi động kết hợp tinh hoa giữa quần vợt, cầu lông và bóng bàn – đang trở thành làn sóng thể thao đầy hào hứng. Giải đấu hứa hẹn mang đến những trận cầu bùng nổ, những pha bóng kịch tính và tạo cơ hội gắn kết bền chặt giữa các phòng ban.

I. MỤC ĐÍCH – Ý NGHĨA
1. Chào mừng phong trào thi đua năm 2026 và các ngày lễ kỷ niệm lớn trong năm.
2. Thúc đẩy phong trào rèn luyện thân thể, nâng cao sức khỏe thể chất và đời sống tinh thần cho đoàn viên, người lao động.
3. Tạo sân chơi lành mạnh, tăng cường tinh thần đoàn kết, giao lưu và học hỏi lẫn nhau giữa các bộ phận, đơn vị trực thuộc.
4. Tuyên dương, khen thưởng các tập thể, cá nhân có thành tích xuất sắc và tích lũy điểm thi đua phong trào trên cổng thông tin CDILV.

II. THỜI GIAN – ĐỊA ĐIỂM
- Thời gian khai mạc & thi đấu: Dự kiến khởi tranh vào trung tuần tháng 11/2026 (thi đấu vào các ngày Thứ Bảy và Chủ Nhật).
- Khung giờ thi đấu: Buổi sáng từ 07:30 – 11:30, buổi chiều từ 14:00 – 18:00.
- Địa điểm thi đấu: Cụm sân Pickleball tiêu chuẩn (Ban Tổ chức sẽ thông báo vị trí chính thức và hướng dẫn di chuyển trước ngày thi đấu 05 ngày).
- Thời hạn đăng ký: Từ ngày phát động đến hết ngày 31/10/2026.

III. ĐỐI TƯỢNG & NỘI DUNG THI ĐẤU
1. Đối tượng tham gia:
- Toàn thể cán bộ, nhân viên, đoàn viên công đoàn chính thức trực thuộc CDILV.
- Vận động viên tham gia phải có đủ sức khỏe thi đấu thể thao theo quy định.

2. Các nội dung thi đấu:
- Đôi Nam (Men's Doubles)
- Đôi Nữ (Women's Doubles)
- Đôi Nam - Nữ phối hợp (Mixed Doubles)
- Đơn Nam & Đơn Nữ (tùy thuộc vào số lượng đăng ký thực tế từ các đơn vị)

IV. HÌNH THỨC & THỂ THỨC THI ĐẤU
1. Thể thức thi đấu:
- Vòng bảng: Chia bảng thi đấu vòng tròn 1 lượt tính điểm. Mỗi trận thi đấu 01 set chạm 11 điểm (cách 2 điểm, tối đa 15 điểm).
- Vòng loại trực tiếp: Các đội nhất, nhì mỗi bảng bước vào vòng Tứ kết, Bán kết và Chung kết. Thi đấu 03 set thắng 02 (chạm 11 điểm, cách 2 điểm).
2. Quy định chuyên môn:
- Áp dụng luật thi đấu Pickleball quốc tế hiện hành.
- Ban Tổ chức cung cấp bóng thi đấu đạt chuẩn xuyên suốt giải.
- Vận động viên tự chuẩn bị vợt thi đấu đạt chuẩn và trang phục thể thao lịch sự, mang giày đế bằng phù hợp mặt sân.
- Tuân thủ quyết định của Tổ trọng tài, đề cao tinh thần thể thao trung thực, cao thượng và fair-play.

V. CƠ CẤU GIẢI THƯỞNG & ĐIỂM THI ĐUA
Mỗi nội dung thi đấu bao gồm:
- 01 Giải Nhất (Vô địch): Cúp vô địch + Huy chương Vàng + Tiền thưởng + Giấy khen Công đoàn.
- 01 Giải Nhì: Huy chương Bạc + Tiền thưởng + Giấy khen Công đoàn.
- 02 Giải Ba (đồng hạng): Huy chương Đồng + Tiền thưởng + Giấy khen Công đoàn.
- Giải phụ: Giải Phong cách, Giải Đôi Vận động viên ấn tượng nhất, Giải Cổ động viên nhiệt tình nhất.
- Điểm thi đua tích lũy trên cổng CDILV:
  + Vận động viên đạt Giải Nhất: +200 điểm.
  + Vận động viên đạt Giải Nhì: +150 điểm.
  + Vận động viên đạt Giải Ba / Khuyến khích: +100 điểm.
  + Điểm tham gia & cổ vũ: +50 điểm cho toàn bộ vận động viên đăng ký thi đấu và cổ động viên điểm danh hợp lệ.

VI. HƯỚNG DẪN ĐĂNG KÝ
- Đăng ký theo mẫu qua Tổ trưởng Công đoàn các phòng ban hoặc gửi trực tiếp về Ban Thể thao Công đoàn.
- Đăng ký trực tuyến trên cổng CDILV (mục Đăng ký sự kiện/hoạt động).
- Ban Tổ chức sẽ họp kỹ thuật và tiến hành bốc thăm chia bảng trước ngày khai mạc 03 ngày làm việc.

VII. THÔNG TIN LIÊN HỆ
Mọi thắc mắc và đóng góp ý kiến xin vui lòng liên hệ:
- Ban Chấp hành Công đoàn cơ sở CDILV (Bộ phận Văn hóa - Thể thao).
- Trực tiếp tại Văn phòng Công đoàn trong giờ hành chính.

Ban Chấp hành Công đoàn trân trọng kính mời toàn thể đoàn viên, người lao động nhiệt tình đăng ký tham gia thi đấu và cổ vũ để Giải Pickleball CDILV 2026 diễn ra thành công tốt đẹp!`;

const ACT_TITLE = "Giải thể thao Pickleball CDILV 2026";
const ACT_DESC = "Giải đấu thể thao Pickleball phong trào toàn đơn vị năm 2026: Nâng cao thể lực, bứt phá phong độ và kết nối đồng đội.";
const ACT_LOCATION = "Cụm sân Pickleball CDILV";
const ACT_DATE = "2026-11-15";
const ACT_POINTS = 100;

async function upsertPostAndActivity(ref, password, label) {
  const client = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // 1. Post
  const existingPost = await client.query(
    `select id from public.cdilv_posts where title = $1 limit 1`,
    [POST_TITLE],
  );

  let postId;
  if (existingPost.rows[0]) {
    postId = existingPost.rows[0].id;
    await client.query(
      `update public.cdilv_posts
       set content = $2,
           tag = $3,
           tag_tone = $4,
           published_at = now()
       where id = $1`,
      [postId, POST_CONTENT, POST_TAG, POST_TAG_TONE],
    );
    console.log(`${label}: Post updated`, postId);
  } else {
    const ins = await client.query(
      `insert into public.cdilv_posts (title, content, tag, tag_tone, published_at)
       values ($1, $2, $3, $4, now())
       returning id`,
      [POST_TITLE, POST_CONTENT, POST_TAG, POST_TAG_TONE],
    );
    postId = ins.rows[0].id;
    console.log(`${label}: Post inserted`, postId);
  }

  // 2. Activity
  const existingAct = await client.query(
    `select id from public.cdilv_activities where title = $1 limit 1`,
    [ACT_TITLE],
  );

  let actId;
  if (existingAct.rows[0]) {
    actId = existingAct.rows[0].id;
    await client.query(
      `update public.cdilv_activities
       set description = $2,
           location = $3,
           event_date = $4,
           points = $5,
           image_alt = $6
       where id = $1`,
      [actId, ACT_DESC, ACT_LOCATION, ACT_DATE, ACT_POINTS, ACT_TITLE],
    );
    console.log(`${label}: Activity updated`, actId);
  } else {
    const insAct = await client.query(
      `insert into public.cdilv_activities (title, description, location, event_date, points, image_alt)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [ACT_TITLE, ACT_DESC, ACT_LOCATION, ACT_DATE, ACT_POINTS, ACT_TITLE],
    );
    actId = insAct.rows[0].id;
    console.log(`${label}: Activity inserted`, actId);
  }

  // Check top posts
  const list = await client.query(
    `select title, tag, published_at
     from public.cdilv_posts
     order by published_at desc
     limit 4`,
  );
  console.log(
    `${label} latest posts:`,
    list.rows.map((r) => r.title).join(" | "),
  );

  await client.end();
  return { postId, actId };
}

const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();

console.log("=== Đang cập nhật OLD/prod project ===");
const oldResult = await upsertPostAndActivity("qpaoucyjitbmfcahxrqu", oldPass, "OLD/prod");

console.log("=== Đang cập nhật SHARED project ===");
const sharedResult = await upsertPostAndActivity("pzcwwylxrojvcoihtxep", biz.SUPABASE_DB_PASSWORD, "SHARED");

console.log("Hoàn tất thêm bài viết phát động Giải Pickleball 2026 trên cả hai project Supabase!", {
  oldResult,
  sharedResult,
});
