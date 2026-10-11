import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Kiểm tra xác thực: Chỉ thành viên đã đăng ký tài khoản mới được xem
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Chỉ thành viên đã đăng ký tài khoản mới được xem lịch sử cộng điểm.",
          requireLogin: true,
        },
        { status: 401 },
      );
    }

    const publicDb = createPublicClient();

    // Kiểm tra hồ sơ người xem
    const { data: viewerProfile } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("id, role, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (!viewerProfile) {
      return NextResponse.json(
        {
          success: false,
          error: "Tài khoản của bạn chưa hoàn tất đăng ký hồ sơ đoàn viên.",
          requireLogin: true,
        },
        { status: 403 },
      );
    }

    // 2. Lấy tham số truy vấn thành viên cần xem
    const searchParams = request.nextUrl.searchParams;
    const rawId = searchParams.get("id")?.trim() || "";
    const rawCode = searchParams.get("code")?.trim() || "";
    const rawUserId = searchParams.get("userId")?.trim() || "";

    if (!rawId && !rawCode && !rawUserId) {
      return NextResponse.json(
        { success: false, error: "Thiếu thông tin nhận diện thành viên." },
        { status: 400 },
      );
    }

    let memberProfile: {
      id?: string | null;
      full_name: string;
      employee_code?: string | null;
      department?: string | null;
      avatar_url?: string | null;
      total_score?: number | null;
      rank?: number | null;
    } | null = null;

    // A. Tìm theo userId
    const targetUserId =
      rawUserId ||
      (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        rawId,
      )
        ? rawId
        : null);

    if (targetUserId) {
      const { data: p } = await publicDb
        .from(CDILV_TABLE.profiles)
        .select("id, full_name, employee_code, department, avatar_url, total_score, rank")
        .eq("id", targetUserId)
        .maybeSingle();
      if (p) memberProfile = p;
    }

    // B. Tìm theo employeeCode nếu chưa thấy profile
    const targetCode = rawCode || (!targetUserId ? rawId : null);
    if (!memberProfile && targetCode) {
      const { data: p } = await publicDb
        .from(CDILV_TABLE.profiles)
        .select("id, full_name, employee_code, department, avatar_url, total_score, rank")
        .ilike("employee_code", targetCode)
        .maybeSingle();
      if (p) memberProfile = p;
    }

    // C. Nếu thành viên chưa đăng ký tài khoản (chỉ có trong Whitelist / Leaderboard Cache)
    if (!memberProfile && targetCode) {
      const { data: cached } = await publicDb
        .from(CDILV_TABLE.leaderboardCache)
        .select("id, full_name, employee_code, department, avatar_url, total_score, rank")
        .ilike("employee_code", targetCode)
        .maybeSingle();

      if (cached) {
        memberProfile = cached;
      } else {
        const { data: w } = await publicDb
          .from(CDILV_TABLE.employeeWhitelist)
          .select("employee_code, full_name, department")
          .ilike("employee_code", targetCode)
          .maybeSingle();
        if (w) {
          memberProfile = {
            id: null,
            full_name: w.full_name,
            employee_code: w.employee_code,
            department: w.department,
            avatar_url: null,
            total_score: 0,
            rank: null,
          };
        }
      }
    }

    // D. Lấy thông tin xếp hạng từ leaderboardCache nếu chưa có rank/total_score
    if (memberProfile && (!memberProfile.rank || memberProfile.total_score == null)) {
      let cacheQuery = publicDb
        .from(CDILV_TABLE.leaderboardCache)
        .select("rank, total_score, department");

      if (memberProfile.id) {
        cacheQuery = cacheQuery.eq("id", memberProfile.id);
      } else if (memberProfile.employee_code) {
        cacheQuery = cacheQuery.ilike("employee_code", memberProfile.employee_code);
      }

      const { data: cacheRow } = await cacheQuery.maybeSingle();
      if (cacheRow) {
        if (!memberProfile.rank) memberProfile.rank = cacheRow.rank;
        if (memberProfile.total_score == null) memberProfile.total_score = cacheRow.total_score;
        if (!memberProfile.department && cacheRow.department) {
          memberProfile.department = cacheRow.department;
        }
      }
    }

    if (!memberProfile) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy thông tin thành viên." },
        { status: 404 },
      );
    }

    // 3. Lấy danh sách sự kiện cộng điểm
    const events: Array<{
      id: string;
      points: number;
      note: string | null;
      awardLabel: string | null;
      activityTitle?: string | null;
      createdAt: string;
    }> = [];

    // 3.1. Nếu thành viên đã có tài khoản: Lấy từ cdilv_score_events
    if (memberProfile.id) {
      const { data: seData } = await publicDb
        .from(CDILV_TABLE.scoreEvents)
        .select(`
          id,
          points,
          note,
          award_label,
          created_at,
          activity_id,
          cdilv_activities (
            title
          )
        `)
        .eq("user_id", memberProfile.id)
        .order("created_at", { ascending: false });

      if (seData) {
        for (const row of seData as any[]) {
          events.push({
            id: row.id,
            points: Number(row.points) || 0,
            note: row.note ?? null,
            awardLabel: row.award_label ?? null,
            activityTitle: row.cdilv_activities?.title ?? null,
            createdAt: row.created_at,
          });
        }
      }
    }

    // 3.2. Lấy các sự kiện điểm chưa transfer từ cdilv_employee_score_events (nếu có mã NV)
    const empCode = memberProfile.employee_code || targetCode;
    if (empCode) {
      let query = publicDb
        .from(CDILV_TABLE.employeeScoreEvents)
        .select("id, points, note, award_label, created_at, transferred_to")
        .ilike("employee_code", empCode);

      // Nếu đã có profile id thì chỉ lấy những bản ghi chưa transferred để tránh duplicate
      if (memberProfile.id) {
        query = query.is("transferred_to", null);
      }

      const { data: eseData } = await query.order("created_at", { ascending: false });

      if (eseData) {
        for (const row of eseData) {
          events.push({
            id: row.id,
            points: Number(row.points) || 0,
            note: row.note ?? null,
            awardLabel: row.award_label ?? null,
            createdAt: row.created_at,
          });
        }
      }
    }

    // Sắp xếp các sự kiện mới nhất lên trước
    events.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const calculatedTotal = events.reduce((sum, e) => sum + e.points, 0);
    const finalTotalScore =
      memberProfile.total_score != null && memberProfile.total_score > 0
        ? memberProfile.total_score
        : calculatedTotal;

    return NextResponse.json({
      success: true,
      member: {
        name: memberProfile.full_name,
        employeeCode: memberProfile.employee_code ?? null,
        department: memberProfile.department ?? null,
        avatarUrl: memberProfile.avatar_url ?? null,
        totalScore: finalTotalScore,
        rank: memberProfile.rank ?? null,
      },
      events,
    });
  } catch (err: any) {
    console.error("[member-history] error:", err);
    return NextResponse.json(
      { success: false, error: "Đã có lỗi xảy ra khi tải lịch sử điểm." },
      { status: 500 },
    );
  }
}
