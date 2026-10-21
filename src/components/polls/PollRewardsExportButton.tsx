"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  EMPTY_REWARD_MONEY,
  formatVnd,
  payableItems,
  rowTotal,
  type PollRewardRow,
  type RewardMoney,
} from "@/lib/polls/reward-money";

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
        money?: RewardMoney;
        rows?: PollRewardRow[];
      };
      if (!res.ok || !data.rows) throw new Error(data.error || "Không xuất được danh sách nhận thưởng.");
      const money = data.money ?? EMPTY_REWARD_MONEY;

      const XLSX = await import("xlsx");
      const header = ["STT", "Mã nhân viên", "Họ tên", "Số tài khoản", "Ngân hàng", "Nội dung thưởng", "Tổng tiền (VNĐ)"];
      const rows = data.rows.map((r, idx) => [
        idx + 1,
        r.employeeCode,
        r.fullName,
        r.bankAccountNo,
        r.bankName,
        payableItems(r.items, money)
          .map((i) => `${i.label} (${formatVnd(money[i.kind])}đ)`)
          .join("; "),
        rowTotal(r.items, money),
      ]);
      const total = data.rows.reduce((sum, r) => sum + rowTotal(r.items, money), 0);
      const missingBank = data.rows.filter((r) => !r.bankAccountNo).length;
      const sheet = XLSX.utils.aoa_to_sheet([
        [UNION_NAME],
        ["DANH SÁCH NHẬN THƯỞNG"],
        [
          `${data.pollTitle ?? ""} – ${rows.length} người${
            missingBank ? ` (${missingBank} người chưa có số tài khoản)` : ""
          }`,
        ],
        [],
        header,
        ...rows,
        ["", "", "TỔNG CỘNG", "", "", "", total],
      ]);
      const firstDataRow = 5;
      const totalCol = header.length - 1;
      for (let r = firstDataRow; r <= firstDataRow + rows.length; r++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c: totalCol })];
        if (cell) cell.z = "#,##0";
      }
      sheet["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: totalCol } }));
      sheet["!cols"] = [6, 14, 28, 22, 26, 60, 16].map((wch) => ({ wch }));
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
      title="Tải Excel danh sách nhận thưởng kèm số tài khoản và tổng tiền (số tiền cài trong Cài đặt cuộc thi → Giải thưởng)"
      type="button"
      onClick={exportExcel}
    >
      <MaterialIcon className="text-[15px] sm:text-[16px]" name="request_quote" />
      <span>{exporting ? "Đang xuất..." : "DS nhận thưởng"}</span>
    </button>
  );
}
