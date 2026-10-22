import type ExcelJS from "exceljs";
import type { FormSettings } from "@/lib/forms/settings";
import { PAYMENT_LIMITS, PAYMENT_METHOD_LABEL } from "./registry";
import type { PaymentItemRow, PaymentRequestRow } from "./server";

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

function money(value: number): number | null {
  return value > 0 ? value : null;
}

/** Khối chữ ký A29:I33 thay cho ảnh liên kết của mẫu gốc. */
function writeSignatures(ws: ExcelJS.Worksheet, names: [string, string, string], fontName?: string) {
  const blocks: [string, string, string][] = [
    ["A", "D", "Người lập"],
    ["E", "G", "Kế toán Công đoàn"],
    ["H", "I", "Chủ tịch Công đoàn"],
  ];
  const center: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };
  blocks.forEach(([from, to, title], index) => {
    for (const [row, value, font] of [
      [29, title, { bold: true, size: 11 }],
      [30, "(Ký, ghi rõ họ tên)", { italic: true, size: 9 }],
      [33, names[index] || null, { bold: true, size: 11 }],
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
function addItemSheet(workbook: ExcelJS.Workbook, req: PaymentRequestRow, items: PaymentItemRow[], fontName?: string) {
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
  sheet.getCell("A1").value = `BẢNG KÊ KÈM GIẤY ĐỀ NGHỊ THANH TOÁN ${req.code}`;
  sheet.getCell("A1").font = { ...font, bold: true, size: 13 };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.mergeCells("A2:E2");
  sheet.getCell("A2").value = req.title;
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

  items.forEach((item, index) => {
    const row = sheet.getRow(5 + index);
    row.values = [index + 1, item.content, item.paid_to ?? "", item.amount, money(item.advanced)];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = font;
      cell.border = border;
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: col === 1 ? "center" : undefined };
      if (col >= 4) cell.numFmt = MONEY_FORMAT;
    });
  });

  const last = 4 + items.length;
  const total = sheet.getRow(last + 1);
  sheet.mergeCells(`A${last + 1}:C${last + 1}`);
  total.getCell(1).value = "Tổng cộng";
  total.getCell(4).value = { formula: `SUM(D5:D${last})`, result: req.total_amount };
  total.getCell(5).value = { formula: `SUM(E5:E${last})`, result: req.advanced_amount };
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
  const values: Record<string, ExcelJS.CellValue> = {
    D4: dateCell(req.request_date),
    D5: req.requester_name,
    D6: req.requester_department ?? settings.preparerDepartment,
    E21: `${req.payment_method === "cash" ? "☑" : "☐"} ${PAYMENT_METHOD_LABEL.cash} / Cash`,
    E22: `${req.payment_method === "transfer" ? "☑" : "☐"} ${PAYMENT_METHOD_LABEL.transfer} / Bank`,
    H24: req.receiver_name ?? "",
    H25: req.receiver_account ?? "",
    H26: req.receiver_bank ?? "",
    E27: req.payment_method === "transfer" ? "Nội dung CK/ Description" : "Nội dung/ Description",
    G27: ":",
    H27: req.title,
  };

  const useItemSheet = items.length > PAYMENT_LIMITS.slipRows;
  const slipLines = useItemSheet
    ? [
        {
          content: `${req.title} – chi theo bảng kê đính kèm (${items.length} khoản)`,
          paidTo: req.receiver_name ?? "",
          amount: req.total_amount,
          advanced: req.advanced_amount,
        },
      ]
    : items.map((item) => ({ content: item.content, paidTo: item.paid_to ?? "", amount: item.amount, advanced: item.advanced }));

  for (let i = 0; i < PAYMENT_LIMITS.slipRows; i++) {
    const row = FIRST_ITEM_ROW + i;
    const line = slipLines[i];
    values[`A${row}`] = line ? i + 1 : null;
    values[`B${row}`] = line?.content ?? null;
    values[`F${row}`] = line?.paidTo || null;
    values[`H${row}`] = line ? line.amount : null;
    values[`I${row}`] = line ? money(line.advanced) : null;
  }

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
    writeSignatures(ws, [req.requester_name, settings.accountantName, settings.chairmanName], fontName);
    if (useItemSheet) addItemSheet(workbook, req, items, fontName);
  };

  return { values, customize };
}
