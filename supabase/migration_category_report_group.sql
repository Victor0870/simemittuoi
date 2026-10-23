-- Phân loại theo báo cáo tổng hợp cho danh mục thu – chi.
-- Mã nhóm khai báo trong src/lib/finance/report-groups.ts (thu_* cho danh mục thu, chi_* cho danh mục chi).

alter table public.cdilv_fund_categories add column if not exists report_group text;

alter table public.cdilv_fund_categories drop constraint if exists cdilv_fund_categories_report_group_check;
alter table public.cdilv_fund_categories add constraint cdilv_fund_categories_report_group_check check (
  report_group is null
  or (
    kind = 'income'
    and report_group in (
      'thu_doan_phi', 'thu_kinh_phi', 'thu_khac_dn_ho_tro', 'thu_khac_don_vi', 'thu_nhan_ban_giao',
      'thu_tang_nguon_khac', 'thu_kpcd_cap_tren', 'thu_tccd_cap_tren_ho_tro'
    )
  )
  or (
    kind = 'expense'
    and report_group in (
      'chi_cham_lo', 'chi_tuyen_truyen', 'chi_quan_ly_hanh_chinh', 'chi_phu_cap', 'chi_khac',
      'chi_nop_kpcd_25', 'chi_nop_dpcd_30', 'chi_ban_giao', 'chi_giam_nguon_khac'
    )
  )
);

-- Gán sẵn cho danh mục mặc định (chỉ những danh mục chưa phân loại, khớp đúng tên ban đầu).
update public.cdilv_fund_categories c
set report_group = m.report_group, updated_at = now()
from (values
  ('income', 'Thu đoàn phí công đoàn', 'thu_doan_phi'),
  ('income', 'Thu kinh phí công đoàn được phân phối', 'thu_kpcd_cap_tren'),
  ('income', 'Thu hỗ trợ từ doanh nghiệp', 'thu_khac_dn_ho_tro'),
  ('income', 'Lãi tiền gửi ngân hàng', 'thu_khac_don_vi'),
  ('income', 'Thu khác', 'thu_khac_don_vi'),
  ('expense', 'Phụ cấp cán bộ công đoàn', 'chi_phu_cap'),
  ('expense', 'Chi quản lý hành chính', 'chi_quan_ly_hanh_chinh'),
  ('expense', 'Chi tuyên truyền, phát triển đoàn viên', 'chi_tuyen_truyen'),
  ('expense', 'Chi hoạt động đại diện, bảo vệ quyền lợi đoàn viên', 'chi_cham_lo'),
  ('expense', 'Chi văn hóa, thể thao, du lịch', 'chi_cham_lo'),
  ('expense', 'Chi thăm hỏi, trợ cấp đoàn viên', 'chi_cham_lo'),
  ('expense', 'Chi khen thưởng', 'chi_cham_lo'),
  ('expense', 'Chi hoạt động phong trào khác', 'chi_khac'),
  ('expense', 'Chi khác', 'chi_khac')
) as m(kind, name, report_group)
where c.kind = m.kind and c.name = m.name and c.report_group is null;
