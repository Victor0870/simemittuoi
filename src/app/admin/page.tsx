import Link from "next/link";
import { redirect } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: me } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("id, role, approval_status, full_name, employee_code, department, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }

  // Fetch quick metrics for admin dashboard
  const [
    { count: pendingUsersCount },
    { count: totalUsersCount },
    { count: totalPollsCount },
    { count: activePollsCount },
    { count: totalActivitiesCount },
    { count: openActivitiesCount },
    { count: pendingFeedbackCount },
    { count: activeWhitelistCount },
    { count: quizQuestionsCount },
    { count: activePopupsCount },
  ] = await Promise.all([
    supabase
      .from(CDILV_TABLE.profiles)
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "pending"),
    supabase
      .from(CDILV_TABLE.profiles)
      .select("id", { count: "exact", head: true }),
    supabase
      .from(CDILV_TABLE.polls)
      .select("id", { count: "exact", head: true }),
    supabase
      .from(CDILV_TABLE.polls)
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("status", "open"),
    supabase
      .from(CDILV_TABLE.activities)
      .select("id", { count: "exact", head: true }),
    supabase
      .from(CDILV_TABLE.activities)
      .select("id", { count: "exact", head: true })
      .eq("is_registration_open", true),
    supabase
      .from(CDILV_TABLE.feedbacks)
      .select("id", { count: "exact", head: true })
      .is("admin_reply", null),
    supabase
      .from(CDILV_TABLE.employeeWhitelist)
      .select("employee_code", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from(CDILV_TABLE.quizQuestions)
      .select("id", { count: "exact", head: true }),
    createServiceClient()
      .from(CDILV_TABLE.popups)
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`),
  ]);

  const initial = (me.full_name || user.email || "A").slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-6 sm:space-y-8 pb-10">
      {/* Admin Profile Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-dusty-border/80 bg-gradient-to-br from-[#173A67] via-[#1E4A7D] to-[#27496D] p-5 sm:p-7 text-white shadow-md">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/30 bg-white/10 text-xl sm:text-2xl font-bold shadow-inner">
              {me.avatar_url ? (
                <img
                  src={me.avatar_url}
                  alt={me.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight">
                  {me.full_name || "Quản trị viên"}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-400/20 px-2.5 py-0.5 text-label-xs font-bold text-amber-200 backdrop-blur-xs">
                  <MaterialIcon className="text-[14px] text-amber-300" name="shield" />
                  Admin
                </span>
              </div>

              <p className="text-xs sm:text-body-sm text-white/80">
                {me.department || "Ban Chấp hành Công đoàn"}
                {me.employee_code ? ` · MSNV: ${me.employee_code}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href="/settings"
              className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-label-sm font-semibold text-white transition hover:bg-white/20"
            >
              <MaterialIcon className="text-[16px]" name="manage_accounts" />
              <span>Hồ sơ cá nhân</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
              title="Về trang chủ"
            >
              <MaterialIcon className="text-[20px]" name="home" />
            </Link>
          </div>
        </div>
      </div>

      {/* 2 MAIN MANAGEMENT MENUS */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-title-md sm:text-title-lg font-bold text-on-surface">
            <MaterialIcon className="text-[22px] text-primary" name="dashboard" />
            <span>Chức năng Quản trị</span>
          </h2>
          <span className="text-xs text-on-surface-variant font-medium">
            2 menu chính
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* MENU 1: Quản lý Vote */}
          <Link
            href="/admin/polls"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-white via-white to-primary/[0.03] p-5 sm:p-6 shadow-xs transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-sm transition-transform group-hover:scale-105">
                  <MaterialIcon className="text-[26px]" name="how_to_vote" />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(activePollsCount ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-label-xs font-bold text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {activePollsCount} đang mở
                    </span>
                  ) : null}
                  <span className="rounded-full bg-dusty-light px-2.5 py-0.5 text-label-xs font-semibold text-primary">
                    {totalPollsCount ?? 0} chương trình
                  </span>
                </div>
              </div>

              <h3 className="mt-4 text-title-lg font-extrabold text-on-surface transition-colors group-hover:text-primary">
                Quản lý vote
              </h3>

              <p className="mt-1.5 text-body-sm text-on-surface-variant leading-relaxed">
                Tạo và điều hành các chương trình bình chọn, thi ảnh (cắm hoa, thể thao...), mở/đóng bình chọn, kiểm soát giới hạn vote và tổng kết dự đoán.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-dusty-border/70 pt-3 text-label-sm font-bold text-primary">
              <span className="inline-flex items-center gap-1">
                Vào quản lý bình chọn
              </span>
              <MaterialIcon
                className="text-[18px] transition-transform group-hover:translate-x-1"
                name="arrow_forward"
              />
            </div>
          </Link>

          {/* MENU 2: Duyệt TV */}
          <Link
            href="/admin/users"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-white via-white to-primary/[0.03] p-5 sm:p-6 shadow-xs transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173A67] text-white shadow-sm transition-transform group-hover:scale-105">
                  <MaterialIcon className="text-[26px]" name="manage_accounts" />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(pendingUsersCount ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-label-xs font-bold text-red-700 animate-bounce">
                      <MaterialIcon className="text-[13px]" name="priority_high" />
                      {pendingUsersCount} chờ duyệt
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-label-xs font-bold text-emerald-800">
                      <MaterialIcon className="text-[13px]" name="check" />
                      Đã duyệt hết
                    </span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-label-xs font-semibold text-slate-700">
                    {totalUsersCount ?? 0} thành viên
                  </span>
                </div>
              </div>

              <h3 className="mt-4 text-title-lg font-extrabold text-on-surface transition-colors group-hover:text-primary">
                Duyệt TV (Thành viên)
              </h3>

              <p className="mt-1.5 text-body-sm text-on-surface-variant leading-relaxed">
                Xét duyệt tài khoản đoàn viên đăng ký mới, kiểm tra mã nhân viên, phê duyệt hoặc từ chối, phân quyền Quản trị viên và quản lý danh sách.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-dusty-border/70 pt-3 text-label-sm font-bold text-primary">
              <span className="inline-flex items-center gap-1">
                Vào danh sách duyệt thành viên
              </span>
              <MaterialIcon
                className="text-[18px] transition-transform group-hover:translate-x-1"
                name="arrow_forward"
              />
            </div>
          </Link>
        </div>
      </section>

      {/* SECTION: TÍNH NĂNG THI ĐUA */}
      <section className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-title-md sm:text-title-lg font-bold text-on-surface">
            <MaterialIcon className="text-[22px] text-amber-600" name="military_tech" />
            <span>Tính năng Thi đua</span>
          </h2>
          <span className="text-xs text-on-surface-variant font-medium">
            Điểm & Phong trào
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Card Quản lý & Cộng điểm */}
          <Link
            href="/admin/scores"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50/60 via-white to-white p-5 shadow-xs transition-all hover:border-amber-400 hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                  <MaterialIcon className="text-[22px]" name="military_tech" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100/70 px-2.5 py-0.5 text-label-xs font-bold text-amber-900">
                  Cộng / Trừ điểm
                </span>
              </div>

              <h3 className="mt-3.5 text-title-md font-bold text-on-surface transition-colors group-hover:text-amber-800">
                Quản lý & Cộng điểm thi đua
              </h3>

              <p className="mt-1 text-body-sm text-on-surface-variant leading-relaxed">
                Cộng điểm cho đoàn viên theo hoạt động, nhập danh sách theo file hoặc mã nhân viên, cập nhật bảng xếp hạng thi đua.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-amber-200/60 pt-3 text-label-sm font-bold text-amber-800">
              <span>Vào trang cộng điểm</span>
              <MaterialIcon
                className="text-[18px] transition-transform group-hover:translate-x-1"
                name="arrow_forward"
              />
            </div>
          </Link>

          {/* Card Quản lý Hoạt động */}
          <Link
            href="/admin/activities"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.04] via-white to-white p-5 shadow-xs transition-all hover:border-primary hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
                  <MaterialIcon className="text-[22px]" name="event_available" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-label-xs font-bold text-emerald-800">
                    {openActivitiesCount ?? 0} đang mở
                  </span>
                  <span className="rounded-full bg-dusty-light px-2 py-0.5 text-label-xs font-semibold text-primary">
                    {totalActivitiesCount ?? 0} hoạt động
                  </span>
                </div>
              </div>

              <h3 className="mt-3.5 text-title-md font-bold text-on-surface transition-colors group-hover:text-primary">
                Quản lý Hoạt động & Phong trào
              </h3>

              <p className="mt-1 text-body-sm text-on-surface-variant leading-relaxed">
                Tạo hoạt động mới, phát động phong trào, cập nhật thời gian & địa điểm, dừng hoặc mở nhận đăng ký và theo dõi danh sách đoàn viên.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-dusty-border/60 pt-3 text-label-sm font-bold text-primary">
              <span>Vào quản lý hoạt động</span>
              <MaterialIcon
                className="text-[18px] transition-transform group-hover:translate-x-1"
                name="arrow_forward"
              />
            </div>
          </Link>

          {/* Card Thi trắc nghiệm */}
          <Link
            href="/admin/quiz"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50/60 via-white to-white p-5 shadow-xs transition-all hover:border-emerald-400 hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <MaterialIcon className="text-[22px]" name="quiz" />
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-label-xs font-bold text-emerald-800 border border-emerald-300">
                  {quizQuestionsCount ?? 0} câu hỏi
                </span>
              </div>

              <h3 className="mt-3.5 text-title-md font-bold text-on-surface transition-colors group-hover:text-emerald-800">
                Thi trắc nghiệm hàng tuần
              </h3>

              <p className="mt-1 text-body-sm text-on-surface-variant leading-relaxed">
                Quản lý ngân hàng câu hỏi (thêm, sửa, xóa, nhập Excel), bật/tắt hoặc hẹn giờ tự động, tổng kết cộng điểm và đăng bài kết quả.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-emerald-200/60 pt-3 text-label-sm font-bold text-emerald-800">
              <span>Vào quản lý trắc nghiệm</span>
              <MaterialIcon
                className="text-[18px] transition-transform group-hover:translate-x-1"
                name="arrow_forward"
              />
            </div>
          </Link>

          {/* Card Hòm thư Góp ý */}
          <Link
            href="/feedback"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-blue-300/80 bg-gradient-to-br from-blue-50/60 via-white to-white p-5 shadow-xs transition-all hover:border-blue-400 hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#173A67] text-white shadow-xs">
                  <MaterialIcon className="text-[22px]" name="rate_review" />
                </div>
                <div className="flex items-center gap-1.5">
                  {(pendingFeedbackCount ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-label-xs font-bold text-amber-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      {pendingFeedbackCount} chờ phản hồi
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-label-xs font-bold text-emerald-800">
                      ✓ Đã xử lý hết
                    </span>
                  )}
                </div>
              </div>

              <h3 className="mt-3.5 text-title-md font-bold text-on-surface transition-colors group-hover:text-primary">
                Hòm thư Góp ý & Nguyện vọng
              </h3>

              <p className="mt-1 text-body-sm text-on-surface-variant leading-relaxed">
                Tiếp nhận tâm tư, ý kiến đóng góp và sáng kiến của đoàn viên. Chủ tịch và Ban Chấp hành trực tiếp phản hồi giải quyết.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-blue-200/60 pt-3 text-label-sm font-bold text-primary">
              <span>Vào xem và phản hồi</span>
              <MaterialIcon
                className="text-[18px] transition-transform group-hover:translate-x-1"
                name="arrow_forward"
              />
            </div>
          </Link>
        </div>
      </section>

      {/* SECTION: CÀI ĐẶT & THAO TÁC HỆ THỐNG */}
      <section className="space-y-3 pt-2">
        <h2 className="text-title-sm font-bold text-on-surface-variant">
          Tiện ích & Hệ thống
        </h2>

        <div className="space-y-2.5">
          <Link
            href="/admin/popups"
            className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50/60 p-4 transition hover:bg-red-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <MaterialIcon className="text-[20px]" name="notification_important" />
              </div>
              <div>
                <p className="text-label-md font-bold text-red-900">
                  Popup thông báo nhanh
                </p>
                <p className="text-xs text-red-900/80">
                  {activePopupsCount ?? 0} popup đang bật · Đăng tin gấp nội dung ngắn, hẹn giờ hiện và hết hạn
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-red-800" name="chevron_right" />
          </Link>

          <Link
            href="/admin/roles"
            className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 p-4 transition hover:bg-amber-100/70"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <MaterialIcon className="text-[20px]" name="admin_panel_settings" />
              </div>
              <div>
                <p className="text-label-md font-bold text-amber-900">
                  Phân quyền theo cấp
                </p>
                <p className="text-xs text-amber-900/80">
                  Tạo cấp (Manager, Kế toán, Ủy viên…), chọn quyền từng cấp, gán thành viên
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-amber-800" name="chevron_right" />
          </Link>

          <Link
            href="/office/members"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="contact_page" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Hồ sơ đoàn viên
                </p>
                <p className="text-xs text-on-surface-variant">
                  Tình trạng khai báo, ngày sinh, hôn nhân, thông tin con
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <Link
            href="/office/gifts/children"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="redeem" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Quà thiếu nhi
                </p>
                <p className="text-xs text-on-surface-variant">
                  Lọc con dưới 16 tuổi theo mốc ngày, in danh sách ký nhận, xuất Excel
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <Link
            href="/office/rewards"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="payments" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Thanh toán thưởng
                </p>
                <p className="text-xs text-on-surface-variant">
                  Danh sách nhận thưởng sau bình chọn: số tài khoản, số tiền, in và xuất Excel
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <Link
            href="/office/life-events"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="campaign" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Hộp tin báo
                </p>
                <p className="text-xs text-on-surface-variant">
                  Tin vui, tin ốm, khó khăn đoàn viên gửi lên: xem giấy tờ, tiếp nhận
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <Link
            href="/office/visits"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="volunteer_activism" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Đề nghị thăm hỏi
                </p>
                <p className="text-xs text-on-surface-variant">
                  Lập từ tin báo, duyệt, xác nhận đã chi, tải phiếu thăm hỏi mẫu C11-TLĐ
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <Link
            href="/office/payments"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="request_quote" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Đề nghị thanh toán
                </p>
                <p className="text-xs text-on-surface-variant">
                  Gom phiếu thăm hỏi đã duyệt, duyệt, xác nhận đã chi, tải giấy đề nghị theo mẫu công ty
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <Link
            href="/office/finance"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="account_balance_wallet" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Sổ quỹ công đoàn
                </p>
                <p className="text-xs text-on-surface-variant">
                  Số dư quỹ tiền mặt / ngân hàng, phiếu thu – chi, chuyển quỹ, khóa sổ, xuất Excel
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <Link
            href="/office/reports"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="monitoring" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Báo cáo tổng hợp
                </p>
                <p className="text-xs text-on-surface-variant">
                  Thu – chi theo danh mục, số dư quỹ, thăm hỏi, đề nghị thanh toán theo tháng / quý / năm
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <Link
            href="/office/print-settings"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="print" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Cài đặt biểu mẫu in
                </p>
                <p className="text-xs text-on-surface-variant">
                  Tên đơn vị, người ký trên phiếu, mức chi thăm hỏi mặc định
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <Link
            href="/albums"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="photo_library" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Quản lý Album ảnh
                </p>
                <p className="text-xs text-on-surface-variant">
                  Tạo album, cài đặt quyền đăng ảnh, giới hạn số ảnh và điểm thưởng
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <Link
            href="/admin/employees"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="badge" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Danh sách nhân viên được phép đăng ký
                </p>
                <p className="text-xs text-on-surface-variant">
                  {activeWhitelistCount ?? 0} mã đang hoạt động · Thêm nhân viên mới, sửa thông tin, ngừng cấp quyền
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <Link
            href="/settings"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="person" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Cài đặt tài khoản & Avatar cá nhân
                </p>
                <p className="text-xs text-on-surface-variant">
                  Cập nhật ảnh đại diện và thông tin cá nhân của bạn
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <Link
            href="/"
            className="flex items-center justify-between rounded-2xl border border-dusty-border/80 bg-white p-4 transition hover:bg-dusty-light/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusty-light text-primary">
                <MaterialIcon className="text-[20px]" name="home" />
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface">
                  Về Trang chủ CDILV
                </p>
                <p className="text-xs text-on-surface-variant">
                  Xem tin tức, bảng xếp hạng và các bài viết mới
                </p>
              </div>
            </div>
            <MaterialIcon className="text-[18px] text-on-surface-variant" name="chevron_right" />
          </Link>

          <AdminLogoutButton />
        </div>
      </section>
    </div>
  );
}
