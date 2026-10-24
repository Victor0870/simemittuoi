/**
 * Cài đặt thông tin cố định của Công đoàn / Công ty dùng cho Văn bản công đoàn.
 * Lưu ở cdilv_app_settings (key = DOCUMENT_SETTINGS_KEY).
 * Thiết kế tách rời phần cố định để hệ thống dễ dàng phục vụ nhiều công ty / CĐCS khác nhau.
 */

export const DOCUMENT_SETTINGS_KEY = "document_settings";

export type DocumentOrgSettings = {
  /** Công đoàn cấp trên (VD: CÔNG ĐOÀN KHU KINH TẾ HẢI PHÒNG) */
  parentUnionName: string;
  /** Tên CĐCS in hoa ở góc trái tiêu đề (VD: CĐCS: CÔNG TY TNHH DẦU NHỜN IDEMITSU VIỆT NAM) */
  unionHeaderName: string;
  /** Tên CĐCS viết thường dùng trong nội dung văn bản */
  unionFullName: string;
  /** Tên Công ty dùng trong nội dung văn bản */
  companyName: string;
  /** Ký hiệu đuôi số Quyết định (VD: /QĐ-CĐCS) */
  decisionCodeSuffix: string;
  /** Quốc hiệu (cố định) */
  nationalHeader: string;
  /** Tiêu ngữ (cố định) */
  nationalMotto: string;
  /** Địa danh hành chính mặc định (VD: Hải Phòng) */
  defaultLocation: string;
  /** Thẩm quyền ký (VD: TM. BCH CÔNG ĐOÀN) */
  signAuthority: string;
  /** Chức danh người ký (VD: CHỦ TỊCH) */
  signerTitle: string;
  /** Họ tên người ký mặc định */
  signerName: string;
  /** Danh sách Nơi nhận mặc định */
  defaultRecipients: string[];
  /** Thư viện các câu Căn cứ pháp lý/nội bộ thường dùng của đơn vị để chọn nhanh */
  defaultBases: string[];
};

export const DEFAULT_DOCUMENT_ORG_SETTINGS: DocumentOrgSettings = {
  parentUnionName: "CÔNG ĐOÀN KHU KINH TẾ HẢI PHÒNG",
  unionHeaderName: "CĐCS: CÔNG TY TNHH DẦU NHỜN IDEMITSU VIỆT NAM",
  unionFullName: "Công đoàn cơ sở Công ty TNHH Dầu Nhờn Idemitsu Việt Nam",
  companyName: "Công ty TNHH Dầu Nhờn Idemitsu Việt Nam",
  decisionCodeSuffix: "/QĐ-CĐCS",
  nationalHeader: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
  nationalMotto: "Độc lập - Tự do - Hạnh phúc",
  defaultLocation: "Hải Phòng",
  signAuthority: "TM. BCH CÔNG ĐOÀN",
  signerTitle: "CHỦ TỊCH",
  signerName: "",
  defaultRecipients: [
    "BCH Công đoàn;",
    "Bộ phận Tài chính/Kế toán CĐ;",
    "Lưu: CĐ.",
  ],
  defaultBases: [
    "Căn cứ Luật Công đoàn số 12/2012/QH13 ngày 20 tháng 6 năm 2012;",
    "Căn cứ Điều lệ Công đoàn Việt Nam khóa XIII;",
    "Căn cứ Quyết định số 4290/QĐ-TLĐ ngày 01 tháng 03 năm 2022 của Tổng Liên đoàn Lao động Việt Nam về việc ban hành Quy định thu, chi, quản lý tài chính, tài sản tại công đoàn cơ sở;",
    "Căn cứ Quyết định 613/QĐ-TLĐ ngày 24/12/2025 của Tổng Liên đoàn Lao động Việt Nam ban hành Quy định chế độ phụ cấp cán bộ công đoàn các cấp;",
    "Căn cứ quy chế chi tiêu và nguồn kinh phí của Công đoàn cơ sở;",
    "Căn cứ vào nguồn kinh phí của Công đoàn cơ sở;",
    "Căn cứ ý kiến phê duyệt của Tổng Giám đốc Công ty;",
  ],
};

export const DOC_SETTING_TEXT_LIMIT = 240;
export const DOC_SETTING_LIST_LIMIT = 30;
export const DOC_SETTING_ITEM_LIMIT = 500;

/** Các biến hệ thống tự động lấy từ Cài đặt đơn vị. */
export const SYSTEM_SETTING_TOKENS: { token: string; label: string; getValue: (s: DocumentOrgSettings) => string }[] = [
  { token: "{{cong_doan_cap_tren}}", label: "Công đoàn cấp trên", getValue: (s) => s.parentUnionName },
  { token: "{{ten_cdcs_hoa}}", label: "Tên CĐCS (tiêu đề)", getValue: (s) => s.unionHeaderName },
  { token: "{{ten_cdcs}}", label: "Tên CĐCS (trong bài)", getValue: (s) => s.unionFullName },
  { token: "{{ten_cong_ty}}", label: "Tên Công ty", getValue: (s) => s.companyName },
  { token: "{{ky_hieu_qd}}", label: "Ký hiệu đuôi QĐ", getValue: (s) => s.decisionCodeSuffix },
  { token: "{{dia_danh}}", label: "Địa danh", getValue: (s) => s.defaultLocation },
  { token: "{{tham_quyen_ky}}", label: "Thẩm quyền ký", getValue: (s) => s.signAuthority },
  { token: "{{chuc_vu_ky}}", label: "Chức danh ký", getValue: (s) => s.signerTitle },
  { token: "{{nguoi_ky_mac_dinh}}", label: "Người ký mặc định", getValue: (s) => s.signerName },
];

function cleanText(value: unknown, fallback: string, max = DOC_SETTING_TEXT_LIMIT): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, max);
  return trimmed || fallback;
}

function cleanOptionalText(value: unknown, max = DOC_SETTING_TEXT_LIMIT): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const items = value
    .map((item) => (typeof item === "string" ? item.trim().replace(/\s+/g, " ").slice(0, DOC_SETTING_ITEM_LIMIT) : ""))
    .filter(Boolean)
    .slice(0, DOC_SETTING_LIST_LIMIT);
  return items.length > 0 ? items : [...fallback];
}

export function normalizeDocumentOrgSettings(raw: unknown): DocumentOrgSettings {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    parentUnionName: cleanText(data.parentUnionName, DEFAULT_DOCUMENT_ORG_SETTINGS.parentUnionName),
    unionHeaderName: cleanText(data.unionHeaderName, DEFAULT_DOCUMENT_ORG_SETTINGS.unionHeaderName),
    unionFullName: cleanText(data.unionFullName, DEFAULT_DOCUMENT_ORG_SETTINGS.unionFullName),
    companyName: cleanText(data.companyName, DEFAULT_DOCUMENT_ORG_SETTINGS.companyName),
    decisionCodeSuffix: cleanText(data.decisionCodeSuffix, DEFAULT_DOCUMENT_ORG_SETTINGS.decisionCodeSuffix, 60),
    nationalHeader: cleanText(data.nationalHeader, DEFAULT_DOCUMENT_ORG_SETTINGS.nationalHeader),
    nationalMotto: cleanText(data.nationalMotto, DEFAULT_DOCUMENT_ORG_SETTINGS.nationalMotto),
    defaultLocation: cleanText(data.defaultLocation, DEFAULT_DOCUMENT_ORG_SETTINGS.defaultLocation, 80),
    signAuthority: cleanText(data.signAuthority, DEFAULT_DOCUMENT_ORG_SETTINGS.signAuthority, 120),
    signerTitle: cleanText(data.signerTitle, DEFAULT_DOCUMENT_ORG_SETTINGS.signerTitle, 120),
    signerName: cleanOptionalText(data.signerName, 120),
    defaultRecipients: cleanStringList(data.defaultRecipients, DEFAULT_DOCUMENT_ORG_SETTINGS.defaultRecipients),
    defaultBases: cleanStringList(data.defaultBases, DEFAULT_DOCUMENT_ORG_SETTINGS.defaultBases),
  };
}

/** Thay các biến cố định của đơn vị vào nội dung văn bản khi xem trước hoặc xuất file. */
export function applyOrgSettingsToText(text: string, settings: DocumentOrgSettings): string {
  let result = text;
  for (const item of SYSTEM_SETTING_TOKENS) {
    result = result.split(item.token).join(item.getValue(settings));
  }
  return result;
}
