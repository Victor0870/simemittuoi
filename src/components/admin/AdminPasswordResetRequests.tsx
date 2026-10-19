"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TempPasswordDialog, useTempPasswordReset } from "@/components/admin/TempPasswordReset";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatTimeAgo } from "@/lib/data/albums";

export type PasswordResetRequestItem = {
  id: string;
  userId: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
  email: string;
  contact: string | null;
  emailSent: boolean;
  createdAt: string;
  requestCount: number;
};

export function AdminPasswordResetRequests({ requests }: { requests: PasswordResetRequestItem[] }) {
  const router = useRouter();
  const { busyUserId, issued, error, issue, clearIssued } = useTempPasswordReset();
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissError, setDismissError] = useState<string | null>(null);

  if (requests.length === 0) return <TempPasswordDialog issued={issued} onClose={clearIssued} />;

  async function dismiss(requestId: string) {
    if (dismissingId || !window.confirm("Đóng yêu cầu này (không cấp mật khẩu tạm)?")) return;
    setDismissingId(requestId);
    setDismissError(null);
    try {
      const res = await fetch("/api/admin/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", requestId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Không đóng được yêu cầu.");
      router.refresh();
    } catch (err) {
      setDismissError(err instanceof Error ? err.message : "Không đóng được yêu cầu.");
    } finally {
      setDismissingId(null);
    }
  }

  const message = error || dismissError;

  return (
    <section
      id="password-resets"
      className="mb-6 scroll-mt-24 space-y-3 rounded-3xl border-2 border-amber-300 bg-amber-50/60 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-amber-950 sm:text-lg">
          <MaterialIcon className="text-[22px] text-amber-600" name="lock_reset" />
          Yêu cầu quên mật khẩu ({requests.length})
        </h2>
        <p className="text-xs text-amber-900/80">
          Cấp mật khẩu tạm rồi gửi cho đoàn viên qua Zalo / trực tiếp.
        </p>
      </div>

      {message ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{message}</p>
      ) : null}

      <ul className="space-y-2">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="font-bold text-on-surface">
                {r.fullName}
                {r.employeeCode ? <span className="ml-1.5 text-sm font-semibold text-[#173A67]">· {r.employeeCode}</span> : null}
              </p>
              <p className="break-all text-xs text-on-surface-variant">
                {r.email}
                {r.department ? ` · ${r.department}` : ""}
              </p>
              <p className="text-xs text-on-surface-variant">
                {r.contact ? (
                  <span className="font-semibold text-on-surface">Liên hệ: {r.contact} · </span>
                ) : null}
                {formatTimeAgo(r.createdAt)}
                {r.requestCount > 1 ? ` · gửi ${r.requestCount} lần` : ""}
                {" · "}
                {r.emailSent ? "đã gửi email" : "email không gửi được"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                className="inline-flex items-center gap-1 rounded-xl bg-[#173A67] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1E4A7D] disabled:opacity-50"
                disabled={busyUserId === r.userId}
                type="button"
                onClick={() => void issue(r.userId, r.fullName).then((ok) => ok && router.refresh())}
              >
                <MaterialIcon className="text-[16px]" name="key" />
                {busyUserId === r.userId ? "Đang cấp..." : "Cấp mật khẩu tạm"}
              </button>
              <button
                className="rounded-xl border border-dusty-border px-3 py-2 text-xs font-bold text-on-surface-variant transition hover:bg-surface-container disabled:opacity-50"
                disabled={dismissingId === r.id}
                type="button"
                onClick={() => void dismiss(r.id)}
              >
                Đóng
              </button>
            </div>
          </li>
        ))}
      </ul>

      <TempPasswordDialog issued={issued} onClose={clearIssued} />
    </section>
  );
}
