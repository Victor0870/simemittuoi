"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { normalizeEmail, translateAuthError } from "@/lib/auth-errors";
import { CHANGE_PASSWORD_PATH, mustChangePassword } from "@/lib/auth/password";
import { BRAND } from "@/lib/brand";
import { createClient } from "@/lib/supabase/client";
import { CDILV_RPC } from "@/lib/supabase/tables";
import { parseAccess } from "@/lib/auth/permissions";

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
    try {
      const normalizedEmail = normalizeEmail(email);
      let { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      // Bàn phím điện thoại hay tự chèn dấu cách vào cuối (gợi ý từ / dán)
      const trimmedPassword = password.trim();
      if (signInError?.code === "invalid_credentials" && trimmedPassword && trimmedPassword !== password) {
        ({ data, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: trimmedPassword,
        }));
      }

      if (signInError) {
        setError(translateAuthError(signInError));
        return;
      }

      const userId = data.user?.id;
      let nextPath = "/";

      if (mustChangePassword(data.user?.app_metadata)) {
        nextPath = CHANGE_PASSWORD_PATH;
      } else if (userId) {
        try {
          const { data: rawAccess, error: accessError } = await supabase.rpc(
            CDILV_RPC.myPermissions,
          );

          if (accessError || !rawAccess) {
            // on error go to home
            nextPath = "/";
          } else {
            const access = parseAccess(rawAccess);
            if (!access.isApproved) {
              nextPath = "/pending";
            } else {
              nextPath = "/";
              try {
                sessionStorage.setItem("smm_approval_ok", "1");
              } catch {
                // ignore
              }
            }
          }
        } catch {
          // on error go to home
          nextPath = "/";
        }
      }

      router.push(nextPath);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
      <h1 className="mb-2 text-headline-md text-[#173A67]">Đăng nhập</h1>
      <p className="mb-6 text-body-md text-on-surface-variant">
        Đoàn viên {BRAND.name} đăng nhập để xem điểm và hạng.
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
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 outline-none focus:border-[#173A67]"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-label-md text-on-surface" htmlFor="password">
              Mật khẩu
            </label>
            <Link className="text-sm font-semibold text-[#173A67] hover:underline" href="/forgot-password">
              Quên mật khẩu?
            </Link>
          </div>
          <PasswordInput
            autoComplete="current-password"
            id="password"
            value={password}
            onChange={setPassword}
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
