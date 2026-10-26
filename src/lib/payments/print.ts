import type ExcelJS from "exceljs";
import type { FormSettings } from "@/lib/forms/settings";
import type { PrintLogoImage } from "@/lib/print/logo-server";
import { PAYMENT_LIMITS } from "./registry";
import type { PaymentItemRow, PaymentRequestRow } from "./server";
import { mapPaymentSlip, type PaymentSlipData } from "./slip-data";

/** Ô trên mẫu de_nghi_thanh_toan.xlsx (sheet “Thanh toan Cong Doan”, vùng in A1:I36). */
const FIRST_ITEM_ROW = 12;
const MONEY_FORMAT = "#,##0";
/** Chỗ logo của mẫu gốc (ô A1–B1): lệch trái/trên tính bằng EMU, khung tối đa tính bằng pixel. */
const LOGO_OFFSET = { col: 104775, row: 57150 };
const LOGO_BOX = { width: 122, height: 112 };

/** Chèn logo theo cài đặt, giữ đúng tỉ lệ ảnh trong khung logo của mẫu. */
function addLogo(ws: ExcelJS.Worksheet, workbook: ExcelJS.Workbook, logo: PrintLogoImage) {
  const scale = Math.min(LOGO_BOX.width / logo.width, LOGO_BOX.height / logo.height);
  const imageId = workbook.addImage({ buffer: logo.buffer as unknown as ExcelJS.Buffer, extension: logo.extension });
  const tl = { nativeCol: 0, nativeColOff: LOGO_OFFSET.col, nativeRow: 0, nativeRowOff: LOGO_OFFSET.row };
  ws.addImage(imageId, {
    tl: tl as unknown as ExcelJS.ImagePosition["tl"],
    ext: { width: Math.round(logo.width * scale), height: Math.round(logo.height * scale) },
    editAs: "oneCell",
  });
}

/** Cột “Paid to” (F:G) bỏ khỏi phiếu: gộp vào cột Chi tiết chi phí thành B:G. */
function mergeContentColumns(ws: ExcelJS.Worksheet, row: number) {
  const merges: string[] = (ws.model as { merges?: string[] }).merges ?? [];
  for (const range of [`B${row}:E${row}`, `F${row}:G${row}`]) {
    if (merges.includes(range)) ws.unMergeCells(range);
  }
  const { top, bottom } = ws.getCell(`B${row}`).border ?? {};
  ws.getCell(`F${row}`).value = null;
  ws.mergeCells(`B${row}:G${row}`);
  const thin = { style: "thin", color: { indexed: 64 } } as Partial<ExcelJS.Border>;
  for (const col of ["B", "C", "D", "E", "F", "G"]) {
    const cell = ws.getCell(`${col}${row}`);
    // Ô gộp dùng chung đối tượng style với ô đầu – gán style mới để viền từng ô không ghi đè nhau.
    cell.style = {
      ...cell.style,
      border: { top, bottom, ...(col === "B" ? { left: thin } : {}), ...(col === "G" ? { right: thin } : {}) },
    };
  }
}

export type PaymentSlip = {
  values: Record<string, ExcelJS.CellValue>;
  customize: (ws: ExcelJS.Worksheet, workbook: ExcelJS.Workbook) => void;
};

function dateCell(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Khối chữ ký A29:I33 thay cho ảnh liên kết của mẫu gốc (tiêu đề giữ đúng chữ trong vùng O47:Q52 của mẫu). */
function writeSignatures(ws: ExcelJS.Worksheet, signatures: PaymentSlipData["signatures"], fontName?: string) {
  const columns: [string, string][] = [
    ["A", "D"],
    ["E", "G"],
    ["H", "I"],
  ];
  const center: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };
  columns.forEach(([from, to], index) => {
    const sign = signatures[index];
    for (const [row, value, font] of [
      [29, sign.title, { bold: true, size: 11 }],
      [33, sign.name || null, { bold: true, size: 11 }],
    ] as const) {
      ws.mergeCells(`${from}${row}:${to}${row}`);
      const cell = ws.getCell(`${from}${row}`);
      cell.value = value;
      cell.font = { name: fontName, ...font };
      cell.alignment = center;
    }
  });
}

/** Trang “Bảng kê” khi đề nghị có nhiều dòng hơn mẫu chứa được. */
function addItemSheet(workbook: ExcelJS.Workbook, sheetData: NonNullable<PaymentSlipData["itemSheet"]>, fontName?: string) {
  const sheet = workbook.addWorksheet("Bảng kê", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [{ width: 6 }, { width: 70 }, { width: 15 }, { width: 15 }];
  const font = { name: fontName, size: 11 };
  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  sheet.mergeCells("A1:D1");
  sheet.getCell("A1").value = sheetData.heading;
  sheet.getCell("A1").font = { ...font, bold: true, size: 13 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  const header = sheet.getRow(3);
  header.values = ["STT", "Chi tiết chi phí", "Thực trả", "Đã tạm ứng"];
  header.eachCell((cell) => {
    cell.font = { ...font, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F8" } };
  });

  sheetData.rows.forEach((item, index) => {
    const row = sheet.getRow(4 + index);
    row.values = [item.no, item.content, item.amount, item.advanced];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = font;
      cell.border = border;
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: col === 1 ? "center" : undefined };
      if (col >= 3) cell.numFmt = MONEY_FORMAT;
    });
  });

  const last = 3 + sheetData.rows.length;
  const total = sheet.getRow(last + 1);
  sheet.mergeCells(`A${last + 1}:B${last + 1}`);
  total.getCell(1).value = "Tổng cộng";
  total.getCell(3).value = { formula: `SUM(C4:C${last})`, result: sheetData.totalPaid };
  total.getCell(4).value = { formula: `SUM(D4:D${last})`, result: sheetData.totalAdvanced };
  for (let col = 1; col <= 4; col++) {
    const cell = total.getCell(col);
    cell.font = { ...font, bold: true };
    cell.border = border;
    if (col >= 3) cell.numFmt = MONEY_FORMAT;
  }
  sheet.pageSetup.printArea = `A1:D${last + 1}`;
}

/** Giá trị + bước chỉnh sửa để render Giấy đề nghị thanh toán từ mẫu. */
export function buildPaymentSlip(
  req: PaymentRequestRow,
  items: PaymentItemRow[],
  settings: FormSettings,
  logo: PrintLogoImage | null,
): PaymentSlip {
  const data = mapPaymentSlip(req, items, settings);
  const values: Record<string, ExcelJS.CellValue> = {
    D4: dateCell(data.date),
    D5: data.requester,
    D6: data.department,
    E21: `${data.cash ? "☑" : "☐"} Cash`,
    E22: `${data.bank ? "☑" : "☐"} Bank`,
    H24: data.receiverName,
    H25: data.receiverAccount,
    H26: data.receiverBank,
  };

  data.lines.forEach((line, i) => {
    const row = FIRST_ITEM_ROW + i;
    values[`A${row}`] = line ? line.no : null;
    values[`B${row}`] = line?.content ?? null;
    values[`H${row}`] = line ? line.amount : null;
    values[`I${row}`] = line ? line.advanced : null;
  });

  const customize = (ws: ExcelJS.Worksheet, workbook: ExcelJS.Workbook) => {
    const fontName = ws.getCell("A21").font?.name;
    mergeContentColumns(ws, FIRST_ITEM_ROW - 1);
    for (let i = 0; i < PAYMENT_LIMITS.slipRows; i++) {
      const row = FIRST_ITEM_ROW + i;
      mergeContentColumns(ws, row);
      ws.getCell(`B${row}`).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      for (const col of ["H", "I"]) ws.getCell(`${col}${row}`).numFmt = MONEY_FORMAT;
    }
    ws.getCell("H25").numFmt = "@";
    if (logo) addLogo(ws, workbook, logo);
    writeSignatures(ws, data.signatures, fontName);
    if (data.itemSheet) addItemSheet(workbook, data.itemSheet, fontName);
  };

  return { values, customize };
}
