import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export type PollRewardRow = {
  employeeCode: string;
  fullName: string;
  bankAccountNo: string;
  bankName: string;
  reward: string;
};

const normalizeCode = (value: unknown) => String(value ?? "").trim().toUpperCase();

function prizeName(rank: number | null, consolationCount: number): string | null {
  if (!rank) return null;
  if (rank === 1) return "Giải Nhất";
  if (rank === 2) return "Giải Nhì";
  if (rank === 3) return "Giải Ba";
  if (rank <= 3 + consolationCount) return "Giải Khuyến khích";
  return null;
}

/** Danh sách nhận thưởng (thành viên dự thi + người dự đoán chính xác nhất) kèm STK để làm phiếu chi. */
export async function GET(request: NextRequest) {
  try {
    const { access, response } = await requirePermission(PERMISSIONS.pollsManage);
    if (response) return response;
    if (!hasPermission(access, PERMISSIONS.membersView)) {
      return NextResponse.json(
        { error: "Cần thêm quyền \"Hồ sơ đoàn viên: Xem hồ sơ\" để xuất số tài khoản ngân hàng." },
        { status: 403 },
      );
    }

    const pollId = request.nextUrl.searchParams.get("pollId");
    if (!pollId) {
      return NextResponse.json({ error: "Thiếu ID chương trình." }, { status: 400 });
    }

    const db = createServiceClient();
    const { data: poll, error: pollError } = await db
      .from(CDILV_TABLE.polls)
      .select("id, title, status, consolation_prize_count, winning_predictor_info")
      .eq("id", pollId)
      .maybeSingle();
    if (pollError) throw pollError;
    if (!poll) {
      return NextResponse.json({ error: "Không tìm thấy chương trình." }, { status: 404 });
    }
    if (poll.status !== "closed") {
      return NextResponse.json(
        { error: "Chương trình chưa kết thúc. Bấm \"Đóng & Trao giải\" trước khi xuất danh sách nhận thưởng." },
        { status: 400 },
      );
    }

    const { data: options, error: optionsError } = await db
      .from(CDILV_TABLE.pollOptions)
      .select("id, title, order_num, final_rank")
      .eq("poll_id", pollId);
    if (optionsError) throw optionsError;

    const optionIds = (options ?? []).map((o) => o.id);
    const { data: members, error: membersError } = optionIds.length
      ? await db
          .from(CDILV_TABLE.pollOptionMembers)
          .select("option_id, employee_code, full_name, user_id")
          .in("option_id", optionIds)
      : { data: [], error: null };
    if (membersError) throw membersError;

    const consolationCount = poll.consolation_prize_count ?? 2;
    const optionById = new Map((options ?? []).map((o) => [o.id, o]));

    type Entry = { code: string; name: string; userId: string | null; reward: string; sort: [number, number, number] };
    const entries: Entry[] = [];
    const seen = new Set<string>();
    for (const m of members ?? []) {
      const option = optionById.get(m.option_id);
      const code = normalizeCode(m.employee_code);
      if (!option || !code || seen.has(`${option.id}:${code}`)) continue;
      seen.add(`${option.id}:${code}`);
      const prize = prizeName(option.final_rank, consolationCount);
      entries.push({
        code,
        name: m.full_name ?? "",
        userId: m.user_id ?? null,
        reward: `${prize ?? "Tham gia dự thi"} – ${option.title}`,
        sort: [0, option.final_rank ?? 999, option.order_num ?? 999],
      });
    }

    const predictor = poll.winning_predictor_info as {
      fullName?: string;
      contactInfo?: string;
      userId?: string | null;
    } | null;
    let predictorUserId: string | null = null;
    if (predictor) {
      predictorUserId = predictor.userId ?? null;
      let code = normalizeCode(predictor.contactInfo?.replace(/^Mã NV:\s*/i, ""));
      if (!code && predictorUserId) {
        const { data: profile } = await db
          .from(CDILV_TABLE.profiles)
          .select("employee_code")
          .eq("id", predictorUserId)
          .maybeSingle();
        code = normalizeCode(profile?.employee_code);
      }
      entries.push({
        code,
        name: (predictor.fullName ?? "").replace(/\s*\([^)]*\)\s*$/, ""),
        userId: predictorUserId,
        reward: "Dự đoán chính xác nhất",
        sort: [1, 0, 0],
      });
    }

    const codes = [...new Set(entries.map((e) => e.code).filter(Boolean))];
    const userIdByCode = new Map<string, string>();
    const nameByCode = new Map<string, string>();
    if (codes.length > 0) {
      const [{ data: profiles }, { data: whitelist }] = await Promise.all([
        db
          .from(CDILV_TABLE.profiles)
          .select("id, employee_code, approval_status")
          .in("employee_code", codes),
        db.from(CDILV_TABLE.employeeWhitelist).select("employee_code, full_name").in("employee_code", codes),
      ]);
      for (const p of profiles ?? []) {
        if (p.approval_status === "approved") userIdByCode.set(normalizeCode(p.employee_code), p.id);
      }
      for (const w of whitelist ?? []) {
        if (w.full_name) nameByCode.set(normalizeCode(w.employee_code), w.full_name);
      }
    }

    const resolveUserId = (e: Entry) => e.userId || userIdByCode.get(e.code) || null;
    const userIds = [...new Set(entries.map(resolveUserId).filter((id): id is string => Boolean(id)))];
    const bankByUser = new Map<string, { bank_account_no: string | null; bank_name: string | null }>();
    if (userIds.length > 0) {
      const { data: details, error: detailsError } = await db
        .from(CDILV_TABLE.memberDetails)
        .select("user_id, bank_account_no, bank_name")
        .in("user_id", userIds);
      if (detailsError) throw detailsError;
      for (const d of details ?? []) bankByUser.set(d.user_id, d);
    }

    entries.sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1] || a.sort[2] - b.sort[2]);
    const rows: PollRewardRow[] = entries.map((e) => {
      const bank = bankByUser.get(resolveUserId(e) ?? "");
      return {
        employeeCode: e.code,
        fullName: nameByCode.get(e.code) || e.name,
        bankAccountNo: bank?.bank_account_no?.trim() ?? "",
        bankName: bank?.bank_name?.trim() ?? "",
        reward: e.reward,
      };
    });

    const { error: logError } = await db.from(CDILV_TABLE.sensitiveAccessLogs).insert({
      actor_id: access.userId,
      action: "poll_rewards_export",
      target_count: rows.length,
      target_ids: userIds,
      reason: `Xuất danh sách nhận thưởng: ${poll.title}`,
      detail: { pollId },
    });
    if (logError) throw logError;

    return NextResponse.json({ pollTitle: poll.title, rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không xuất được danh sách nhận thưởng.";
    console.error("[api/polls/rewards-export] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
