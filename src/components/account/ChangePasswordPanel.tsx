"use client";

import Link from "next/link";
import { useState } from "react";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export function ChangePasswordPanel({ required }: { required: boolean }) {
  const [done, setDone] = useState(false);

  return (
    <div className="space-y-4 pb-6 sm:space-y-5 sm:pb-10">
      <div>
        {!required ? (
          <Link className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-[#173A67]" href="/settings">
            <MaterialIcon className="text-[18px]" name="arrow_back" />
            Thông tin tài khoản
          </Link>
        ) : null}
        <h1 className="text-xl font-extrabold text-[#173A67] sm:text-headline-md">Đổi mật khẩu</h1>
      </div>

      {required && !done ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <MaterialIcon className="mt-0.5 text-[20px] text-amber-600" name="lock_reset" />
          <p>
            Bạn đang dùng <strong>mật khẩu tạm</strong> do Ban chấp hành cấp. Vui lòng đặt mật khẩu mới của riêng bạn để
            tiếp tục sử dụng website.
          </p>
        </div>
      ) : null}

      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
        {done ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
              <MaterialIcon className="mt-0.5 text-[20px] text-emerald-600" name="check_circle" />
              <p>Đã đổi mật khẩu. Lần sau hãy đăng nhập bằng mật khẩu mới.</p>
            </div>
            {required ? (
              <button
                className="w-full rounded-xl bg-tertiary px-4 py-3 font-bold text-on-tertiary transition-shadow hover:shadow-md"
                type="button"
                onClick={() => window.location.assign("/")}
              >
                Vào trang chủ
              </button>
            ) : null}
          </div>
        ) : (
          <div className="max-w-md">
            <ChangePasswordForm requireCurrent={!required} onSuccess={() => setDone(true)} />
          </div>
        )}
      </section>
    </div>
  );
}
