import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

/**
 * In phiếu từ mẫu Excel của công đoàn: mở file mẫu, ghi giá trị vào đúng ô, giữ nguyên
 * định dạng (font, viền, ô gộp, vùng in). File mẫu nằm trong src/lib/print/templates —
 * thay mẫu chỉ cần chép đè file và kiểm tra lại địa chỉ ô trong phần định nghĩa mẫu.
 * Route dùng mẫu phải được khai báo trong outputFileTracingIncludes (next.config.ts).
 */
export type TemplateDef = {
  file: string;
  /** Vùng thừa trong mẫu cần xóa trắng (gỡ cả ô gộp nằm trong vùng). */
  clear?: string[];
  /** Bỏ ảnh EMF (ảnh liên kết / “camera” của Excel) – exceljs không cập nhật được nội dung ảnh này. */
  dropEmfImages?: boolean;
};

export const PRINT_TEMPLATES = {
  /** Mẫu C11-TLĐ – Phiếu thăm hỏi đoàn viên (khối chữ ký cũ M49:S55 nằm ngoài vùng in). */
  visitSlip: { file: "phieu_tham_hoi.xlsx", clear: ["M49:S55"] },
  /** Giấy đề nghị thanh toán – khối chữ ký gốc là ảnh liên kết tới K46:Q52, được thay bằng ô thật. */
  paymentSlip: { file: "de_nghi_thanh_toan.xlsx", clear: ["K46:S55"], dropEmfImages: true },
} satisfies Record<string, TemplateDef>;

export type TemplateId = keyof typeof PRINT_TEMPLATES;

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function decodeRange(range: string) {
  const [a, b = a] = range.split(":");
  const parse = (ref: string) => {
    const m = /^([A-Z]+)(\d+)$/.exec(ref.toUpperCase());
    if (!m) throw new Error(`Địa chỉ ô không hợp lệ: ${ref}`);
    const col = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
    return { row: Number(m[2]), col };
  };
  const s = parse(a);
  const e = parse(b);
  return { top: Math.min(s.row, e.row), bottom: Math.max(s.row, e.row), left: Math.min(s.col, e.col), right: Math.max(s.col, e.col) };
}

export function clearRange(ws: ExcelJS.Worksheet, range: string) {
  const area = decodeRange(range);
  const merges: string[] = (ws.model as { merges?: string[] }).merges ?? [];
  for (const merge of merges) {
    const m = decodeRange(merge);
    if (m.top >= area.top && m.bottom <= area.bottom && m.left >= area.left && m.right <= area.right) {
      ws.unMergeCells(merge);
    }
  }
  for (let r = area.top; r <= area.bottom; r++) {
    for (let c = area.left; c <= area.right; c++) ws.getCell(r, c).value = null;
  }
}

type MediaModel = { extension?: string };
type WorksheetMedia = { type: string; imageId: string | number };

function dropEmfImages(workbook: ExcelJS.Workbook, ws: ExcelJS.Worksheet) {
  const media = (workbook as unknown as { model: { media: MediaModel[] } }).model.media;
  const sheet = ws as unknown as { _media: WorksheetMedia[] };
  sheet._media = sheet._media.filter((m) => m.type !== "image" || media[Number(m.imageId)]?.extension !== "emf");
}

/**
 * values: { "C5": "Nguyễn Văn A", "C9": 500000, "C12": new Date() } – ghi vào sheet đầu tiên.
 * customize: chỉnh thêm sau khi ghi (viết ô ngoài bảng giá trị, thêm trang tính…).
 */
export async function renderTemplate(
  id: TemplateId,
  values: Record<string, ExcelJS.CellValue>,
  customize?: (ws: ExcelJS.Worksheet, workbook: ExcelJS.Workbook) => void,
): Promise<Buffer> {
  const def: TemplateDef = PRINT_TEMPLATES[id];
  const source = await readFile(path.join(process.cwd(), "src", "lib", "print", "templates", def.file));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(source as unknown as ExcelJS.Buffer);
  const ws = workbook.worksheets[0];
  if (!ws) throw new Error(`Mẫu ${def.file} không có trang tính.`);

  if (def.dropEmfImages) dropEmfImages(workbook, ws);
  for (const range of def.clear ?? []) clearRange(ws, range);
  for (const [address, value] of Object.entries(values)) ws.getCell(address).value = value;
  customize?.(ws, workbook);

  workbook.calcProperties.fullCalcOnLoad = true;
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
