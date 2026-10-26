import { DETAIL_FIELD_LABEL, type MemberDetails } from "@/lib/members/profile-shared";

/** Cột của bảng Hồ sơ đoàn viên (/admin/members), theo thứ tự hiển thị. */
export const MEMBER_TABLE_COLUMNS = [
  "employee_code",
  "full_name",
  "department",
  "date_of_birth",
  "gender",
  "marital_status",
  "children_count",
  "has_identity",
  "completeness",
  "missing",
  "updated_at",
] as const;

export type MemberTableColumnKey = (typeof MEMBER_TABLE_COLUMNS)[number];

export const MEMBER_TABLE_DEFAULT_COLUMNS: MemberTableColumnKey[] = [
  "employee_code",
  "full_name",
  "department",
  "date_of_birth",
  "marital_status",
  "children_count",
  "completeness",
];

export const MEMBER_TABLE_COLUMN_LABEL: Record<MemberTableColumnKey, string> = {
  employee_code: "Mã NV",
  full_name: "Họ tên",
  department: "Bộ phận",
  date_of_birth: DETAIL_FIELD_LABEL.date_of_birth,
  gender: DETAIL_FIELD_LABEL.gender,
  marital_status: "Hôn nhân",
  children_count: "Số con",
  has_identity: "CCCD",
  completeness: "Hồ sơ",
  missing: "Còn thiếu",
  updated_at: "Cập nhật",
};

/** Thông tin chi tiết không có trên bảng, chỉ có trong file Excel (luôn xuất sau các cột đang hiển thị). */
export const MEMBER_EXPORT_DETAIL_COLUMNS = [
  "phone",
  "permanent_address",
  "current_address",
  "no_children",
  "bank_account_no",
  "bank_name",
  "bank_branch",
  "bank_account_holder",
] as const satisfies readonly (keyof MemberDetails)[];

export type MemberExportColumnKey = MemberTableColumnKey | (typeof MEMBER_EXPORT_DETAIL_COLUMNS)[number];

export const MEMBER_EXPORT_COLUMNS: readonly MemberExportColumnKey[] = [
  ...MEMBER_TABLE_COLUMNS,
  ...MEMBER_EXPORT_DETAIL_COLUMNS,
];

export function isMemberTableColumn(key: unknown): key is MemberTableColumnKey {
  return typeof key === "string" && (MEMBER_TABLE_COLUMNS as readonly string[]).includes(key);
}

export function isMemberExportColumn(key: unknown): key is MemberExportColumnKey {
  return typeof key === "string" && (MEMBER_EXPORT_COLUMNS as readonly string[]).includes(key);
}

export function completenessLabel(done: number, total: number): string {
  if (done === total) return "Đã khai đủ";
  return done === 0 ? "Chưa khai" : "Chưa đủ";
}
