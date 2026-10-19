"use client";

import { useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, contact }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Không gửi được yêu cầu. Vui lòng thử lại.");
      setDone(data.message || "Đã ghi nhận yêu cầu.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được yêu cầu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm sm:p-8">
      <h1 className="mb-2 text-headline-md text-[#173A67]">Quên mật khẩu</h1>

      {done ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            <MaterialIcon className="mt-0.5 text-[20px] text-emerald-600" name="mark_email_read" />
            <p>{done}</p>
          </div>
          <Link
            className="block w-full rounded-xl bg-tertiary px-4 py-3 text-center font-bold text-on-tertiary transition-shadow hover:shadow-md"
            href="/login"
          >
            Về trang đăng nhập
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-6 text-body-md text-on-surface-variant">
            Nhập email bạn đã dùng để đăng ký. Hệ thống sẽ gửi link đặt lại mật khẩu, đồng thời báo Ban chấp hành
            Công đoàn để hỗ trợ nếu bạn không nhận được email.
          </p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-label-md text-on-surface" htmlFor="email">
                Email đăng ký
              </label>
              <input
                required
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 outline-none focus:border-[#173A67]"
                id="email"
                inputMode="email"
                spellCheck={false}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-label-md text-on-surface" htmlFor="contact">
                Số điện thoại / Zalo <span className="font-normal text-on-surface-variant">(không bắt buộc)</span>
              </label>
              <input
                autoComplete="tel"
                className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 outline-none focus:border-[#173A67]"
                id="contact"
                inputMode="tel"
                maxLength={100}
                placeholder="Để Ban chấp hành liên hệ hỗ trợ"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>

            {error ? (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              className="w-full rounded-xl bg-tertiary px-4 py-3 font-bold text-on-tertiary transition-shadow hover:shadow-md disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "Đang gửi..." : "Gửi yêu cầu"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-on-surface-variant">
            Nhớ ra mật khẩu?{" "}
            <Link className="font-bold text-[#173A67] hover:underline" href="/login">
              Đăng nhập
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
