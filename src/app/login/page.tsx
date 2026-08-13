"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    const userId = data.user?.id;
    let nextPath = "/";

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("approval_status, role")
        .eq("id", userId)
        .maybeSingle();

      if (profile?.approval_status !== "approved") {
        nextPath =
          profile?.approval_status === "rejected"
            ? "/pending?status=rejected"
            : "/pending";
      } else if (profile.role === "admin") {
        nextPath = "/admin/users";
        try {
          sessionStorage.setItem("smm_approval_ok", "1");
        } catch {
          // ignore
        }
      } else {
        try {
          sessionStorage.setItem("smm_approval_ok", "1");
        } catch {
          // ignore
        }
      }
    }

    setLoading(false);
    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
      <h1 className="mb-2 text-headline-md text-[#173A67]">Đăng nhập</h1>
      <p className="mb-6 text-body-md text-on-surface-variant">
        Đoàn viên Si Mê Mít Tươi đăng nhập để xem điểm và hạng.
      </p>

      <form className="space-y-4" onSubmit={handleLogin}>
        <div>
          <label
            className="mb-1 block text-label-md text-on-surface"
            htmlFor="email"
          >
            Email
          </label>
          <input
            required
            autoComplete="email"
            className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 outline-none focus:border-[#173A67]"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label
            className="mb-1 block text-label-md text-on-surface"
            htmlFor="password"
          >
            Mật khẩu
          </label>
          <input
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 outline-none focus:border-[#173A67]"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Chưa có tài khoản?{" "}
        <Link className="font-bold text-[#173A67] hover:underline" href="/register">
          Đăng ký bằng mã nhân viên
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-on-surface-variant">
        <Link className="text-[#173A67] hover:underline" href="/">
          ← Về trang chủ
        </Link>
      </p>
    </div>
  );
}
