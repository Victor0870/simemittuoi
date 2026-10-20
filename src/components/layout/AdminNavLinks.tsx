"use client";

import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";

type Props = {
  activeHref?: string;
};

export function AdminNavLinks({ activeHref = "/" }: Props) {
  const { isAdmin } = useAuth();

  if (!isAdmin) return null;

  const isScoresActive = activeHref.startsWith("/admin/scores");
  const isUsersActive = activeHref.startsWith("/admin/users");
  const isPollsActive = activeHref.startsWith("/admin/polls");
  const isEmployeesActive = activeHref.startsWith("/admin/employees");
  const isQuizActive = activeHref.startsWith("/admin/quiz");
  const isPopupsActive = activeHref.startsWith("/admin/popups");

  return (
    <div className="flex items-center gap-2 border-l border-outline-variant/60 pl-3">
      <Link
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-label-md font-bold transition-all ${
          isScoresActive
            ? "bg-amber-500 text-white shadow-xs"
            : "bg-amber-50 text-amber-900 border border-amber-300/80 hover:bg-amber-100"
        }`}
        href="/admin/scores"
        title="Quản trị: Cộng điểm đoàn viên"
      >
        <MaterialIcon className="text-[18px]" name="military_tech" />
        <span>Cộng điểm</span>
      </Link>

      <Link
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-label-md font-semibold transition-all ${
          isPollsActive
            ? "bg-primary text-white font-bold shadow-xs"
            : "text-on-surface-variant hover:bg-surface-container-high"
        }`}
        href="/admin/polls"
        title="Quản trị: Quản lý chương trình bình chọn"
      >
        <MaterialIcon className="text-[18px]" name="how_to_vote" />
        <span>Quản lý vote</span>
      </Link>

      <Link
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-label-md font-semibold transition-all ${
          isQuizActive
            ? "bg-primary text-white font-bold shadow-xs"
            : "text-on-surface-variant hover:bg-surface-container-high"
        }`}
        href="/admin/quiz"
        title="Quản trị: Ngân hàng câu hỏi & thi trắc nghiệm"
      >
        <MaterialIcon className="text-[18px]" name="quiz" />
        <span>Trắc nghiệm</span>
      </Link>

      <Link
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-label-md font-semibold transition-all ${
          isPopupsActive
            ? "bg-primary text-white font-bold shadow-xs"
            : "text-on-surface-variant hover:bg-surface-container-high"
        }`}
        href="/admin/popups"
        title="Quản trị: Popup thông báo nhanh"
      >
        <MaterialIcon className="text-[18px]" name="notification_important" />
        <span>Popup</span>
      </Link>

      <Link
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-label-md transition-all ${
          isUsersActive
            ? "bg-primary text-white font-bold shadow-xs"
            : "text-on-surface-variant hover:bg-surface-container-high"
        }`}
        href="/admin/users"
        title="Quản trị: Duyệt tài khoản đoàn viên"
      >
        <MaterialIcon className="text-[18px]" name="manage_accounts" />
        <span>Duyệt TV</span>
      </Link>

      <Link
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-label-md transition-all ${
          isEmployeesActive
            ? "bg-primary text-white font-bold shadow-xs"
            : "text-on-surface-variant hover:bg-surface-container-high"
        }`}
        href="/admin/employees"
        title="Quản trị: Danh sách nhân viên được phép đăng ký"
      >
        <MaterialIcon className="text-[18px]" name="badge" />
        <span>DS nhân viên</span>
      </Link>
    </div>
  );
}
