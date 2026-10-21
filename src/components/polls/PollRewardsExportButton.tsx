"use client";

import { useMemo, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  EMPTY_REWARD_MONEY,
  REWARD_KINDS,
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

type Loaded = { pollTitle: string; rows: PollRewardRow[] };

export function PollRewardsExportButton({ pollId }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [money, setMoney] = useState<RewardMoney>(EMPTY_REWARD_MONEY);

  const usedKinds = useMemo(
    () => new Set(loaded?.rows.flatMap((r) => r.items.map((i) => i.kind)) ?? []),
    [loaded],
  );
  const summary = useMemo(() => {
    const rows = loaded?.rows ?? [];
    return {
      people: rows.length,
      total: rows.reduce((sum, r) => sum + rowTotal(r.items, money), 0),
      missingBank: rows.filter((r) => !r.bankAccountNo).length,
    };
  }, [loaded, money]);

  async function openDialog() {
    setOpen(true);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/polls/rewards-export?pollId=${encodeURIComponent(pollId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.rows) throw new Error(data.error || "Không tải được danh sách nhận thưởng.");
      setLoaded({ pollTitle: data.pollTitle ?? "", rows: data.rows });
      setMoney(data.money ?? EMPTY_REWARD_MONEY);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách nhận thưởng.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAndExport() {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/polls/rewards-export", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, money }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không lưu được cài đặt tiền thưởng.");

      const XLSX = await import("xlsx");
      const header = ["STT", "Mã nhân viên", "Họ tên", "Số tài khoản", "Ngân hàng", "Nội dung thưởng", "Tổng tiền (VNĐ)"];
      const rows = loaded.rows.map((r, idx) => [
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
      const sheet = XLSX.utils.aoa_to_sheet([
        [UNION_NAME],
        ["DANH SÁCH NHẬN THƯỞNG"],
        [
          `${loaded.pollTitle} – ${rows.length} người${
            summary.missingBank ? ` (${summary.missingBank} người chưa có số tài khoản)` : ""
          }`,
        ],
        [],
        header,
        ...rows,
        ["", "", "TỔNG CỘNG", "", "", "", summary.total],
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
      setOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không xuất được danh sách nhận thưởng.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="flex items-center justify-center gap-1 rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#173A67] shadow-xs hover:bg-amber-100 transition cursor-pointer sm:px-3.5 sm:py-2 sm:text-xs"
        title="Cài đặt tiền thưởng và xuất Excel danh sách nhận thưởng kèm số tài khoản để làm phiếu chi"
        type="button"
        onClick={openDialog}
      >
        <MaterialIcon className="text-[15px] sm:text-[16px]" name="request_quote" />
        <span>DS nhận thưởng</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 text-on-surface">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#173A67]">Cài đặt tiền thưởng</h3>
                <p className="text-xs text-on-surface-variant">
                  Số tiền mỗi người nhận theo từng khoản. Cài đặt được lưu lại cho chương trình này.
                </p>
              </div>
              <button
                className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
                type="button"
                onClick={() => setOpen(false)}
              >
                <MaterialIcon className="text-[20px]" name="close" />
              </button>
            </div>

            {busy && !loaded ? (
              <p className="text-sm text-on-surface-variant">Đang tải danh sách...</p>
            ) : null}

            {loaded ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {REWARD_KINDS.map(({ kind, label }) => (
                    <label
                      key={kind}
                      className={`rounded-xl border p-3 ${
                        usedKinds.has(kind) ? "border-outline-variant" : "border-dashed border-outline-variant opacity-60"
                      }`}
                    >
                      <span className="block text-xs font-bold text-[#173A67]">{label}</span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <input
                          className="w-full rounded-lg border border-outline-variant px-2 py-1.5 text-right text-sm font-bold"
                          min={0}
                          step={1000}
                          type="number"
                          value={money[kind]}
                          onChange={(e) => setMoney((m) => ({ ...m, [kind]: Math.max(0, Number(e.target.value) || 0) }))}
                        />
                        <span className="text-xs text-on-surface-variant">đ</span>
                      </span>
                    </label>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    checked={money.entryForWinners}
                    className="h-4 w-4"
                    type="checkbox"
                    onChange={(e) => setMoney((m) => ({ ...m, entryForWinners: e.target.checked }))}
                  />
                  <span>Thành viên đội đạt giải nhận thêm tiền tham gia dự thi</span>
                </label>

                <div className="rounded-xl bg-surface-container-low p-3 text-sm">
                  <p>
                    <strong>{summary.people}</strong> người nhận – tổng tiền{" "}
                    <strong className="text-[#173A67]">{formatVnd(summary.total)}đ</strong>
                  </p>
                  {summary.missingBank ? (
                    <p className="text-xs text-amber-800">
                      {summary.missingBank} người chưa khai số tài khoản (ô trong file Excel để trống).
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <button
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold cursor-pointer"
                type="button"
                onClick={() => setOpen(false)}
              >
                Đóng
              </button>
              <button
                className="flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white cursor-pointer disabled:opacity-50"
                disabled={busy || !loaded}
                type="button"
                onClick={saveAndExport}
              >
                <MaterialIcon className="text-[18px]" name="download" />
                <span>{busy && loaded ? "Đang xuất..." : "Lưu & xuất Excel"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
