"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PollRewardRow } from "@/app/api/polls/rewards-export/route";

const UNION_NAME = "CÔNG ĐOÀN CƠ SỞ CDILV";

type Props = {
  pollId: string;
};

export function PollRewardsExportButton({ pollId }: Props) {
  const [exporting, setExporting] = useState(false);

  async function exportExcel() {
    setExporting(true);
    try {
      const res = await fetch(`/api/polls/rewards-export?pollId=${encodeURIComponent(pollId)}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        pollTitle?: string;
        rows?: PollRewardRow[];
      };
      if (!res.ok || !data.rows) throw new Error(data.error || "Không xuất được danh sách nhận thưởng.");

      const XLSX = await import("xlsx");
      const header = ["STT", "Mã nhân viên", "Họ tên", "Số tài khoản", "Ngân hàng", "Nội dung thưởng"];
      const rows = data.rows.map((r, idx) => [
        idx + 1,
        r.employeeCode,
        r.fullName,
        r.bankAccountNo,
        r.bankName,
        r.reward,
      ]);
      const missing = data.rows.filter((r) => !r.bankAccountNo).length;
      const sheet = XLSX.utils.aoa_to_sheet([
        [UNION_NAME],
        ["DANH SÁCH NHẬN THƯỞNG"],
        [`${data.pollTitle ?? ""} – Tổng số: ${rows.length} lượt${missing ? ` (${missing} lượt chưa có số tài khoản)` : ""}`],
        [],
        header,
        ...rows,
      ]);
      const lastCol = header.length - 1;
      sheet["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: lastCol } }));
      sheet["!cols"] = [6, 14, 28, 22, 26, 48].map((wch) => ({ wch }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Nhan thuong");
      XLSX.writeFile(book, `danh_sach_nhan_thuong_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Không xuất được danh sách nhận thưởng.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      className="flex items-center justify-center gap-1 rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#173A67] shadow-xs hover:bg-amber-100 transition cursor-pointer disabled:opacity-50 sm:px-3.5 sm:py-2 sm:text-xs"
      disabled={exporting}
      title="Xuất Excel danh sách thành viên dự thi và người dự đoán chính xác nhất, kèm số tài khoản để làm phiếu chi"
      type="button"
      onClick={exportExcel}
    >
      <MaterialIcon className="text-[15px] sm:text-[16px]" name="request_quote" />
      <span>{exporting ? "Đang xuất..." : "DS nhận thưởng"}</span>
    </button>
  );
}
