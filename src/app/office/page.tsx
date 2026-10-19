import Link from "next/link";
import { redirect } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { OFFICE_TOOLS, hasPermission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OfficePage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/office");

  const tools = OFFICE_TOOLS.filter((tool) => hasPermission(access, tool.permission));
  const roleNames = access.isAdmin
    ? ["Quản trị viên"]
    : access.roles.map((r) => r.name);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <div className="rounded-3xl bg-gradient-to-br from-[#173A67] via-[#1E4A7D] to-[#27496D] p-5 text-white shadow-md sm:p-7">
        <h1 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
          <MaterialIcon className="text-[28px]" name="work" />
          Khu vực quản lý
        </h1>
        <p className="mt-1 text-sm text-white/80">
          {roleNames.length > 0
            ? `Cấp của bạn: ${roleNames.join(", ")}`
            : "Bạn chưa được gán cấp quản lý nào."}
        </p>
      </div>

      {tools.length === 0 && !access.isAdmin ? (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-center text-on-surface-variant">
          Bạn chưa được phân quyền sử dụng công cụ quản lý nào. Vui lòng liên hệ Quản trị viên.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {access.isAdmin ? (
            <Link
              className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 transition hover:shadow-md"
              href="/admin/roles"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <MaterialIcon className="text-[22px]" name="admin_panel_settings" />
              </div>
              <div>
                <p className="font-bold text-amber-900">Phân quyền theo cấp</p>
                <p className="text-xs text-amber-900/80">
                  Tạo cấp, chọn quyền cho từng cấp và gán thành viên.
                </p>
              </div>
            </Link>
          ) : null}
          {tools.map((tool) => (
            <Link
              key={tool.href}
              className="flex items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 transition hover:border-[#173A67] hover:shadow-md"
              href={tool.href}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D9F2EC] text-[#173A67]">
                <MaterialIcon className="text-[22px]" name={tool.icon} />
              </div>
              <div>
                <p className="font-bold text-[#173A67]">{tool.title}</p>
                <p className="text-xs text-on-surface-variant">{tool.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
