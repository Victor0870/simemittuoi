import type { CategoryKind } from "./registry";

/**
 * Phân loại theo báo cáo tổng hợp (chỉ tiêu báo cáo tài chính công đoàn cơ sở).
 * Mục có `header` chỉ là dòng nhóm (cộng các mục con), không chọn trực tiếp cho danh mục.
 * Đổi / thêm mã phải sửa cả ràng buộc report_group trong supabase/migration_category_report_group.sql.
 */
export type ReportGroupDef = { key: string; no: string; label: string; header?: boolean; parent?: string };

export const REPORT_GROUPS: Record<CategoryKind, ReportGroupDef[]> = {
  income: [
    { key: "thu_doan_phi", no: "1", label: "Đoàn phí công đoàn" },
    { key: "thu_kinh_phi", no: "2", label: "Kinh phí công đoàn" },
    { key: "thu_khac", no: "3", label: "Các khoản thu khác", header: true },
    { key: "thu_khac_dn_ho_tro", no: "3.1", label: "DN hỗ trợ", parent: "thu_khac" },
    { key: "thu_khac_don_vi", no: "3.2", label: "Thu khác tại đơn vị", parent: "thu_khac" },
    { key: "thu_nhan_ban_giao", no: "4", label: "Nhận bàn giao tài chính công đoàn" },
    { key: "thu_tang_nguon_khac", no: "5", label: "Các khoản khác tăng nguồn tài chính CĐ" },
    { key: "thu_kpcd_cap_tren", no: "6", label: "Kinh phí công đoàn cấp trên cấp theo phân phối" },
    { key: "thu_tccd_cap_tren_ho_tro", no: "7", label: "Tài chính công đoàn cấp trên cấp hỗ trợ" },
  ],
  expense: [
    { key: "chi_cham_lo", no: "1", label: "Trực tiếp chăm lo, bảo vệ, đào tạo đoàn viên và NLĐ" },
    { key: "chi_tuyen_truyen", no: "2", label: "Tuyên truyền đoàn viên và NLĐ" },
    { key: "chi_quan_ly_hanh_chinh", no: "3", label: "Quản lý hành chính" },
    { key: "chi_phu_cap", no: "4", label: "Chi phụ cấp cán bộ CĐ" },
    { key: "chi_khac", no: "5", label: "Các khoản chi khác" },
    { key: "chi_nop_kpcd_25", no: "6", label: "25% KPCĐ đã nộp cấp trên quản lý trực tiếp" },
    { key: "chi_nop_dpcd_30", no: "7", label: "30% ĐPCĐ đã nộp cấp trên quản lý trực tiếp" },
    { key: "chi_ban_giao", no: "8", label: "Bàn giao tài chính công đoàn" },
    { key: "chi_giam_nguon_khac", no: "9", label: "Các khoản khác giảm nguồn TCCĐ" },
  ],
};

export const REPORT_GROUP_TITLE = "Phân loại theo báo cáo tổng hợp";

export function isReportGroup(kind: CategoryKind, key: unknown): key is string {
  return typeof key === "string" && REPORT_GROUPS[kind].some((g) => g.key === key && !g.header);
}

/** "3.1. Các khoản thu khác – DN hỗ trợ" */
export function reportGroupLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  for (const list of Object.values(REPORT_GROUPS)) {
    const g = list.find((x) => x.key === key);
    if (!g) continue;
    const parent = g.parent ? list.find((x) => x.key === g.parent) : null;
    return `${g.no}. ${parent ? `${parent.label} – ` : ""}${g.label}`;
  }
  return null;
}
