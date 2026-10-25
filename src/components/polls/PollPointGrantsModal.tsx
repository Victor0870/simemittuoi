"use client";

import { useCallback, useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PollDetail } from "@/lib/data/polls";
import { POINTS_BUDGET_MAX } from "@/lib/polls/vote-mode";

type Grant = {
  id: string;
  voterKind: "individual" | "team";
  teamOptionId: string | null;
  employeeCode: string | null;
  points: number;
  reason: string;
  grantedByName: string | null;
  createdAt: string;
};

type Props = {
  poll: PollDetail;
  isOpen: boolean;
  onClose: () => void;
};

export function PollPointGrantsModal({ poll, isOpen, onClose }: Props) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<"individual" | "team">("individual");
  const [employeeCode, setEmployeeCode] = useState("");
  const [optionId, setOptionId] = useState("");
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/polls/points/grants?pollId=${encodeURIComponent(poll.id)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không tải được lịch sử cộng điểm.");
      setGrants(data.grants ?? []);
    } catch (err: any) {
      setError(err?.message || "Không tải được lịch sử cộng điểm.");
    } finally {
      setLoading(false);
    }
  }, [poll.id]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const titleByOption = new Map(poll.options.map((o) => [o.id, o.title]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (targetType === "team" && !optionId) {
      setError("Vui lòng chọn đội chơi.");
      return;
    }
    if (targetType === "individual" && !employeeCode.trim()) {
      setError("Vui lòng nhập mã nhân viên.");
      return;
    }
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do cộng điểm.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/polls/points/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollId: poll.id,
          targetType,
          employeeCode: targetType === "individual" ? employeeCode.trim() : undefined,
          optionId: targetType === "team" ? optionId : undefined,
          points,
          reason: reason.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không cộng được điểm.");
      setMessage(data.message || "Đã cộng điểm.");
      setReason("");
      setPoints(1);
      await load();
    } catch (err: any) {
      setError(err?.message || "Không cộng được điểm.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3">
          <div>
            <h3 className="text-base font-extrabold text-[#173A67]">Cộng điểm bình chọn</h3>
            <p className="text-xs text-on-surface-variant">
              Ngân sách = điểm cơ bản ({poll.pointsPerVoter} điểm/người, {poll.pointsPerTeam} điểm/đội) + điểm cộng thêm.
            </p>
          </div>
          <button
            aria-label="Đóng"
            className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container cursor-pointer"
            type="button"
            onClick={onClose}
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          <form className="space-y-3 rounded-xl border border-outline-variant p-4" onSubmit={handleSubmit}>
            <div className="flex flex-wrap gap-2">
              {(["individual", "team"] as const).map((value) => (
                <button
                  key={value}
                  className={`rounded-xl border-2 px-3 py-1.5 text-sm font-bold cursor-pointer ${
                    targetType === value
                      ? "border-[#173A67] bg-[#173A67]/5 text-[#173A67]"
                      : "border-outline-variant text-on-surface-variant"
                  }`}
                  type="button"
                  onClick={() => setTargetType(value)}
                >
                  {value === "individual" ? "Người bình chọn" : "Đội chơi"}
                </button>
              ))}
            </div>

            {targetType === "individual" ? (
              <label className="block space-y-1">
                <span className="text-xs font-bold text-[#173A67]">Mã nhân viên</span>
                <input
                  className="w-full rounded-xl border border-outline-variant px-3 py-2 text-sm uppercase"
                  placeholder="VD: 0139"
                  type="text"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                />
                <span className="block text-[11px] text-on-surface-variant">
                  Thành viên của đội chơi bình chọn bằng điểm chung của đội; muốn cộng cho họ hãy chọn Đội chơi.
                </span>
              </label>
            ) : (
              <label className="block space-y-1">
                <span className="text-xs font-bold text-[#173A67]">Đội chơi</span>
                <select
                  className="w-full rounded-xl border border-outline-variant px-3 py-2 text-sm"
                  value={optionId}
                  onChange={(e) => setOptionId(e.target.value)}
                >
                  <option value="">-- Chọn đội chơi --</option>
                  {poll.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.orderNum} {o.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-[#173A67]">Số điểm</span>
                <input
                  className="w-full rounded-xl border border-outline-variant px-3 py-2 text-center text-sm font-bold"
                  max={POINTS_BUDGET_MAX}
                  min={1}
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-[#173A67]">Lý do</span>
                <input
                  className="w-full rounded-xl border border-outline-variant px-3 py-2 text-sm"
                  maxLength={500}
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>

            {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}
            {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}

            <button
              className="rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#27496D] cursor-pointer disabled:opacity-50"
              disabled={saving}
              type="submit"
            >
              {saving ? "Đang lưu..." : "Cộng điểm"}
            </button>
          </form>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-[#173A67]">Lịch sử cộng điểm</h4>
            {loading ? (
              <p className="text-xs text-on-surface-variant">Đang tải...</p>
            ) : grants.length === 0 ? (
              <p className="text-xs text-on-surface-variant">Chưa cộng điểm cho ai.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-outline-variant">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-low text-[#173A67]">
                    <tr>
                      <th className="px-3 py-2">Thời gian</th>
                      <th className="px-3 py-2">Người/đội nhận</th>
                      <th className="px-3 py-2 text-right">Điểm</th>
                      <th className="px-3 py-2">Lý do</th>
                      <th className="px-3 py-2">Người cộng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map((g) => (
                      <tr key={g.id} className="border-t border-outline-variant/60">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {new Date(g.createdAt).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-3 py-2">
                          {g.voterKind === "team"
                            ? `Đội: ${titleByOption.get(g.teamOptionId ?? "") ?? "(đã xóa)"}`
                            : `Mã NV ${g.employeeCode ?? ""}`}
                        </td>
                        <td className="px-3 py-2 text-right font-bold">+{g.points}</td>
                        <td className="px-3 py-2">{g.reason}</td>
                        <td className="px-3 py-2">{g.grantedByName || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
