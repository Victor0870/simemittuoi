"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function PendingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rejected = searchParams.get("status") === "rejected";
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      sessionStorage.removeItem("smm_approval_ok");
    } catch {
      // ignore
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-[#A8DDD1]/50 bg-[#D9F2EC] p-8 shadow-sm">
      <h1 className="mb-3 text-headline-md text-[#173A67]">
        {rejected ? "Tài khoản bị từ chối" : "Đang chờ phê duyệt"}
      </h1>
      <p className="mb-6 text-body-md text-[#27496D]">
        {rejected
          ? "Admin đã từ chối yêu cầu đăng ký của bạn. Vui lòng liên hệ bộ phận công đoàn / IT để được hỗ trợ."
          : "Đăng ký thành công. Admin sẽ kiểm tra mã nhân viên và phê duyệt trước khi bạn vào được hệ thống điểm và bảng xếp hạng."}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-xl bg-tertiary px-4 py-3 font-bold text-on-tertiary disabled:opacity-60"
          disabled={loading}
          type="button"
          onClick={() => void handleLogout()}
        >
          Đăng xuất
        </button>
        <Link
          className="rounded-xl border-2 border-[#173A67] px-4 py-3 font-bold text-[#173A67]"
          href="/login"
        >
          Về trang đăng nhập
        </Link>
      </div>
    </div>
  );
}

export default function PendingPage() {
  return (
    <Suspense fallback={<p className="text-[#27496D]">Đang tải...</p>}>
      <PendingContent />
    </Suspense>
  );
}
