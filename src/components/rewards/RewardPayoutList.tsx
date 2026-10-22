"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatVnd, payableItems, rewardTransferText, rowTotal } from "@/lib/polls/reward-money";
import type { ClosedPollOption, PollRewardList } from "@/lib/polls/rewards-server";

type Props = {
  polls: ClosedPollOption[];
  list: PollRewardList | null;
};

const UNION_NAME = "CÔNG ĐOÀN CƠ SỞ CDILV";

const inputClass =
  "rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

export function RewardPayoutList({ polls, list }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);

  const rows = useMemo(() => {
    if (!list) return [];
    return list.rows.map((r) => {
      const items = payableItems(r.items, list.money);
      return {
        ...r,
        transfer: rewardTransferText(r.items, list.money, list.pollTitle),
        detail: items.map((i) => `${i.label} (${formatVnd(list.money[i.kind])}đ)`).join("; "),
        total: rowTotal(r.items, list.money),
      };
    });
  }, [list]);
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const missingBank = rows.filter((r) => !r.bankAccountNo).length;
  const noMoney = list !== null && total === 0;

  function selectPoll(id: string) {
    startTransition(() => router.push(`${pathname}?poll=${encodeURIComponent(id)}`));
  }

  async function exportExcel() {
    if (!list) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const header = ["STT", "Mã nhân viên", "Họ tên", "Số tài khoản", "Ngân hàng", "Nội dung chuyển khoản", "Tổng tiền (VNĐ)"];
      const data = rows.map((r, idx) => [
        idx + 1,
        r.employeeCode,
        r.fullName,
        r.bankAccountNo,
        r.bankName,
        r.transfer,
        r.total,
      ]);
      const sheet = XLSX.utils.aoa_to_sheet([
        [UNION_NAME],
        ["DANH SÁCH NHẬN THƯỞNG"],
        [`${list.pollTitle} – ${rows.length} người${missingBank ? ` (${missingBank} người chưa có số tài khoản)` : ""}`],
        [],
        header,
        ...data,
        ["", "", "TỔNG CỘNG", "", "", "", total],
      ]);
      const firstDataRow = 5;
      const totalCol = header.length - 1;
      for (let r = firstDataRow; r <= firstDataRow + data.length; r++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c: totalCol })];
        if (cell) cell.z = "#,##0";
      }
      sheet["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: totalCol } }));
      sheet["!cols"] = [6, 14, 28, 22, 26, 70, 16].map((wch) => ({ wch }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Nhan thuong");
      XLSX.writeFile(book, `danh_sach_nhan_thuong_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  if (polls.length === 0) {
    return (
      <p className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
        Chưa có chương trình bình chọn nào kết thúc.
      </p>
    );
  }

  return (
    <div className="space-y-4 print:space-y-0">
      <style>{"@media print { @page { size: A4 landscape; margin: 12mm 10mm; } }"}</style>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 print:hidden">
        <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs font-semibold text-on-surface-variant">
          Chương trình
          <select
            className={inputClass}
            disabled={pending}
            value={list?.pollId ?? ""}
            onChange={(e) => selectPoll(e.target.value)}
          >
            {polls.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.closedAt ? ` (kết thúc ${new Date(p.closedAt).toLocaleDateString("vi-VN")})` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-[#173A67] transition hover:border-[#173A67] disabled:opacity-50"
            disabled={rows.length === 0}
            type="button"
            onClick={() => window.print()}
          >
            <MaterialIcon className="text-[18px]" name="print" />
            In danh sách
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-[#173A67] transition hover:border-[#173A67] disabled:opacity-50"
            disabled={rows.length === 0 || exporting}
            type="button"
            onClick={exportExcel}
          >
            <MaterialIcon className="text-[18px]" name="download" />
            {exporting ? "Đang xuất..." : "Xuất Excel"}
          </button>
        </div>
      </div>

      {list ? (
        <div className="grid grid-cols-3 gap-3 print:hidden">
          {[
            { label: "Người nhận", value: String(rows.length) },
            { label: "Tổng tiền", value: `${formatVnd(total)}đ` },
            { label: "Chưa có số tài khoản", value: String(missingBank) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
              <p className="text-xs text-on-surface-variant">{s.label}</p>
              <p className="text-headline-sm font-bold text-[#173A67]">{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {noMoney ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
          <MaterialIcon className="text-[20px]" name="warning" />
          <p>
            Chương trình này chưa cài số tiền thưởng. Người quản lý bình chọn cần vào trang bình chọn → ⚙️ Cài đặt cuộc
            thi → tab Giải thưởng → khối &ldquo;Tiền thưởng&rdquo; để nhập.
          </p>
        </div>
      ) : null}

      {list ? (
        <>
          <div className="hidden text-center text-black print:mb-4 print:block">
            <p className="text-left text-[12px] font-bold">{UNION_NAME}</p>
            <p className="mt-3 text-[15px] font-bold">DANH SÁCH NHẬN THƯỞNG</p>
            <p className="text-[12px] italic">{list.pollTitle}</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest print:overflow-visible print:rounded-none print:border-0 print:bg-white">
            <table className="min-w-full text-left text-sm print:text-[11px] print:text-black">
              <thead className="bg-[#D9F2EC] text-[#173A67] print:bg-white print:text-black">
                <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:font-bold print:[&>th]:border print:[&>th]:border-black print:[&>th]:px-1.5 print:[&>th]:py-1">
                  <th className="text-center">STT</th>
                  <th className="whitespace-nowrap">Mã NV</th>
                  <th>Họ tên</th>
                  <th className="whitespace-nowrap">Số tài khoản</th>
                  <th>Ngân hàng</th>
                  <th>Nội dung chuyển khoản</th>
                  <th className="whitespace-nowrap text-right">Tổng tiền (đ)</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-on-surface-variant" colSpan={7}>
                      Chương trình này không có người nhận thưởng.
                    </td>
                  </tr>
                ) : null}
                {rows.map((r, idx) => (
                  <tr
                    key={`${r.employeeCode}-${idx}`}
                    className="border-t border-outline-variant break-inside-avoid [&>td]:px-3 [&>td]:py-2 print:[&>td]:border print:[&>td]:border-black print:[&>td]:px-1.5 print:[&>td]:py-1"
                  >
                    <td className="text-center">{idx + 1}</td>
                    <td className="whitespace-nowrap">{r.employeeCode}</td>
                    <td className="font-semibold text-[#173A67] print:text-black">{r.fullName}</td>
                    <td className="whitespace-nowrap">
                      {r.bankAccountNo || <span className="text-amber-700 print:hidden">Chưa khai</span>}
                    </td>
                    <td>{r.bankName}</td>
                    <td className="print:text-black">
                      {r.transfer}
                      <span className="block text-[11px] text-on-surface-variant print:hidden">{r.detail}</span>
                    </td>
                    <td className="whitespace-nowrap text-right font-semibold">{formatVnd(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 ? (
                <tfoot>
                  <tr className="border-t-2 border-outline-variant font-bold [&>td]:px-3 [&>td]:py-2.5 print:[&>td]:border print:[&>td]:border-black print:[&>td]:px-1.5 print:[&>td]:py-1">
                    <td colSpan={6} className="text-right">
                      TỔNG CỘNG
                    </td>
                    <td className="whitespace-nowrap text-right text-[#173A67] print:text-black">{formatVnd(total)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <div className="hidden text-[12px] text-black print:mt-3 print:block">
            <p>
              Tổng cộng: <b>{rows.length}</b> người – <b>{formatVnd(total)}đ</b>.
            </p>
            <div className="mt-6 grid grid-cols-3 text-center break-inside-avoid">
              <div>
                <p className="font-bold">Người lập biểu</p>
                <p className="italic">(Ký, ghi rõ họ tên)</p>
              </div>
              <div>
                <p className="font-bold">Kế toán</p>
                <p className="italic">(Ký, ghi rõ họ tên)</p>
              </div>
              <div>
                <p className="italic">Ngày ..... tháng ..... năm ........</p>
                <p className="font-bold">TM. BAN CHẤP HÀNH</p>
                <p className="italic">(Ký, ghi rõ họ tên)</p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
