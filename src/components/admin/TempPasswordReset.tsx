"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

type Issued = { fullName: string; tempPassword: string };

export function useTempPasswordReset() {
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function issue(userId: string, fullName: string): Promise<boolean> {
    if (busyUserId) return false;
    if (
      !window.confirm(
        `Cấp mật khẩu tạm cho ${fullName}? Mật khẩu cũ sẽ không dùng được nữa, lần đăng nhập tới đoàn viên phải đặt mật khẩu mới.`,
      )
    ) {
      return false;
    }
    setBusyUserId(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", userId }),
      });
      const data = (await res.json().catch(() => ({}))) as { tempPassword?: string; fullName?: string; error?: string };
      if (!res.ok || !data.tempPassword) throw new Error(data.error || "Không cấp được mật khẩu tạm.");
      setIssued({ fullName: data.fullName || fullName, tempPassword: data.tempPassword });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cấp được mật khẩu tạm.");
      return false;
    } finally {
      setBusyUserId(null);
    }
  }

  return { busyUserId, issued, error, issue, clearIssued: () => setIssued(null), clearError: () => setError(null) };
}

export function TempPasswordDialog({ issued, onClose }: { issued: Issued | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!issued) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(issued!.tempPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-center gap-2">
          <MaterialIcon className="text-[24px] text-emerald-600" name="key" />
          <h3 className="text-lg font-bold text-[#173A67]">Đã cấp mật khẩu tạm</h3>
        </div>
        <p className="text-sm text-on-surface-variant">
          Gửi mật khẩu này cho <strong className="text-on-surface">{issued.fullName}</strong> (Zalo / trực tiếp). Mật
          khẩu chỉ hiện một lần; khi đăng nhập, đoàn viên sẽ được yêu cầu đặt mật khẩu mới.
        </p>
        <div className="flex items-center gap-2 rounded-2xl border border-dusty-border bg-surface-container-low p-3">
          <code className="flex-1 select-all text-center font-mono text-xl font-bold tracking-wider text-on-surface">
            {issued.tempPassword}
          </code>
          <button
            className="inline-flex items-center gap-1 rounded-xl border border-dusty-border bg-white px-3 py-2 text-xs font-bold text-[#173A67] transition hover:bg-dusty-light"
            type="button"
            onClick={() => void copy()}
          >
            <MaterialIcon className="text-[16px]" name={copied ? "check" : "content_copy"} />
            {copied ? "Đã chép" : "Chép"}
          </button>
        </div>
        <button
          className="w-full rounded-xl bg-[#173A67] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1E4A7D]"
          type="button"
          onClick={() => {
            setCopied(false);
            onClose();
          }}
        >
          Đã gửi, đóng
        </button>
      </div>
    </div>
  );
}
