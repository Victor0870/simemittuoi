import ExcelJS from "exceljs";
import { formatDateVi } from "@/lib/members/profile-shared";
import { FUND_AMOUNT_KEYS, periodLabels, splitFundTotals, sumFunds } from "./build";
import type { ReportBundle } from "./server";

const MONEY = "#,##0;[Red]-#,##0;\"-\"";
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9F2EC" } };
const GROUP_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F8" } };

type Cell = string | number | null;
type RowStyle = "normal" | "group" | "total";
/** counts: chỉ số cột (0-based) là số lượt / số phiếu – định dạng số nguyên thay vì tiền. */
type SheetRow = { values: Cell[]; style?: RowStyle; counts?: (i: number) => boolean };

function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  titles: string[],
  header: string[],
  rows: SheetRow[],
  widths: number[],
) {
  const ws = wb.addWorksheet(name, {
    pageSetup: { paperSize: 9, orientation: header.length > 8 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", ySplit: titles.length + 2, xSplit: 1 }],
  });
  ws.columns = widths.map((width) => ({ width }));
  titles.forEach((text, i) => {
    const row = ws.getRow(i + 1);
    row.getCell(1).value = text;
    row.getCell(1).font = { bold: i < 2, size: i === 1 ? 14 : 11, italic: i >= 2 };
    ws.mergeCells(i + 1, 1, i + 1, header.length);
    row.getCell(1).alignment = { horizontal: i === 0 ? "left" : "center" };
  });
  const headerRow = ws.getRow(titles.length + 2);
  header.forEach((text, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = text;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = BORDER;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  headerRow.height = 30;
  rows.forEach((r, idx) => {
    const row = ws.getRow(titles.length + 3 + idx);
    r.values.forEach((value, i) => {
      const cell = row.getCell(i + 1);
      cell.value = value;
      cell.border = BORDER;
      if (typeof value === "number") cell.numFmt = r.counts?.(i) ? "0" : MONEY;
      if (r.style === "group" || r.style === "total") cell.font = { bold: true };
      if (r.style === "group") cell.fill = GROUP_FILL;
      if (i === 0) cell.alignment = { wrapText: true, vertical: "middle" };
    });
  });
  return ws;
}

export async function buildReportWorkbook(report: ReportBundle, unionName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CDILV";
  const labels = periodLabels(report.granularity);
  const y = report.year;
  const periodName = report.granularity === "month" ? "theo tháng" : "theo quý";
  const footnote = `Số liệu lấy ngày ${formatDateVi(report.generatedOn)}`;

  // 1. Thu chi theo danh mục
  const f = report.finance;
  const catRow = (r: { code: string | null; name: string; values: number[]; total: number; previousYear: number }) => ({
    values: [r.code ? `${r.code} – ${r.name}` : r.name, ...r.values, r.total, r.previousYear] as Cell[],
  });
  addSheet(
    wb,
    "Thu chi theo danh mục",
    [unionName, `BÁO CÁO THU – CHI NĂM ${y}`, `Tổng hợp ${periodName} theo danh mục · ${footnote}`],
    ["Danh mục", ...labels, `Cả năm ${y}`, `Năm ${y - 1}`],
    [
      { values: ["I. THU", ...f.income.totals, f.income.total, f.income.previousYear], style: "group" },
      ...f.income.rows.map(catRow),
      { values: ["II. CHI", ...f.expense.totals, f.expense.total, f.expense.previousYear], style: "group" },
      ...f.expense.rows.map(catRow),
      {
        values: ["CHÊNH LỆCH THU – CHI", ...f.net, f.income.total - f.expense.total, f.income.previousYear - f.expense.previousYear],
        style: "total",
      },
    ],
    [46, ...labels.map(() => (report.granularity === "month" ? 12 : 15)), 16, 16],
  );

  // 2. Số dư quỹ
  const fundTotals = sumFunds(f.funds);
  const fundSplit = splitFundTotals(f.funds);
  addSheet(
    wb,
    "Số dư quỹ",
    [unionName, `TÌNH HÌNH CÁC QUỸ NĂM ${y}`, `Từ 01/01/${y} đến ${formatDateVi(f.closingDate)} · ${footnote}`],
    ["Quỹ", "Số dư đầu năm", "Thu", "Chi", "Chuyển đến", "Chuyển đi", "Số dư cuối kỳ"],
    [
      ...f.funds.map((r) => ({
        values: [r.kind === "savings" ? `${r.name} (tiết kiệm)` : r.name, ...FUND_AMOUNT_KEYS.map((k) => r[k])] as Cell[],
      })),
      ...(fundSplit
        ? [
            { values: ["Tiền chi được (tiền mặt + TK thanh toán)", ...FUND_AMOUNT_KEYS.map((k) => fundSplit.spendable[k])], style: "group" as const },
            { values: ["Tiền gửi tiết kiệm", ...FUND_AMOUNT_KEYS.map((k) => fundSplit.savings[k])], style: "group" as const },
          ]
        : []),
      { values: ["TỔNG CỘNG", ...FUND_AMOUNT_KEYS.map((k) => fundTotals[k])], style: "total" },
    ],
    [30, 16, 16, 16, 16, 16, 16],
  );

  // 3. Thăm hỏi
  const v = report.visits;
  const lastCountCol = labels.length * 2 + 1;
  const visitCount = (i: number) => i === lastCountCol || (i >= 1 && i < lastCountCol && i % 2 === 1);
  const statusCount = (i: number) => i === 1;
  addSheet(
    wb,
    "Thăm hỏi",
    [unionName, `TỔNG HỢP THĂM HỎI ĐOÀN VIÊN NĂM ${y}`, `Phiếu đã duyệt / đã chi, ${periodName} theo ngày lập · ${footnote}`],
    ["Loại sự việc", ...labels.flatMap((l) => [`${l} (lượt)`, `${l} (tiền)`]), "Cả năm (lượt)", "Cả năm (tiền)"],
    [
      ...v.rows.map((r) => ({
        values: [r.label, ...r.counts.flatMap((c, i) => [c || null, r.amounts[i]]), r.count, r.amount] as Cell[],
        counts: visitCount,
      })),
      {
        values: ["TỔNG CỘNG", ...v.totalCounts.flatMap((c, i) => [c || null, v.totalAmounts[i]]), v.count, v.amount],
        style: "total",
        counts: visitCount,
      },
      { values: [] },
      { values: ["Theo trạng thái (mọi phiếu lập trong năm)", "Số phiếu", "Số tiền"], style: "group" },
      ...v.byStatus.map((s) => ({ values: [s.label, s.count, s.amount] as Cell[], counts: statusCount })),
    ],
    [34, ...labels.flatMap(() => [9, 13]), 10, 15],
  );

  // 4. Đề nghị thanh toán
  const p = report.payments;
  addSheet(
    wb,
    "Đề nghị thanh toán",
    [unionName, `TỔNG HỢP ĐỀ NGHỊ THANH TOÁN NĂM ${y}`, `Theo ngày đề nghị · ${footnote}`],
    ["Chỉ tiêu", ...labels, `Cả năm ${y}`],
    [
      {
        values: ["Số đề nghị đã chi", ...p.paidCounts.map((c) => c || null), p.paidCounts.reduce((s, c) => s + c, 0)],
        counts: () => true,
      },
      { values: ["Số tiền đã chi", ...p.paidAmounts, p.paidAmounts.reduce((s, c) => s + c, 0)], style: "total" },
      { values: [] },
      { values: ["Theo trạng thái", "Số đề nghị", "Số tiền"], style: "group" },
      ...p.byStatus.map((s) => ({ values: [s.label, s.count, s.amount] as Cell[], counts: statusCount })),
    ],
    [32, ...labels.map(() => (report.granularity === "month" ? 12 : 15)), 16],
  );

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
