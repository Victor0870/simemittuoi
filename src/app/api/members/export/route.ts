import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { todayInVietnam } from "@/lib/life-events/registry";
import {
  MEMBER_EXPORT_COLUMNS,
  MEMBER_TABLE_COLUMN_LABEL,
  completenessLabel,
  isMemberExportColumn,
  isMemberTableColumn,
  type MemberExportColumnKey,
} from "@/lib/members/member-columns";
import { loadMemberExportRows, type MemberExportRow } from "@/lib/members/profile-server";
import { DETAIL_FIELD_LABEL, GENDER_LABEL, MARITAL_STATUS_LABEL, formatDateVi } from "@/lib/members/profile-shared";
import { XLSX_MIME } from "@/lib/print/xlsx-template";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXCEL_HEADER: Partial<Record<MemberExportColumnKey, string>> = {
  date_of_birth: DETAIL_FIELD_LABEL.date_of_birth,
  gender: DETAIL_FIELD_LABEL.gender,
  marital_status: DETAIL_FIELD_LABEL.marital_status,
  children_count: "Số con đã khai",
  has_identity: "Số CCCD (đã che)",
  completeness: "Tình trạng hồ sơ",
  updated_at: "Cập nhật lần cuối",
};

const COLUMN_WIDTH: Partial<Record<MemberExportColumnKey, number>> = {
  employee_code: 12,
  full_name: 28,
  department: 22,
  date_of_birth: 13,
  children_count: 10,
  has_identity: 18,
  completeness: 20,
  missing: 40,
  updated_at: 18,
  phone: 14,
  permanent_address: 40,
  current_address: 40,
  bank_account_no: 20,
  bank_name: 22,
  bank_branch: 22,
  bank_account_holder: 26,
};

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const dateTimeVi = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function headerLabel(key: MemberExportColumnKey): string {
  const custom = EXCEL_HEADER[key];
  if (custom) return custom;
  return isMemberTableColumn(key) ? MEMBER_TABLE_COLUMN_LABEL[key] : DETAIL_FIELD_LABEL[key];
}

function cellValue(row: MemberExportRow, key: MemberExportColumnKey): string | number | null {
  switch (key) {
    case "employee_code":
      return row.employee_code;
    case "full_name":
      return row.full_name;
    case "department":
      return row.department;
    case "date_of_birth":
      return row.date_of_birth ? formatDateVi(row.date_of_birth) : null;
    case "gender":
      return row.gender ? GENDER_LABEL[row.gender] : null;
    case "marital_status":
      return row.marital_status ? MARITAL_STATUS_LABEL[row.marital_status] : null;
    case "children_count":
      return row.children_count;
    case "has_identity":
      return row.id_masked;
    case "completeness": {
      const label = completenessLabel(row.completeness_done, row.completeness_total);
      return row.completeness_done === row.completeness_total
        ? label
        : `${label} (${row.completeness_done}/${row.completeness_total})`;
    }
    case "missing":
      return row.missing.join(", ") || null;
    case "updated_at":
      return row.updated_at ? dateTimeVi.format(new Date(row.updated_at)) : null;
    case "no_children":
      return row.details.no_children ? "Có" : null;
    default:
      return row.details[key];
  }
}

function parseColumns(raw: string | null): MemberExportColumnKey[] {
  const keys = [...new Set((raw ?? "").split(",").map((k) => k.trim()))].filter(isMemberExportColumn);
  return keys.length > 0 ? keys : [...MEMBER_EXPORT_COLUMNS];
}

async function buildWorkbook(rows: MemberExportRow[], columns: MemberExportColumnKey[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hồ sơ đoàn viên", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [{ width: 6 }, ...columns.map((key) => ({ width: COLUMN_WIDTH[key] ?? 16 }))];

  const headerRow = ws.getRow(1);
  ["STT", ...columns.map(headerLabel)].forEach((text, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = text;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECF4FF" } };
    cell.border = BORDER;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  headerRow.height = 30;

  rows.forEach((member, idx) => {
    const row = ws.getRow(idx + 2);
    [idx + 1, ...columns.map((key) => cellValue(member, key))].forEach((value, i) => {
      const cell = row.getCell(i + 1);
      cell.value = value;
      cell.border = BORDER;
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length + 1 } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Tải danh sách hồ sơ đoàn viên (Excel). ?cols=employee_code,full_name,... chỉ xuất các cột đó theo đúng thứ tự. */
export async function GET(request: NextRequest) {
  const access = await getCurrentAccess();
  if (!access) {
    return NextResponse.json({ error: "Vui lòng đăng nhập tài khoản." }, { status: 401 });
  }
  if (!hasPermission(access, PERMISSIONS.membersExport)) {
    return NextResponse.json(
      { error: "Bạn chưa được phân quyền xuất danh sách hồ sơ đoàn viên." },
      { status: 403 },
    );
  }

  try {
    const rows = await loadMemberExportRows(createServiceClient());
    const buffer = await buildWorkbook(rows, parseColumns(request.nextUrl.searchParams.get("cols")));
    const fileName = `ho-so-doan-vien-${todayInVietnam().replace(/-/g, "")}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("[api/members/export] error:", err);
    return NextResponse.json({ error: "Không tạo được file Excel." }, { status: 500 });
  }
}
