"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { toAccountHolderName } from "@/lib/bank-transfer";
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
        holder: toAccountHolderName(r.fullName),
        transfer: rewardTransferText(r.items, list.money, list.pollTitle),
        detail: items.map((i) => `${i.label} (${formatVnd(list.money[i.kind])}đ)`).join("; "),
        total: rowTotal(r.items, list.money),
      };
    });
  }, [list]);
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const missingBank = rows.filter((r) => !r.bankAccountNo).length;
  const noMoney = list !== null && total === 0;

  const numbered = useMemo(() => rows.map((r, idx) => ({ ...r, stt: idx + 1 })), [rows]);

  const columns: DataTableColumn<(typeof numbered)[number]>[] = [
    {
      key: "stt",
      header: "STT",
      type: "number",
      className: "text-center",
      headerClassName: "text-center",
    },
    {
      key: "employeeCode",
      header: "Mã NV",
      className: "whitespace-nowrap",
    },
    {
      key: "fullName",
      header: "Họ tên",
      className: "font-semibold text-[#173A67]",
      render: (r) => (
        <>
          {r.fullName}
          <span className="block text-[11px] font-normal text-on-surface-variant">{r.holder}</span>
        </>
      ),
    },
    {
      key: "bankAccountNo",
      header: "Số tài khoản",
      className: "whitespace-nowrap",
      render: (r) => r.bankAccountNo || <span className="text-amber-700">Chưa khai</span>,
    },
    {
      key: "bankName",
      header: "Ngân hàng",
      type: "enum",
      render: (r) => r.bankName,
    },
    {
      key: "transfer",
      header: "Nội dung chuyển khoản",
      render: (r) => (
        <>
          {r.transfer}
          <span className="block text-[11px] text-on-surface-variant">{r.detail}</span>
        </>
      ),
    },
    {
      key: "total",
      header: "Tổng tiền (đ)",
      type: "number",
      className: "whitespace-nowrap text-right font-semibold",
      headerClassName: "text-right",
      render: (r) => formatVnd(r.total),
    },
  ];

  function selectPoll(id: string) {
    startTransition(() => router.push(`${pathname}?poll=${encodeURIComponent(id)}`));
  }

  async function exportExcel() {
    if (!list) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const header = [
        "STT",
        "Mã nhân viên",
        "Họ tên",
        "Tên chủ tài khoản",
        "Số tài khoản",
        "Ngân hàng",
        "Nội dung chuyển khoản",
        "Tổng tiền (VNĐ)",
      ];
      const data = rows.map((r, idx) => [
        idx + 1,
        r.employeeCode,
        r.fullName,
        r.holder,
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
        ["", "", "TỔNG CỘNG", "", "", "", "", total],
      ]);
      const firstDataRow = 5;
      const totalCol = header.length - 1;
      for (let r = firstDataRow; r <= firstDataRow + data.length; r++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c: totalCol })];
        if (cell) cell.z = "#,##0";
      }
      sheet["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: totalCol } }));
      sheet["!cols"] = [6, 14, 28, 28, 22, 26, 70, 16].map((wch) => ({ wch }));
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

          <div className="print:hidden">
            <DataTable
              columns={columns}
              emptyText="Chương trình này không có người nhận thưởng."
              footerNote={
                rows.length > 0 ? (
                  <span className="not-italic font-bold text-[#173A67]">TỔNG CỘNG: {formatVnd(total)}đ</span>
                ) : null
              }
              rowKey={(r) => `${r.employeeCode}-${r.stt}`}
              rows={numbered}
            />
          </div>

          <table className="hidden w-full text-left text-black print:table print:text-[11px]">
            <thead>
              <tr className="[&>th]:border [&>th]:border-black [&>th]:px-1.5 [&>th]:py-1 [&>th]:font-bold">
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
                  <td className="border border-black px-1.5 py-1 text-center" colSpan={7}>
                    Chương trình này không có người nhận thưởng.
                  </td>
                </tr>
              ) : null}
              {rows.map((r, idx) => (
                <tr
                  key={`${r.employeeCode}-${idx}`}
                  className="break-inside-avoid [&>td]:border [&>td]:border-black [&>td]:px-1.5 [&>td]:py-1"
                >
                  <td className="text-center">{idx + 1}</td>
                  <td className="whitespace-nowrap">{r.employeeCode}</td>
                  <td className="font-semibold">{r.fullName}</td>
                  <td className="whitespace-nowrap">{r.bankAccountNo}</td>
                  <td>{r.bankName}</td>
                  <td>{r.transfer}</td>
                  <td className="whitespace-nowrap text-right font-semibold">{formatVnd(r.total)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="font-bold [&>td]:border [&>td]:border-black [&>td]:px-1.5 [&>td]:py-1">
                  <td colSpan={6} className="text-right">
                    TỔNG CỘNG
                  </td>
                  <td className="whitespace-nowrap text-right">{formatVnd(total)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>

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
