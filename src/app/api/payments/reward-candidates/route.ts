import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadRewardCandidates } from "@/lib/payments/server";
import { rowTotal } from "@/lib/polls/reward-money";
import { loadPollRewardList } from "@/lib/polls/rewards-server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Danh sách thưởng để lập đề nghị thanh toán.
 * Không có ?poll: các chương trình bình chọn đã kết thúc (?except=<id đề nghị đang sửa>).
 * Có ?poll=<id>: tổng tiền, số người, số người chưa có số tài khoản của danh sách thưởng đó.
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.paymentsCreate);
    if (guard.response) return guard.response;
    if (!hasPermission(guard.access, PERMISSIONS.rewardsPayout)) {
      return NextResponse.json({ error: "Bạn không có quyền xem danh sách thưởng." }, { status: 403 });
    }
    const db = createServiceClient();
    const params = request.nextUrl.searchParams;
    const pollId = params.get("poll");
    if (!pollId) {
      const candidates = await loadRewardCandidates(db, params.get("except") ?? undefined);
      return NextResponse.json({ candidates });
    }
    if (!/^[0-9a-f-]{36}$/i.test(pollId)) {
      return NextResponse.json({ error: "Chương trình không hợp lệ." }, { status: 400 });
    }
    const list = await loadPollRewardList(db, pollId, guard.access.userId);
    if (!list) return NextResponse.json({ error: "Chương trình chưa kết thúc hoặc không còn tồn tại." }, { status: 404 });
    const totals = list.rows.map((r) => rowTotal(r.items, list.money));
    return NextResponse.json({
      summary: {
        pollId: list.pollId,
        title: list.pollTitle,
        people: totals.filter((t) => t > 0).length,
        total: totals.reduce((sum, t) => sum + t, 0),
        missingBank: list.rows.filter((r, i) => totals[i] > 0 && !r.bankAccountNo).length,
      },
    });
  } catch (err: unknown) {
    console.error("[api/payments/reward-candidates] error:", err);
    return NextResponse.json({ error: "Không tải được danh sách thưởng." }, { status: 500 });
  }
}
