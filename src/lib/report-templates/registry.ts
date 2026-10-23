/**
 * Mẫu báo cáo dùng chung (VD S82-TLĐ), lưu trong DB theo phiên bản – xem supabase/migration_report_templates.sql.
 * Danh mục thu – chi gắn vào "mã mục" (code của dòng loại item), không gắn vào id dòng,
 * nên khi áp dụng phiên bản mới giữ nguyên mã thì danh mục không phải chọn lại.
 */

export type TemplateSide = "income" | "expense";
export type TemplateLineType = "item" | "group" | "subtotal";
export type TemplateVersionStatus = "draft" | "active" | "archived";

/** Mẫu dùng để phân loại danh mục thu – chi và lập bảng tổng hợp. */
export const PRIMARY_TEMPLATE_CODE = "S82-TLD";
export const REPORT_GROUP_TITLE = "Phân loại theo báo cáo tổng hợp";

export const TEMPLATE_SIDE_LABEL: Record<TemplateSide, string> = { income: "Phần thu", expense: "Phần chi" };

export const LINE_TYPE_LABEL: Record<TemplateLineType, string> = {
  item: "Chỉ tiêu (chọn cho danh mục)",
  group: "Nhóm (cộng các dòng con)",
  subtotal: "Dòng cộng (cộng các mã chỉ định)",
};

export const VERSION_STATUS_LABEL: Record<TemplateVersionStatus, string> = {
  draft: "Bản nháp",
  active: "Đang áp dụng",
  archived: "Đã thay thế",
};

export const TEMPLATE_LIMITS = { code: 20, label: 200, title: 200, note: 1000, lines: 200 } as const;
const CODE_RE = /^[A-Za-z0-9._-]{1,20}$/;

export type TemplateLine = {
  side: TemplateSide;
  code: string;
  label: string;
  line_type: TemplateLineType;
  parent_code: string | null;
  sum_codes: string[];
  sort_order: number;
};

export type TemplateVersion = {
  id: string;
  version: number;
  status: TemplateVersionStatus;
  title: string;
  note: string | null;
  effective_from: string | null;
  published_at: string | null;
  lines: TemplateLine[];
};

export type ReportTemplate = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: TemplateVersion | null;
  draft: TemplateVersion | null;
  /** Mọi phiên bản (mới nhất trước), không kèm dòng. */
  history: Omit<TemplateVersion, "lines">[];
};

export function sideLines(lines: TemplateLine[], side: TemplateSide): TemplateLine[] {
  return lines.filter((l) => l.side === side).sort((a, b) => a.sort_order - b.sort_order);
}

/** "Đoàn phí công đoàn (22)" – dòng cộng không kèm mã. */
export function lineTitle(line: Pick<TemplateLine, "code" | "label" | "line_type">): string {
  return line.line_type === "subtotal" ? line.label : `${line.label} (${line.code})`;
}

/** Độ sâu theo parent_code (0 = dòng gốc). */
export function lineDepth(lines: TemplateLine[], line: TemplateLine): number {
  let depth = 0;
  let parent = line.parent_code;
  const seen = new Set<string>();
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    const p = lines.find((l) => l.side === line.side && l.code === parent);
    if (!p) break;
    depth++;
    parent = p.parent_code;
  }
  return depth;
}

export function isItemCode(lines: TemplateLine[], side: TemplateSide, code: unknown): code is string {
  return typeof code === "string" && lines.some((l) => l.side === side && l.code === code && l.line_type === "item");
}

/** "Các khoản thu khác (25) – DN hỗ trợ (25.01)" cho mã chỉ tiêu của danh mục. */
export function itemPath(lines: TemplateLine[], side: TemplateSide, code: string | null | undefined): string | null {
  if (!code) return null;
  const line = lines.find((l) => l.side === side && l.code === code && l.line_type === "item");
  if (!line) return null;
  const parts = [lineTitle(line)];
  let parent = line.parent_code;
  while (parent) {
    const p = lines.find((l) => l.side === side && l.code === parent);
    if (!p || parts.length > 10) break;
    parts.unshift(lineTitle(p));
    parent = p.parent_code;
  }
  return parts.join(" – ");
}

/** Mã chỉ tiêu (item) nằm dưới một dòng: chính nó, các con cháu (group) hoặc các mã cộng (subtotal). */
export function leafCodes(lines: TemplateLine[], side: TemplateSide, code: string, seen = new Set<string>()): string[] {
  if (seen.has(code)) return [];
  seen.add(code);
  const line = lines.find((l) => l.side === side && l.code === code);
  if (!line) return [];
  if (line.line_type === "item") return [code];
  const next =
    line.line_type === "group"
      ? lines.filter((l) => l.side === side && l.parent_code === code).map((l) => l.code)
      : line.sum_codes;
  return next.flatMap((c) => leafCodes(lines, side, c, seen));
}

/** Kiểm tra bộ dòng của một phiên bản trước khi lưu / áp dụng. Trả về danh sách lỗi (rỗng = hợp lệ). */
export function validateTemplateLines(lines: TemplateLine[]): string[] {
  const errors: string[] = [];
  if (lines.length > TEMPLATE_LIMITS.lines) errors.push(`Tối đa ${TEMPLATE_LIMITS.lines} dòng.`);
  for (const side of ["income", "expense"] as const) {
    const name = TEMPLATE_SIDE_LABEL[side];
    const rows = sideLines(lines, side);
    if (!rows.some((l) => l.line_type === "item")) errors.push(`${name}: cần ít nhất một chỉ tiêu.`);
    const codes = new Map<string, TemplateLine>();
    for (const l of rows) {
      if (!CODE_RE.test(l.code)) errors.push(`${name}: mã "${l.code}" không hợp lệ (chữ, số, . _ -, tối đa 20 ký tự).`);
      if (!l.label.trim() || l.label.length > TEMPLATE_LIMITS.label) errors.push(`${name}: dòng ${l.code} thiếu tên hoặc tên quá dài.`);
      if (codes.has(l.code)) errors.push(`${name}: mã ${l.code} bị trùng.`);
      codes.set(l.code, l);
    }
    for (const l of rows) {
      if (l.parent_code) {
        const p = codes.get(l.parent_code);
        if (!p) errors.push(`${name}: dòng ${l.code} thuộc nhóm ${l.parent_code} không tồn tại.`);
        else if (p.line_type !== "group") errors.push(`${name}: dòng ${l.code} chỉ được nằm dưới dòng loại Nhóm.`);
        else if (l.line_type === "subtotal") errors.push(`${name}: dòng cộng ${l.code} không đặt trong nhóm.`);
      }
      if (l.line_type === "group" && !rows.some((c) => c.parent_code === l.code)) {
        errors.push(`${name}: nhóm ${l.code} chưa có dòng con.`);
      }
      if (l.line_type === "subtotal") {
        if (!l.sum_codes.length) errors.push(`${name}: dòng cộng ${l.code} chưa chọn mã cần cộng.`);
        for (const c of l.sum_codes) {
          if (!codes.has(c)) errors.push(`${name}: dòng cộng ${l.code} cộng mã ${c} không tồn tại.`);
        }
        const leaves = l.sum_codes.flatMap((c) => leafCodes(rows, side, c));
        if (new Set(leaves).size !== leaves.length) errors.push(`${name}: dòng cộng ${l.code} cộng trùng một chỉ tiêu hai lần.`);
      } else if (l.sum_codes.length) {
        errors.push(`${name}: chỉ dòng cộng mới có danh sách mã cần cộng (dòng ${l.code}).`);
      }
    }
    for (const l of rows) {
      const seen = new Set<string>([l.code]);
      let parent = l.parent_code;
      while (parent) {
        if (seen.has(parent)) {
          errors.push(`${name}: nhóm ${l.code} lồng vòng.`);
          break;
        }
        seen.add(parent);
        parent = codes.get(parent)?.parent_code ?? null;
      }
    }
  }
  return [...new Set(errors)];
}

/** Chuẩn hóa dữ liệu dòng gửi từ form. */
export function parseTemplateLines(raw: unknown): TemplateLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, TEMPLATE_LIMITS.lines + 1).map((r, index) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
    const type = o.line_type === "group" || o.line_type === "subtotal" ? o.line_type : "item";
    return {
      side: o.side === "expense" ? "expense" : "income",
      code: str(o.code),
      label: str(o.label),
      line_type: type,
      parent_code: str(o.parent_code) || null,
      sum_codes:
        type === "subtotal" && Array.isArray(o.sum_codes)
          ? [...new Set(o.sum_codes.map(str).filter(Boolean))]
          : [],
      sort_order: (index + 1) * 10,
    };
  });
}
