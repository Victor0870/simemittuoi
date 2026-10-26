import { PERMISSIONS, hasPermission, type AccessInfo } from "@/lib/auth/permissions";

export type UnionPosition = {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UnionOfficer = {
  id: string;
  userId: string | null;
  userFullName: string | null;
  userEmployeeCode: string | null;
  userDepartment: string | null;
  fullName: string;
  positionId: string;
  positionName: string;
  positionIsActive: boolean;
  displayOrder: number;
  isActive: boolean;
  term: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssignableUnionMember = {
  id: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
};

export const DEFAULT_UNION_POSITIONS = [
  "Chủ tịch",
  "Phó chủ tịch",
  "Ủy viên",
  "Kế toán",
] as const;

export const UNION_SETTINGS_LIMITS = {
  positionName: 120,
  officerName: 160,
  term: 120,
} as const;

/**
 * Kiểm tra quyền quản lý Cài đặt công đoàn:
 * Quản trị viên hoặc người có quyền cài đặt biểu mẫu (forms.settings) / quản lý văn bản (posts.manage).
 */
export function canManageUnionSettings(access: AccessInfo | null | undefined): boolean {
  if (!access || !access.isApproved) return false;
  return (
    access.isAdmin ||
    hasPermission(access, PERMISSIONS.formsSettings) ||
    hasPermission(access, PERMISSIONS.postsManage)
  );
}

/** Chuẩn hóa chuỗi tiếng Việt để tìm kiếm không phân biệt hoa thường & dấu. */
export function normalizeViSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

/** Định dạng cán bộ công đoàn khi chèn vào thành phần tham gia biên bản: "Họ tên - Chức danh". */
export function formatOfficerAttendee(
  officer: Pick<UnionOfficer, "fullName" | "positionName">,
): string {
  const name = officer.fullName.trim();
  const pos = officer.positionName.trim();
  return pos ? `${name} - ${pos}` : name;
}

/**
 * Nhận diện trường "Thành phần tham gia" (và các trường thành phần/đại diện/chủ trì/thư ký trong biên bản họp)
 * để bật gợi ý tự động cán bộ công đoàn đang hoạt động.
 */
export function isAttendeeField(field: { key: string; label: string }): boolean {
  const k = field.key.toLowerCase();
  const l = normalizeViSearch(field.label);
  return (
    k.includes("thanh_phan") ||
    k.includes("tham_gia") ||
    k.includes("tham_du") ||
    k.includes("dai_dien") ||
    k.includes("chu_tri") ||
    k.includes("chu_toa") ||
    k.includes("thu_ky") ||
    k.includes("nguoi_tham") ||
    l.includes("thanh phan") ||
    l.includes("tham gia") ||
    l.includes("tham du") ||
    l.includes("dai dien") ||
    l.includes("chu tri") ||
    l.includes("chu toa") ||
    l.includes("thu ky") ||
    l.includes("nguoi ghi bien ban")
  );
}

/** Lọc danh sách cán bộ ĐANG HOẠT ĐỘNG (cả cán bộ và chức danh đều active) theo từ khóa. */
export function matchActiveOfficers(officers: UnionOfficer[], rawQuery: string): UnionOfficer[] {
  const active = officers.filter((o) => o.isActive && o.positionIsActive);
  const q = normalizeViSearch(rawQuery);
  if (!q) return active;

  return active.filter((o) => {
    const nameNorm = normalizeViSearch(o.fullName);
    const posNorm = normalizeViSearch(o.positionName);
    const combined = `${nameNorm} - ${posNorm}`;
    return nameNorm.includes(q) || posNorm.includes(q) || combined.includes(q);
  });
}

export type AttendeeTokenContext = {
  /** Giá trị từ khóa người dùng đang gõ ở dòng / phân đoạn hiện tại */
  query: string;
  /** Vị trí bắt đầu thay thế trong chuỗi gốc (sau dấu đầu dòng / dấu phẩy) */
  replaceStart: number;
  /** Vị trí kết thúc thay thế trong chuỗi gốc */
  replaceEnd: number;
};

/**
 * Tách từ khóa tên người đang gõ tại vị trí con trỏ trong ô Thành phần tham gia
 * (hỗ trợ nhập nhiều người cách nhau bằng xuống dòng, dấu phẩy hoặc dấu chấm phẩy).
 * Nếu phân đoạn hiện tại đã có dạng "Họ tên - Chức danh" hoàn chỉnh thì trả về null.
 */
export function extractAttendeeToken(text: string, cursor: number): AttendeeTokenContext | null {
  const safeCursor = Math.max(0, Math.min(cursor, text.length));

  // Tìm ranh giới phân đoạn gần nhất (\n, ',', ';') trước con trỏ
  let segStart = 0;
  for (let i = safeCursor - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "\n" || ch === "," || ch === ";") {
      segStart = i + 1;
      break;
    }
  }

  // Tìm ranh giới phân đoạn gần nhất sau con trỏ
  let segEnd = text.length;
  for (let i = safeCursor; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n" || ch === "," || ch === ";") {
      segEnd = i;
      break;
    }
  }

  const beforeCursorInSeg = text.slice(segStart, safeCursor);
  // Giữ nguyên khoảng trắng đầu dòng và ký hiệu gạch đầu dòng / đánh số (VD: "- ", "+ ", "1. ")
  const prefixMatch = beforeCursorInSeg.match(/^(\s*(?:[-–•+]\s+|\d+[.)]\s+)?)/);
  const prefixLen = prefixMatch ? prefixMatch[1].length : 0;

  const replaceStart = segStart + prefixLen;
  const typedFragment = text.slice(replaceStart, safeCursor);
  const fullSegmentAfterPrefix = text.slice(replaceStart, segEnd);

  // Nếu người dùng chưa gõ chữ nào trong phân đoạn này hoặc đã chèn xong "Tên - Chức danh"
  if (!typedFragment.trim()) return null;
  if (/\s-\s/.test(fullSegmentAfterPrefix)) return null;

  return {
    query: typedFragment.trim(),
    replaceStart,
    replaceEnd: segEnd,
  };
}

/**
 * Chèn "Họ tên - Chức danh" của cán bộ công đoàn được chọn vào đúng vị trí đang gõ,
 * giữ nguyên các dòng / tên khác trong ô.
 */
export function applyOfficerSelection(
  text: string,
  cursor: number,
  officer: Pick<UnionOfficer, "fullName" | "positionName">,
): { nextValue: string; nextCursor: number } {
  const ctx = extractAttendeeToken(text, cursor);
  const formatted = formatOfficerAttendee(officer);

  if (!ctx) {
    const trimmed = text.trimEnd();
    const sep = !trimmed ? "" : trimmed.endsWith("\n") || trimmed.endsWith(",") || trimmed.endsWith(";") ? " " : "\n- ";
    const nextValue = trimmed ? `${trimmed}${sep}${formatted}` : formatted;
    return { nextValue, nextCursor: nextValue.length };
  }

  const before = text.slice(0, ctx.replaceStart);
  const after = text.slice(ctx.replaceEnd);
  const nextValue = `${before}${formatted}${after}`;
  const nextCursor = before.length + formatted.length;
  return { nextValue, nextCursor };
}
