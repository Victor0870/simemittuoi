import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import {
  normalizeRewardMoney,
  type PollRewardRow,
  type RewardItem,
  type RewardKind,
} from "@/lib/polls/reward-money";

const normalizeCode = (value: unknown) => String(value ?? "").trim().toUpperCase();

function prizeKind(rank: number | null, consolationCount: number): RewardKind | null {
  if (!rank) return null;
  if (rank === 1) return "first";
  if (rank === 2) return "second";
  if (rank === 3) return "third";
  if (rank <= 3 + consolationCount) return "consolation";
  return null;
}

const PRIZE_LABEL: Partial<Record<RewardKind, string>> = {
  first: "Giải Nhất",
  second: "Giải Nhì",
  third: "Giải Ba",
  consolation: "Giải Khuyến khích",
};

async function guard() {
  const { access, response } = await requirePermission(PERMISSIONS.pollsManage);
  if (response) return { access: null, response };
  if (!hasPermission(access, PERMISSIONS.membersView)) {
    return {
      access: null,
      response: NextResponse.json(
        { error: "Cần thêm quyền \"Hồ sơ đoàn viên: Xem hồ sơ\" để xuất số tài khoản ngân hàng." },
        { status: 403 },
      ),
    };
  }
  return { access, response: null };
}

/** Danh sách nhận thưởng (thành viên dự thi + người dự đoán chính xác nhất) kèm STK để làm phiếu chi. */
export async function GET(request: NextRequest) {
  try {
    const { access, response } = await guard();
    if (response) return response;

    const pollId = request.nextUrl.searchParams.get("pollId");
    if (!pollId) {
      return NextResponse.json({ error: "Thiếu ID chương trình." }, { status: 400 });
    }

    const db = createServiceClient();
    const { data: poll, error: pollError } = await db
      .from(CDILV_TABLE.polls)
      .select("id, title, status, consolation_prize_count, winning_predictor_info, reward_money")
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

    type Person = { code: string; name: string; userId: string | null; items: RewardItem[]; sort: number };
    const people = new Map<string, Person>();
    const personFor = (key: string, init: Omit<Person, "items">) => {
      const existing = people.get(key);
      if (existing) {
        existing.userId ||= init.userId;
        existing.sort = Math.min(existing.sort, init.sort);
        return existing;
      }
      const created = { ...init, items: [] };
      people.set(key, created);
      return created;
    };

    for (const m of members ?? []) {
      const option = optionById.get(m.option_id);
      const code = normalizeCode(m.employee_code);
      if (!option || !code) continue;
      const kind = prizeKind(option.final_rank, consolationCount);
      const person = personFor(code, {
        code,
        name: m.full_name ?? "",
        userId: m.user_id ?? null,
        sort: (option.final_rank ?? 999) * 1000 + (option.order_num ?? 999),
      });
      if (kind) person.items.push({ kind, label: `${PRIZE_LABEL[kind]} – ${option.title}` });
      person.items.push({ kind: "entry", label: kind ? "Tham gia dự thi" : `Tham gia dự thi – ${option.title}` });
    }

    const predictor = poll.winning_predictor_info as {
      fullName?: string;
      contactInfo?: string;
      userId?: string | null;
    } | null;
    if (predictor) {
      const predictorUserId = predictor.userId ?? null;
      let code = normalizeCode(predictor.contactInfo?.replace(/^Mã NV:\s*/i, ""));
      if (!code && predictorUserId) {
        const { data: profile } = await db
          .from(CDILV_TABLE.profiles)
          .select("employee_code")
          .eq("id", predictorUserId)
          .maybeSingle();
        code = normalizeCode(profile?.employee_code);
      }
      const person = personFor(code || `u:${predictorUserId ?? "predictor"}`, {
        code,
        name: (predictor.fullName ?? "").replace(/\s*\([^)]*\)\s*$/, ""),
        userId: predictorUserId,
        sort: 999_999_999,
      });
      person.items.push({ kind: "predictor", label: "Dự đoán chính xác nhất" });
    }

    const list = [...people.values()];
    const codes = [...new Set(list.map((p) => p.code).filter(Boolean))];
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

    const resolveUserId = (p: Person) => p.userId || userIdByCode.get(p.code) || null;
    const userIds = [...new Set(list.map(resolveUserId).filter((id): id is string => Boolean(id)))];
    const bankByUser = new Map<string, { bank_account_no: string | null; bank_name: string | null }>();
    if (userIds.length > 0) {
      const { data: details, error: detailsError } = await db
        .from(CDILV_TABLE.memberDetails)
        .select("user_id, bank_account_no, bank_name")
        .in("user_id", userIds);
      if (detailsError) throw detailsError;
      for (const d of details ?? []) bankByUser.set(d.user_id, d);
    }

    list.sort((a, b) => a.sort - b.sort);
    const rows: PollRewardRow[] = list.map((p) => {
      const bank = bankByUser.get(resolveUserId(p) ?? "");
      return {
        employeeCode: p.code,
        fullName: nameByCode.get(p.code) || p.name,
        bankAccountNo: bank?.bank_account_no?.trim() ?? "",
        bankName: bank?.bank_name?.trim() ?? "",
        items: p.items,
      };
    });

    const { error: logError } = await db.from(CDILV_TABLE.sensitiveAccessLogs).insert({
      actor_id: access!.userId,
      action: "poll_rewards_export",
      target_count: rows.length,
      target_ids: userIds,
      reason: `Xuất danh sách nhận thưởng: ${poll.title}`,
      detail: { pollId },
    });
    if (logError) throw logError;

    return NextResponse.json({ pollTitle: poll.title, money: normalizeRewardMoney(poll.reward_money), rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không xuất được danh sách nhận thưởng.";
    console.error("[api/polls/rewards-export] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}