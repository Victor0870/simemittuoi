"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const { refreshProfile } = useAuth();
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">("checking");

  useEffect(() => {
    let active = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setState(data.user ? "ready" : "invalid");
      })
      .catch(() => active && setState("invalid"));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm sm:p-8">
      <h1 className="mb-2 text-headline-md text-[#173A67]">Đặt mật khẩu mới</h1>

      {state === "checking" ? (
        <p className="text-body-md text-on-surface-variant">Đang kiểm tra link...</p>
      ) : state === "invalid" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <MaterialIcon className="mt-0.5 text-[20px] text-amber-600" name="link_off" />
            <p>
              Link đặt lại mật khẩu đã hết hạn, đã được dùng, hoặc được mở trên trình duyệt khác với trình duyệt đã gửi
              yêu cầu. Vui lòng gửi lại yêu cầu và mở link ngay trên điện thoại/máy tính đó.
            </p>
          </div>
          <Link
            className="block w-full rounded-xl bg-tertiary px-4 py-3 text-center font-bold text-on-tertiary transition-shadow hover:shadow-md"
            href="/forgot-password"
          >
            Gửi lại yêu cầu
          </Link>
        </div>
      ) : state === "done" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            <MaterialIcon className="mt-0.5 text-[20px] text-emerald-600" name="check_circle" />
            <p>Đã đặt mật khẩu mới. Lần sau hãy đăng nhập bằng mật khẩu này.</p>
          </div>
          <button
            className="w-full rounded-xl bg-tertiary px-4 py-3 font-bold text-on-tertiary transition-shadow hover:shadow-md"
            type="button"
            onClick={() => window.location.assign("/")}
          >
            Vào trang chủ
          </button>
        </div>
      ) : (
        <>
          <p className="mb-6 text-body-md text-on-surface-variant">Nhập mật khẩu mới cho tài khoản của bạn.</p>
          <ChangePasswordForm
            requireCurrent={false}
            submitLabel="Lưu mật khẩu mới"
            onSuccess={() => {
              setState("done");
              void refreshProfile();
            }}
          />
        </>
      )}
    </div>
  );
}
