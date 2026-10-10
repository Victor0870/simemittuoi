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

const SCHEMA_SQL = `
create extension if not exists "pgcrypto";

create table if not exists public.cdilv_polls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  poll_type text not null default 'vote' check (poll_type in ('quiz', 'vote')),
  access_type text not null default 'free' check (access_type in ('members_only', 'free')),
  content_type text not null default 'image' check (content_type in ('text', 'image')),
  status text not null default 'open' check (status in ('open', 'closed', 'draft')),
  max_votes_per_user integer not null default 3,
  has_prediction boolean not null default true,
  prediction_question text not null default 'Theo bạn có bao nhiêu người bình chọn cho tác phẩm đạt giải nhất?',
  voter_reward_points integer not null default 10,
  predictor_reward_points integer not null default 50,
  is_union_contest boolean not null default true,
  first_prize_points integer not null default 50,
  second_prize_points integer not null default 40,
  third_prize_points integer not null default 30,
  consolation_prize_points integer not null default 20,
  consolation_prize_count integer not null default 2,
  winning_option_id uuid,
  winning_predictor_info jsonb,
  created_by uuid references public.cdilv_profiles(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.cdilv_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.cdilv_polls(id) on delete cascade,
  order_num integer not null default 1,
  title text not null,
  description text,
  image_urls jsonb not null default '[]'::jsonb,
  vote_count integer not null default 0,
  final_rank integer,
  created_at timestamptz not null default now()
);

create table if not exists public.cdilv_poll_option_members (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.cdilv_poll_options(id) on delete cascade,
  full_name text not null,
  employee_code text,
  user_id uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.cdilv_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.cdilv_polls(id) on delete cascade,
  option_id uuid not null references public.cdilv_poll_options(id) on delete cascade,
  user_id uuid references public.cdilv_profiles(id) on delete set null,
  ip_address text,
  device_fingerprint text,
  created_at timestamptz not null default now()
);

create table if not exists public.cdilv_poll_predictions (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.cdilv_polls(id) on delete cascade,
  user_id uuid references public.cdilv_profiles(id) on delete set null,
  predicted_count integer not null,
  full_name text,
  contact_info text,
  ip_address text,
  device_fingerprint text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.cdilv_polls enable row level security;
alter table public.cdilv_poll_options enable row level security;
alter table public.cdilv_poll_option_members enable row level security;
alter table public.cdilv_poll_votes enable row level security;
alter table public.cdilv_poll_predictions enable row level security;

drop policy if exists "cdilv_polls_public_read" on public.cdilv_polls;
create policy "cdilv_polls_public_read" on public.cdilv_polls for select using (true);

drop policy if exists "cdilv_poll_options_public_read" on public.cdilv_poll_options;
create policy "cdilv_poll_options_public_read" on public.cdilv_poll_options for select using (true);

drop policy if exists "cdilv_poll_members_public_read" on public.cdilv_poll_option_members;
create policy "cdilv_poll_members_public_read" on public.cdilv_poll_option_members for select using (true);

drop policy if exists "cdilv_poll_votes_public_read" on public.cdilv_poll_votes;
create policy "cdilv_poll_votes_public_read" on public.cdilv_poll_votes for select using (true);

drop policy if exists "cdilv_poll_predictions_public_read" on public.cdilv_poll_predictions;
create policy "cdilv_poll_predictions_public_read" on public.cdilv_poll_predictions for select using (true);

drop policy if exists "cdilv_poll_votes_insert" on public.cdilv_poll_votes;
create policy "cdilv_poll_votes_insert" on public.cdilv_poll_votes for insert with check (true);

drop policy if exists "cdilv_poll_predictions_insert" on public.cdilv_poll_predictions;
create policy "cdilv_poll_predictions_insert" on public.cdilv_poll_predictions for insert with check (true);

drop policy if exists "cdilv_polls_admin_all" on public.cdilv_polls;
create policy "cdilv_polls_admin_all" on public.cdilv_polls for all using (
  exists (
    select 1 from public.cdilv_profiles
    where id = auth.uid() and role = 'admin' and approval_status = 'approved'
  )
) with check (
  exists (
    select 1 from public.cdilv_profiles
    where id = auth.uid() and role = 'admin' and approval_status = 'approved'
  )
);

drop policy if exists "cdilv_poll_options_admin_all" on public.cdilv_poll_options;
create policy "cdilv_poll_options_admin_all" on public.cdilv_poll_options for all using (
  exists (
    select 1 from public.cdilv_profiles
    where id = auth.uid() and role = 'admin' and approval_status = 'approved'
  )
) with check (
  exists (
    select 1 from public.cdilv_profiles
    where id = auth.uid() and role = 'admin' and approval_status = 'approved'
  )
);

drop policy if exists "cdilv_poll_members_admin_all" on public.cdilv_poll_option_members;
create policy "cdilv_poll_members_admin_all" on public.cdilv_poll_option_members for all using (
  exists (
    select 1 from public.cdilv_profiles
    where id = auth.uid() and role = 'admin' and approval_status = 'approved'
  )
) with check (
  exists (
    select 1 from public.cdilv_profiles
    where id = auth.uid() and role = 'admin' and approval_status = 'approved'
  )
);
`;

const SAMPLE_POLL_TITLE = "Bình chọn Tác phẩm Cuộc thi cắm hoa chào mừng ngày 20-10";
const SAMPLE_POLL_DESC = "Chào mừng Ngày Phụ nữ Việt Nam 20/10! Hãy cùng chiêm ngưỡng các tác phẩm cắm hoa nghệ thuật của các đội thi và bình chọn cho tác phẩm bạn yêu thích nhất.";

const SAMPLE_OPTIONS = [
  {
    order_num: 1,
    title: "Tác phẩm 01: Hương Sắc Tháng Mười",
    description: "Chủ đề tôn vinh nét dịu dàng, thanh khiết của người phụ nữ Việt Nam qua sự kết hợp tinh tế giữa hoa sen hồng và hoa lan hồ điệp.",
    images: [
      "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=1200&q=80",
      "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=1200&q=80",
      "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=1200&q=80",
    ],
    members: [
      { full_name: "Trần Thanh Tùng", employee_code: "NV001" },
      { full_name: "Lê Thị Hoa", employee_code: "NV002" },
    ],
  },
  {
    order_num: 2,
    title: "Tác phẩm 02: Duyên Dáng Phụ Nữ Việt",
    description: "Tác phẩm khắc họa hình tượng tà áo dài truyền thống với nón lá cách điệu, sử dụng hoa cúc họa mi và hoa hồng Ecuador.",
    images: [
      "https://images.unsplash.com/photo-1508615070457-7baeba4003ab?w=1200&q=80",
      "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=1200&q=80",
      "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=1200&q=80",
    ],
    members: [
      { full_name: "Nguyễn Thị Lan", employee_code: "NV003" },
      { full_name: "Phạm Minh Anh", employee_code: "NV004" },
    ],
  },
  {
    order_num: 3,
    title: "Tác phẩm 03: Bừng Sáng Tương Lai",
    description: "Biểu trưng cho năng lượng tràn đầy, sự tự tin và bứt phá của nữ đoàn viên thời kỳ mới với sắc vàng hoa hướng dương và hoa ly.",
    images: [
      "https://images.unsplash.com/photo-1567696911980-2eed69a46042?w=1200&q=80",
      "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200&q=80",
      "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=1200&q=80",
    ],
    members: [
      { full_name: "Vũ Hải Đăng", employee_code: "NV005" },
      { full_name: "Hoàng Mai", employee_code: "NV006" },
    ],
  },
  {
    order_num: 4,
    title: "Tác phẩm 04: Gắn Kết Yêu Thương",
    description: "Phong cách cắm hoa hiện đại phối màu pastel nhẹ nhàng, thể hiện tinh thần đoàn kết và sẻ chia giữa các phòng ban đơn vị.",
    images: [
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&q=80",
      "https://images.unsplash.com/photo-1533616688419-b7a585564566?w=1200&q=80",
      "https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?w=1200&q=80",
    ],
    members: [
      { full_name: "Đỗ Thu Trang", employee_code: "NV007" },
      { full_name: "Bùi Văn Hùng", employee_code: "NV008" },
    ],
  },
  {
    order_num: 5,
    title: "Tác phẩm 05: Nắng Ấm Ban Mai",
    description: "Sự kết hợp giữa cành khô mộc mạc và hoa cúc mẫu đơn rực rỡ, mang thông điệp về sự ấm áp, chở che và kiên định.",
    images: [
      "https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?w=1200&q=80",
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=1200&q=80",
      "https://images.unsplash.com/photo-1507290439931-a861b5a38200?w=1200&q=80",
    ],
    members: [
      { full_name: "Trịnh Thùy Linh", employee_code: "NV009" },
      { full_name: "Đặng Quốc Bảo", employee_code: "NV010" },
    ],
  },
];

async function applyOnDb(ref, password, label) {
  const client = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log(`[${label}] Creating schema...`);
  await client.query(SCHEMA_SQL);

  console.log(`[${label}] Seeding 20-10 flower poll...`);
  const existPoll = await client.query(
    `select id from public.cdilv_polls where title = $1 limit 1`,
    [SAMPLE_POLL_TITLE],
  );

  let pollId;
  if (existPoll.rows[0]) {
    pollId = existPoll.rows[0].id;
    console.log(`[${label}] Poll exists:`, pollId);
  } else {
    const insPoll = await client.query(
      `insert into public.cdilv_polls (
        title, description, poll_type, access_type, content_type,
        status, max_votes_per_user, has_prediction, prediction_question,
        voter_reward_points, predictor_reward_points, is_union_contest,
        first_prize_points, second_prize_points, third_prize_points,
        consolation_prize_points, consolation_prize_count
      ) values ($1, $2, 'vote', 'free', 'image', 'open', 3, true,
        'Theo bạn có bao nhiêu người bình chọn cho tác phẩm đạt giải nhất?',
        10, 50, true, 50, 40, 30, 20, 2)
      returning id`,
      [SAMPLE_POLL_TITLE, SAMPLE_POLL_DESC],
    );
    pollId = insPoll.rows[0].id;
    console.log(`[${label}] Inserted Poll:`, pollId);

    // Insert options
    for (const opt of SAMPLE_OPTIONS) {
      const insOpt = await client.query(
        `insert into public.cdilv_poll_options (
          poll_id, order_num, title, description, image_urls
        ) values ($1, $2, $3, $4, $5)
        returning id`,
        [pollId, opt.order_num, opt.title, opt.description, JSON.stringify(opt.images)],
      );
      const optId = insOpt.rows[0].id;

      // Insert members for this team
      for (const m of opt.members) {
        await client.query(
          `insert into public.cdilv_poll_option_members (
            option_id, full_name, employee_code
          ) values ($1, $2, $3)`,
          [optId, m.full_name, m.employee_code],
        );
      }
    }
    console.log(`[${label}] Seeded 5 options with teams & photos!`);
  }

  await client.end();
}

const biz = loadBiz();
const oldPass = fs.readFileSync(path.join(root, "pas data.txt"), "utf8").trim();

console.log("=== Setup Polls on OLD project ===");
await applyOnDb("qpaoucyjitbmfcahxrqu", oldPass, "OLD");

console.log("=== Setup Polls on SHARED project ===");
await applyOnDb("pzcwwylxrojvcoihtxep", biz.SUPABASE_DB_PASSWORD, "SHARED");

console.log("Done setup polls schema and seed 20-10 flower poll!");
