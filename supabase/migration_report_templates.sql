-- Mẫu báo cáo dùng chung (VD S82-TLĐ): lưu trong DB theo phiên bản để khi công đoàn cấp trên đổi mẫu,
-- quản trị chỉ cần tạo phiên bản mới và áp dụng – mọi đơn vị dùng theo, không sửa code.
-- Mẫu là dữ liệu cấp nền tảng (không thuộc riêng đơn vị nào). Danh mục thu – chi của đơn vị gắn vào
-- "mã mục" (VD 22, 25.01, 39.2) – mã này giữ nguyên qua các phiên bản nên đổi mẫu không mất liên kết.

create table if not exists public.cdilv_report_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9._-]{1,40}$'),
  name text not null check (char_length(name) between 1 and 200),
  description text check (description is null or char_length(description) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.cdilv_report_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.cdilv_report_templates(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  title text not null check (char_length(title) between 1 and 200),
  note text check (note is null or char_length(note) <= 1000),
  effective_from date,
  published_at timestamptz,
  published_by uuid references public.cdilv_profiles(id) on delete set null,
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, version)
);
create unique index if not exists cdilv_report_template_one_active
  on public.cdilv_report_template_versions(template_id) where status = 'active';
create unique index if not exists cdilv_report_template_one_draft
  on public.cdilv_report_template_versions(template_id) where status = 'draft';

create table if not exists public.cdilv_report_template_lines (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.cdilv_report_template_versions(id) on delete cascade,
  side text not null check (side in ('income', 'expense')),
  code text not null check (code ~ '^[A-Za-z0-9._-]{1,20}$'),
  label text not null check (char_length(label) between 1 and 200),
  -- item: chỉ tiêu chọn được cho danh mục; group: cộng các dòng con (parent_code); subtotal: cộng các mã trong sum_codes
  line_type text not null check (line_type in ('item', 'group', 'subtotal')),
  parent_code text,
  sum_codes text[] not null default '{}',
  sort_order integer not null default 0,
  unique (version_id, side, code)
);
create index if not exists cdilv_report_template_lines_version on public.cdilv_report_template_lines(version_id);

-- Phiên bản đã áp dụng / lưu trữ thì không sửa dòng được nữa (chỉ sửa bản nháp).
create or replace function public.cdilv_guard_report_template_lines()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.cdilv_report_template_versions
  where id = coalesce(new.version_id, old.version_id);
  -- Không còn phiên bản = đang xóa cả bản nháp (xóa dây chuyền) → cho phép.
  if v_status is not null and v_status <> 'draft' then
    raise exception 'Chỉ sửa được dòng của bản nháp mẫu báo cáo.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_cdilv_report_template_lines_guard on public.cdilv_report_template_lines;
create trigger trg_cdilv_report_template_lines_guard
  before insert or update or delete on public.cdilv_report_template_lines
  for each row execute function public.cdilv_guard_report_template_lines();

-- Áp dụng bản nháp: bản đang dùng chuyển sang lưu trữ, bản nháp thành bản đang dùng (một giao dịch).
create or replace function public.cdilv_report_template_publish(
  p_version_id uuid,
  p_actor_id uuid,
  p_effective_from date,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cdilv_report_template_versions;
begin
  select * into v_row from public.cdilv_report_template_versions where id = p_version_id for update;
  if v_row.id is null then
    raise exception 'Không tìm thấy phiên bản mẫu báo cáo.' using errcode = 'P0001';
  end if;
  if v_row.status <> 'draft' then
    raise exception 'Chỉ áp dụng được bản nháp.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.cdilv_report_template_lines where version_id = p_version_id and line_type = 'item') then
    raise exception 'Mẫu chưa có chỉ tiêu nào.' using errcode = 'P0001';
  end if;

  update public.cdilv_report_template_versions
  set status = 'archived', updated_at = now()
  where template_id = v_row.template_id and status = 'active';

  update public.cdilv_report_template_versions
  set status = 'active',
      effective_from = p_effective_from,
      note = nullif(p_note, ''),
      published_at = now(),
      published_by = p_actor_id,
      updated_at = now()
  where id = p_version_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Mẫu S82-TLĐ – phiên bản 1 (theo file bao_cao_cong_doan.xlsx của công đoàn)
-- -----------------------------------------------------------------------------
insert into public.cdilv_report_templates (code, name, description)
values (
  'S82-TLD',
  'Sổ thu, chi tài chính công đoàn cơ sở (Mẫu S82-TLĐ)',
  'Các chỉ tiêu thu – chi dùng để phân loại danh mục và lập báo cáo tổng hợp.'
)
on conflict (code) do nothing;

do $$
declare
  v_template uuid;
  v_version uuid;
begin
  select id into v_template from public.cdilv_report_templates where code = 'S82-TLD';
  if exists (select 1 from public.cdilv_report_template_versions where template_id = v_template) then
    return;
  end if;

  insert into public.cdilv_report_template_versions (template_id, version, status, title, note)
  values (v_template, 1, 'draft', 'Mẫu S82-TLĐ', 'Phiên bản đầu tiên, theo sổ S82-TLĐ đơn vị đang dùng.')
  returning id into v_version;

  insert into public.cdilv_report_template_lines (version_id, side, code, label, line_type, parent_code, sum_codes, sort_order)
  values
    (v_version, 'income', '22', 'Đoàn phí công đoàn', 'item', null, '{}', 10),
    (v_version, 'income', '23', 'Kinh phí công đoàn', 'item', null, '{}', 20),
    (v_version, 'income', '25', 'Các khoản thu khác', 'group', null, '{}', 30),
    (v_version, 'income', '25.01', 'DN hỗ trợ', 'item', '25', '{}', 31),
    (v_version, 'income', '25.02', 'Thu khác tại đơn vị', 'item', '25', '{}', 32),
    (v_version, 'income', 'CONG_THU', 'Cộng thu TCCĐ', 'subtotal', null, '{22,23,25}', 40),
    (v_version, 'income', '28', 'Tài chính công đoàn cấp trên cấp', 'group', null, '{}', 50),
    (v_version, 'income', '28.01', 'Kinh phí công đoàn cấp trên cấp theo phân phối', 'item', '28', '{}', 51),
    (v_version, 'income', '28.02', 'Tài chính công đoàn cấp trên cấp hỗ trợ', 'item', '28', '{}', 52),
    (v_version, 'income', '40', 'Nhận bàn giao tài chính công đoàn', 'item', null, '{}', 60),
    (v_version, 'income', '47', 'Các khoản khác tăng nguồn tài chính CĐ', 'item', null, '{}', 70),
    (v_version, 'expense', '31', 'Trực tiếp chăm lo, bảo vệ, đào tạo đoàn viên và NLĐ', 'item', null, '{}', 10),
    (v_version, 'expense', '32', 'Tuyên truyền đoàn viên và NLĐ', 'item', null, '{}', 20),
    (v_version, 'expense', '33', 'Quản lý hành chính', 'item', null, '{}', 30),
    (v_version, 'expense', '34', 'Chi phụ cấp cán bộ CĐ', 'item', null, '{}', 40),
    (v_version, 'expense', '37', 'Các khoản chi khác', 'item', null, '{}', 50),
    (v_version, 'expense', 'CONG_CHI', 'Cộng chi TCCĐ', 'subtotal', null, '{31,32,33,34,37}', 60),
    (v_version, 'expense', '39.1', '25% KPCĐ đã nộp cấp trên quản lý trực tiếp', 'item', null, '{}', 70),
    (v_version, 'expense', '39.2', '30% ĐPCĐ đã nộp cấp trên quản lý trực tiếp', 'item', null, '{}', 80),
    (v_version, 'expense', '42', 'Bàn giao tài chính công đoàn', 'item', null, '{}', 90),
    (v_version, 'expense', '48', 'Các khoản khác giảm nguồn TCCĐ', 'item', null, '{}', 100);

  perform public.cdilv_report_template_publish(v_version, null, date '2026-01-01', 'Phiên bản đầu tiên, theo sổ S82-TLĐ đơn vị đang dùng.');
end;
$$;

-- -----------------------------------------------------------------------------
-- Danh mục thu – chi: report_group chuyển từ mã nội bộ (r189) sang mã mục của mẫu
-- -----------------------------------------------------------------------------
alter table public.cdilv_fund_categories drop constraint if exists cdilv_fund_categories_report_group_check;
alter table public.cdilv_fund_categories drop constraint if exists cdilv_fund_categories_report_code_check;

update public.cdilv_fund_categories c
set report_group = m.code, updated_at = now()
from (values
  ('thu_doan_phi', '22'), ('thu_kinh_phi', '23'), ('thu_khac_dn_ho_tro', '25.01'), ('thu_khac_don_vi', '25.02'),
  ('thu_kpcd_cap_tren', '28.01'), ('thu_tccd_cap_tren_ho_tro', '28.02'), ('thu_nhan_ban_giao', '40'),
  ('thu_tang_nguon_khac', '47'), ('chi_cham_lo', '31'), ('chi_tuyen_truyen', '32'), ('chi_quan_ly_hanh_chinh', '33'),
  ('chi_phu_cap', '34'), ('chi_khac', '37'), ('chi_nop_kpcd_25', '39.1'), ('chi_nop_dpcd_30', '39.2'),
  ('chi_ban_giao', '42'), ('chi_giam_nguon_khac', '48')
) as m(old_key, code)
where c.report_group = m.old_key;

alter table public.cdilv_fund_categories add constraint cdilv_fund_categories_report_code_check
  check (report_group is null or report_group ~ '^[A-Za-z0-9._-]{1,20}$');

-- Bước A: khớp cách hạch toán trong sổ S82 thực tế của đơn vị.
update public.cdilv_fund_categories
set name = 'Thu kinh phí công đoàn', report_group = '23', updated_at = now()
where kind = 'income' and name = 'Thu kinh phí công đoàn được phân phối';

-- Danh mục nộp cấp trên cũ (gộp ĐPCĐ + KPCĐ) nếu còn thì dùng cho phần 25% KPCĐ.
update public.cdilv_fund_categories
set name = 'Nộp 25% KPCĐ lên công đoàn cấp trên', report_group = '39.1', updated_at = now()
where kind = 'expense' and name = 'Nộp đoàn phí, kinh phí lên công đoàn cấp trên';

insert into public.cdilv_fund_categories (kind, name, report_group, sort_order)
select v.kind, v.name, v.code, v.sort_order
from (values
  ('expense', 'Nộp 25% KPCĐ lên công đoàn cấp trên', '39.1', 81),
  ('expense', 'Nộp 30% ĐPCĐ lên công đoàn cấp trên', '39.2', 82)
) as v(kind, name, code, sort_order)
where not exists (select 1 from public.cdilv_fund_categories c where c.kind = v.kind and c.report_group = v.code);

insert into public.cdilv_fund_categories (kind, name, report_group, sort_order)
select v.kind, v.name, v.code, v.sort_order
from (values
  ('expense', 'Phí ngân hàng', '33', 25),
  ('income', 'Thu tiền du lịch, hoàn trả của đoàn viên', '25.02', 50)
) as v(kind, name, code, sort_order)
where not exists (select 1 from public.cdilv_fund_categories c where c.kind = v.kind and c.name = v.name);

-- -----------------------------------------------------------------------------
-- Quyền truy cập: chỉ service role
-- -----------------------------------------------------------------------------
alter table public.cdilv_report_templates enable row level security;
alter table public.cdilv_report_template_versions enable row level security;
alter table public.cdilv_report_template_lines enable row level security;

revoke all on
  public.cdilv_report_templates,
  public.cdilv_report_template_versions,
  public.cdilv_report_template_lines
from anon, authenticated;

grant select, insert, update, delete on
  public.cdilv_report_templates,
  public.cdilv_report_template_versions,
  public.cdilv_report_template_lines
to service_role;

revoke all on function public.cdilv_guard_report_template_lines() from public, anon, authenticated;
revoke all on function public.cdilv_report_template_publish(uuid, uuid, date, text) from public, anon, authenticated;
grant execute on function public.cdilv_report_template_publish(uuid, uuid, date, text) to service_role;
