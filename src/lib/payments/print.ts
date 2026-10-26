import type ExcelJS from "exceljs";
import type { FormSettings } from "@/lib/forms/settings";
import { PAYMENT_LIMITS } from "./registry";
import type { PaymentItemRow, PaymentRequestRow } from "./server";
import { mapPaymentSlip, type PaymentSlipData } from "./slip-data";

/** Ô trên mẫu de_nghi_thanh_toan.xlsx (sheet “Thanh toan Cong Doan”, vùng in A1:I36). */
const FIRST_ITEM_ROW = 12;
const MONEY_FORMAT = "#,##0";

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
  sheet.columns = [{ width: 6 }, { width: 52 }, { width: 26 }, { width: 15 }, { width: 15 }];
  const font = { name: fontName, size: 11 };
  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = sheetData.heading;
  sheet.getCell("A1").font = { ...font, bold: true, size: 13 };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.mergeCells("A2:E2");
  sheet.getCell("A2").value = sheetData.title;
  sheet.getCell("A2").font = { ...font, italic: true };
  sheet.getCell("A2").alignment = { horizontal: "center", wrapText: true };

  const header = sheet.getRow(4);
  header.values = ["STT", "Chi tiết chi phí", "Đối tượng nhận", "Thực trả", "Đã tạm ứng"];
  header.eachCell((cell) => {
    cell.font = { ...font, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F8" } };
  });

  sheetData.rows.forEach((item, index) => {
    const row = sheet.getRow(5 + index);
    row.values = [item.no, item.content, item.paidTo, item.amount, item.advanced];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = font;
      cell.border = border;
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: col === 1 ? "center" : undefined };
      if (col >= 4) cell.numFmt = MONEY_FORMAT;
    });
  });

  const last = 4 + sheetData.rows.length;
  const total = sheet.getRow(last + 1);
  sheet.mergeCells(`A${last + 1}:C${last + 1}`);
  total.getCell(1).value = "Tổng cộng";
  total.getCell(4).value = { formula: `SUM(D5:D${last})`, result: sheetData.totalPaid };
  total.getCell(5).value = { formula: `SUM(E5:E${last})`, result: sheetData.totalAdvanced };
  for (let col = 1; col <= 5; col++) {
    const cell = total.getCell(col);
    cell.font = { ...font, bold: true };
    cell.border = border;
    if (col >= 4) cell.numFmt = MONEY_FORMAT;
  }
  sheet.pageSetup.printArea = `A1:E${last + 1}`;
}

/** Giá trị + bước chỉnh sửa để render Giấy đề nghị thanh toán từ mẫu. */
export function buildPaymentSlip(req: PaymentRequestRow, items: PaymentItemRow[], settings: FormSettings): PaymentSlip {
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
    E27: data.descriptionLabel,
    G27: ":",
    H27: data.description,
  };

  data.lines.forEach((line, i) => {
    const row = FIRST_ITEM_ROW + i;
    values[`A${row}`] = line ? line.no : null;
    values[`B${row}`] = line?.content ?? null;
    values[`F${row}`] = line?.paidTo || null;
    values[`H${row}`] = line ? line.amount : null;
    values[`I${row}`] = line ? line.advanced : null;
  });

  const customize = (ws: ExcelJS.Worksheet, workbook: ExcelJS.Workbook) => {
    const fontName = ws.getCell("A21").font?.name;
    for (let i = 0; i < PAYMENT_LIMITS.slipRows; i++) {
      const row = FIRST_ITEM_ROW + i;
      ws.getCell(`B${row}`).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      ws.getCell(`F${row}`).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      for (const col of ["H", "I"]) ws.getCell(`${col}${row}`).numFmt = MONEY_FORMAT;
    }
    ws.getCell("H25").numFmt = "@";
    ws.mergeCells("E27:F27");
    ws.mergeCells("H27:I27");
    ws.getRow(27).height = 30;
    const thin = { style: "thin", color: { indexed: 64 } } as Partial<ExcelJS.Border>;
    ws.getCell("E27").border = { left: thin, bottom: thin };
    ws.getCell("E27").alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    ws.getCell("G27").alignment = { vertical: "middle" };
    ws.getCell("H27").alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    ws.getCell("H27").font = { name: fontName, size: 11, bold: true };
    writeSignatures(ws, data.signatures, fontName);
    if (data.itemSheet) addItemSheet(workbook, data.itemSheet, fontName);
  };

  return { values, customize };
}
