"use client";

import { useState } from "react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";

type Props = {
  requireCurrent: boolean;
  submitLabel?: string;
  onSuccess: () => void;
};

export function ChangePasswordForm({ requireCurrent, submitLabel = "Đổi mật khẩu", onSuccess }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    const invalid = validateNewPassword(newPassword);
    if (invalid) return setError(invalid);
    if (newPassword !== confirmPassword) return setError("Hai lần nhập mật khẩu mới không khớp.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: requireCurrent ? currentPassword : undefined, newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Không đổi được mật khẩu.");

      await createClient().auth.refreshSession();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được mật khẩu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {requireCurrent ? (
        <div>
          <label className="mb-1 block text-label-md text-on-surface" htmlFor="current-password">
            Mật khẩu hiện tại
          </label>
          <PasswordInput
            autoComplete="current-password"
            id="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
        </div>
      ) : null}
      <div>
        <label className="mb-1 block text-label-md text-on-surface" htmlFor="new-password">
          Mật khẩu mới <span className="font-normal text-on-surface-variant">(tối thiểu {PASSWORD_MIN_LENGTH} ký tự)</span>
        </label>
        <PasswordInput
          autoComplete="new-password"
          id="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={newPassword}
          onChange={setNewPassword}
        />
      </div>
      <div>
        <label className="mb-1 block text-label-md text-on-surface" htmlFor="confirm-password">
          Nhập lại mật khẩu mới
        </label>
        <PasswordInput
          autoComplete="new-password"
          id="confirm-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="w-full rounded-xl bg-tertiary px-4 py-3 font-bold text-on-tertiary transition-shadow hover:shadow-md disabled:opacity-60"
        disabled={loading}
        type="submit"
      >
        {loading ? "Đang lưu..." : submitLabel}
      </button>
    </form>
  );
}
