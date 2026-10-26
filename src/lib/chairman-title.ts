/** Chức danh người đứng đầu công đoàn hiển thị trên site, phiếu in và phản hồi góp ý. */
export const CHAIRMAN_TITLE = "Chủ tịch BCH Công đoàn";

const LEGACY_CHAIRMAN_TITLE = "Chủ tịch Công đoàn";

/**
 * Giá trị đã lưu đúng bằng chức danh mặc định cũ thì hiển thị theo chức danh mới;
 * mọi giá trị khác do quản trị viên tự nhập giữ nguyên.
 */
export function normalizeChairmanTitle(value: string): string {
  return value.trim() === LEGACY_CHAIRMAN_TITLE ? CHAIRMAN_TITLE : value;
}
