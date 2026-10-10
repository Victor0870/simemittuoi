"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export function AdminLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    const confirmed = window.confirm("Bạn có chắc chắn muốn đăng xuất?");
    if (!confirmed) return;

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
    <button
      onClick={() => void handleLogout()}
      disabled={loading}
      type="button"
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 text-label-md font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
    >
      <MaterialIcon className="text-[20px]" name="logout" />
      <span>{loading ? "Đang đăng xuất..." : "Đăng xuất tài khoản"}</span>
    </button>
  );
}
