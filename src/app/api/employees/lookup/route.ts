import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = (searchParams.get("code") || "").trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ found: false, message: "Mã nhân viên trống." });
    }

    const publicDb = createServiceClient();

    // 1. Tìm trong bảng hồ sơ (profiles)
    const { data: profile } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("id, full_name, employee_code, department")
      .ilike("employee_code", code)
      .maybeSingle();

    if (profile) {
      return NextResponse.json({
        found: true,
        employeeCode: profile.employee_code,
        fullName: profile.full_name || "",
        department: profile.department || "",
        userId: profile.id,
      });
    }

    // 2. Nếu chưa đăng ký tài khoản, tìm trong danh sách nhân viên công ty (whitelist)
    const { data: emp } = await publicDb
      .from(CDILV_TABLE.employeeWhitelist)
      .select("employee_code, full_name, department")
      .ilike("employee_code", code)
      .maybeSingle();

    if (emp) {
      return NextResponse.json({
        found: true,
        employeeCode: emp.employee_code,
        fullName: emp.full_name || "",
        department: emp.department || "",
      });
    }

    return NextResponse.json({
      found: false,
      employeeCode: code,
      message: "Không tìm thấy thông tin nhân viên với mã số này.",
    });
  } catch (err: any) {
    console.error("[api/employees/lookup] error:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi tra cứu thông tin nhân viên." },
      { status: 500 },
    );
  }
}
