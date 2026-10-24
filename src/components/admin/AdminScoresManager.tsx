"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { readableAwardLabel } from "@/lib/score-labels";

export type AdminProfileItem = {
  id: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
  avatar_url: string | null;
  total_score: number;
  rank: number | null;
  approval_status: string;
};

export type AdminActivityItem = {
  id: string;
  title: string;
  points: number;
  event_date: string | null;
};

export type AdminScoreEventItem = {
  id: string;
  user_id: string;
  employee_code: string | null;
  points: number;
  note: string | null;
  award_label: string | null;
  activity_id: string | null;
  created_at: string;
  created_by: string | null;
};

export type AdminWhitelistItem = {
  employee_code: string;
  full_name: string;
  department: string | null;
};

type Props = {
  currentAdminName: string;
  profiles: AdminProfileItem[];
  activities: AdminActivityItem[];
  recentEvents: AdminScoreEventItem[];
  whitelist: AdminWhitelistItem[];
  view?: AdminScoresView;
  /** Id đoàn viên chọn sẵn trên form (từ ?user= khi bấm "Cộng điểm" ở bảng điểm). */
  initialSelectedUserId?: string | null;
};

export type AdminScoresView = "form" | "history" | "members";

const VIEW_PAGES: { view: AdminScoresView; href: string; label: string; icon: string; subtitle: string }[] = [
  {
    view: "form",
    href: "/admin/scores",
    label: "Cộng điểm",
    icon: "military_tech",
    subtitle: "Cộng / trừ điểm phong trào, khen thưởng các giải thi đấu và tự động cập nhật bảng xếp hạng thi đua.",
  },
  {
    view: "history",
    href: "/admin/scores/history",
    label: "Lịch sử cộng điểm",
    icon: "history",
    subtitle: "Các lượt cộng / trừ điểm gần nhất; thu hồi lượt cộng nhầm, điểm và xếp hạng tự tính lại.",
  },
  {
    view: "members",
    href: "/admin/scores/members",
    label: "Bảng điểm đoàn viên",
    icon: "leaderboard",
    subtitle: "Điểm tích lũy và thứ hạng của từng đoàn viên; bấm “Cộng điểm” để mở form cộng điểm cho người đó.",
  },
];

const QUICK_POINTS = [
  { label: "+10đ (Tham gia / Khích lệ)", value: 10 },
  { label: "+20đ (Giải Khuyến khích)", value: 20 },
  { label: "+30đ (Giải Ba)", value: 30 },
  { label: "+40đ (Giải Nhì)", value: 40 },
  { label: "+50đ (Giải Nhất nội bộ)", value: 50 },
  { label: "+100đ (Pickleball 2026 / Sự kiện lớn)", value: 100 },
  { label: "+200đ (Vô địch / Cống hiến)", value: 200 },
];

export function AdminScoresManager({
  currentAdminName,
  profiles,
  activities,
  recentEvents,
  whitelist,
  view = "form",
  initialSelectedUserId = null,
}: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);
  const searchInputId = useId();

  // Form State
  const [selectedUser, setSelectedUser] = useState<AdminProfileItem | null>(null);
  const [selectedWhitelist, setSelectedWhitelist] = useState<AdminWhitelistItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [points, setPoints] = useState<number>(50);
  const [note, setNote] = useState<string>("");
  const [selectedActivityId, setSelectedActivityId] = useState<string>("");
  const [awardLabel, setAwardLabel] = useState<string>("");

  // Table filter state
  const [tableSearch, setTableSearch] = useState("");
  const [tableDept, setTableDept] = useState("ALL");

  // Action status
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => {
      if (p.department) set.add(p.department);
    });
    return Array.from(set).sort();
  }, [profiles]);

  // Search candidate members
  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return { matchedProfiles: [], matchedWhitelist: [] };

    const matchedProfiles = profiles.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        (p.employee_code && p.employee_code.toLowerCase().includes(q)) ||
        (p.department && p.department.toLowerCase().includes(q)),
    );

    // Whitelist entries not yet having profile
    const existingCodes = new Set(profiles.map((p) => (p.employee_code || "").toUpperCase()));
    const matchedWhitelist = whitelist.filter(
      (w) =>
        !existingCodes.has(w.employee_code.toUpperCase()) &&
        (w.full_name.toLowerCase().includes(q) ||
          w.employee_code.toLowerCase().includes(q) ||
          (w.department && w.department.toLowerCase().includes(q))),
    );

    return { matchedProfiles: matchedProfiles.slice(0, 10), matchedWhitelist: matchedWhitelist.slice(0, 5) };
  }, [searchTerm, profiles, whitelist]);

  // Filtered members list for table
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchDept = tableDept === "ALL" || p.department === tableDept;
      const q = tableSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        p.full_name.toLowerCase().includes(q) ||
        (p.employee_code && p.employee_code.toLowerCase().includes(q)) ||
        (p.department && p.department.toLowerCase().includes(q));
      return matchDept && matchSearch;
    });
  }, [profiles, tableDept, tableSearch]);

  // Handle activity selection
  function handleActivityChange(activityId: string) {
    setSelectedActivityId(activityId);
    if (!activityId) return;

    const act = activities.find((a) => a.id === activityId);
    if (act) {
      if (act.points > 0) setPoints(act.points);
      if (!note) setNote(`Tham gia / Đạt thành tích tại ${act.title}`);
    }
  }

  // Quick select user from table
  function handleSelectFromTable(user: AdminProfileItem) {
    setSelectedUser(user);
    setSelectedWhitelist(null);
    setSearchTerm("");
    setIsSearching(false);
    setSuccessMessage(null);
    setErrorMessage(null);

    // Smooth scroll to form
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const appliedInitialUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialSelectedUserId || appliedInitialUserRef.current === initialSelectedUserId) return;
    const user = profiles.find((p) => p.id === initialSelectedUserId);
    if (!user) return;
    appliedInitialUserRef.current = initialSelectedUserId;
    handleSelectFromTable(user);
  }, [initialSelectedUserId, profiles]);

  // Submit award points
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!selectedUser && !selectedWhitelist) {
      setErrorMessage("Vui lòng tìm và chọn đoàn viên cần cộng điểm.");
      return;
    }

    if (points === 0 || Number.isNaN(points)) {
      setErrorMessage("Số điểm cộng phải khác 0.");
      return;
    }

    if (!note.trim()) {
      setErrorMessage("Vui lòng nhập lý do / ghi chú cộng điểm.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser?.id ?? null,
          employeeCode: selectedUser ? null : selectedWhitelist?.employee_code ?? null,
          points: Number(points),
          note: note.trim(),
          awardLabel: awardLabel.trim() || null,
          activityId: selectedUser ? selectedActivityId || null : null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Có lỗi xảy ra khi thực hiện cộng điểm.");

      if (selectedUser) {
        setSuccessMessage(
          `Đã cộng thành công ${points > 0 ? `+${points}` : points} điểm cho đoàn viên ${selectedUser.full_name}! Hệ thống đã tự động tính lại thứ hạng.`,
        );
      } else if (selectedWhitelist) {
        setSuccessMessage(
          `Đã cộng ${points > 0 ? `+${points}` : points} điểm cho nhân viên ${selectedWhitelist.full_name} (${selectedWhitelist.employee_code}). Điểm sẽ tự động chuyển khi người này đăng ký tài khoản!`,
        );
      }

      // Reset form partially
      setNote("");
      setSelectedActivityId("");
      setAwardLabel("");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "Có lỗi xảy ra khi thực hiện cộng điểm.");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete / Revert a score event
  async function handleDeleteEvent(eventId: string, userName: string, pts: number) {
    if (!confirm(`Bạn có chắc chắn muốn thu hồi lượt cộng (${pts > 0 ? `+${pts}` : pts} điểm) của ${userName} không? Điểm và bảng xếp hạng sẽ được tự động tính lại.`)) {
      return;
    }

    setDeletingId(eventId);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/scores?id=${encodeURIComponent(eventId)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Không thể xóa lượt cộng điểm.");

      setSuccessMessage(`Đã thu hồi thành công lượt cộng điểm của ${userName}. Bảng xếp hạng đã được cập nhật.`);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "Không thể xóa lượt cộng điểm.");
    } finally {
      setDeletingId(null);
    }
  }

  // Map user ID to user name for recent events
  const profileMap = useMemo(() => {
    const map = new Map<string, AdminProfileItem>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const activityMap = useMemo(() => {
    const map = new Map<string, AdminActivityItem>();
    activities.forEach((a) => map.set(a.id, a));
    return map;
  }, [activities]);

  const totalPointsAwarded = useMemo(() => {
    return profiles.reduce((sum, p) => sum + (p.total_score || 0), 0);
  }, [profiles]);

  const historyColumns: DataTableColumn<AdminScoreEventItem>[] = [
    {
      key: "created_at",
      header: "Thời gian",
      type: "date",
      accessor: (evt) => evt.created_at,
      className: "text-on-surface-variant whitespace-nowrap text-xs",
      render: (evt) =>
        new Date(evt.created_at).toLocaleString("vi-VN", {
          dateStyle: "short",
          timeStyle: "short",
        }),
    },
    {
      key: "recipient",
      header: "Đoàn viên",
      accessor: (evt) => profileMap.get(evt.user_id)?.full_name ?? evt.employee_code ?? null,
      className: "font-semibold text-[#173A67]",
      render: (evt) => {
        const recipient = profileMap.get(evt.user_id);
        return recipient ? recipient.full_name : evt.employee_code ?? "—";
      },
    },
    {
      key: "employee_code",
      header: "Mã NV",
      accessor: (evt) => profileMap.get(evt.user_id)?.employee_code ?? evt.employee_code ?? null,
      className: "text-on-surface-variant",
      render: (evt) => profileMap.get(evt.user_id)?.employee_code ?? evt.employee_code ?? "—",
    },
    {
      key: "points",
      header: "Điểm",
      type: "number",
      accessor: (evt) => evt.points,
      className: "whitespace-nowrap",
      render: (evt) => {
        const isPositive = evt.points >= 0;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-black ${
              isPositive
                ? "bg-emerald-100 text-emerald-800"
                : "bg-error/15 text-error"
            }`}
          >
            {isPositive ? `+${evt.points}` : evt.points} đ
          </span>
        );
      },
    },
    {
      key: "note",
      header: "Lý do / Hoạt động",
      accessor: (evt) => evt.note ?? (evt.activity_id ? activityMap.get(evt.activity_id)?.title : null) ?? null,
      className: "max-w-xs text-on-surface",
      render: (evt) => {
        const act = evt.activity_id ? activityMap.get(evt.activity_id) : null;
        return (
          <>
            <p className="line-clamp-2">{evt.note ?? act?.title ?? "—"}</p>
            {readableAwardLabel(evt.award_label) ? (
              <span className="text-[11px] text-on-surface-variant/70 italic">
                [{readableAwardLabel(evt.award_label)}]
              </span>
            ) : null}
          </>
        );
      },
    },
    {
      key: "created_by",
      header: "Người cộng",
      type: "enum",
      accessor: (evt) => {
        const creator = evt.created_by ? profileMap.get(evt.created_by) : null;
        return creator ? creator.full_name : "Hệ thống";
      },
      className: "text-xs text-on-surface-variant whitespace-nowrap",
    },
    {
      key: "actions",
      header: "Thao tác",
      filterable: false,
      className: "text-right whitespace-nowrap",
      headerClassName: "text-right",
      render: (evt) => {
        const recipient = profileMap.get(evt.user_id);
        return (
          <button
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-error hover:bg-error/10 transition disabled:opacity-50"
            disabled={deletingId === evt.id}
            title="Thu hồi lượt cộng điểm này"
            type="button"
            onClick={() =>
              handleDeleteEvent(
                evt.id,
                recipient?.full_name ?? evt.employee_code ?? "đoàn viên",
                evt.points,
              )
            }
          >
            {deletingId === evt.id ? "Đang xóa..." : "Thu hồi"}
          </button>
        );
      },
    },
  ];

  const rosterColumns: DataTableColumn<AdminProfileItem>[] = [
    {
      key: "rank",
      header: "Hạng",
      type: "number",
      accessor: (p) => p.rank,
      className: "font-black text-[#173A67]",
      render: (p) =>
        p.rank ? (
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
            p.rank === 1
              ? "bg-amber-400 text-amber-950"
              : p.rank === 2
              ? "bg-slate-300 text-slate-800"
              : p.rank === 3
              ? "bg-amber-700/30 text-amber-900"
              : "text-on-surface-variant"
          }`}>
            {p.rank}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "employee_code",
      header: "Mã NV",
      className: "font-semibold text-[#173A67]",
      render: (p) => p.employee_code ?? "—",
    },
    {
      key: "full_name",
      header: "Họ và tên",
      render: (p) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {p.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="h-full w-full rounded-full object-cover" src={p.avatar_url} />
            ) : (
              p.full_name.slice(0, 1)
            )}
          </div>
          <span className="font-bold text-[#173A67]">{p.full_name}</span>
        </div>
      ),
    },
    {
      key: "department",
      header: "Bộ phận",
      type: "enum",
      className: "text-on-surface-variant",
      render: (p) => p.department ?? "—",
    },
    {
      key: "total_score",
      header: "Tổng điểm",
      type: "number",
      className: "font-black text-amber-800 text-base",
      render: (p) => `${p.total_score} đ`,
    },
    {
      key: "actions",
      header: "Thao tác",
      filterable: false,
      className: "text-right",
      headerClassName: "text-right",
      render: (p) => (
        <Link
          className="inline-flex items-center gap-1 rounded-xl bg-amber-500/15 border border-amber-400 px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-500 hover:text-white transition shadow-2xs"
          href={`/admin/scores?user=${encodeURIComponent(p.id)}`}
        >
          <MaterialIcon className="text-[14px]" name="add" />
          <span>Cộng điểm</span>
        </Link>
      ),
    },
  ];

  const currentPage = VIEW_PAGES.find((p) => p.view === view) ?? VIEW_PAGES[0];

  return (
    <div className="space-y-8">
      {/* 1. Header with Admin Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">{currentPage.label}</h1>
          <p className="text-body-md text-[#27496D]">{currentPage.subtitle}</p>
          <nav aria-label="Các trang điểm thi đua" className="mt-2 flex flex-wrap items-center gap-2">
            {VIEW_PAGES.filter((p) => p.view !== view).map((p) => (
              <Link
                key={p.view}
                className="inline-flex items-center gap-1 rounded-lg bg-surface-container-low px-2.5 py-1 text-label-sm font-semibold text-primary transition hover:text-[#173A67]"
                href={p.href}
              >
                <MaterialIcon className="text-[16px]" name={p.icon} />
                <span>{p.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-label-sm text-on-surface-variant sm:inline-block">
            Quản trị viên: <strong className="text-[#173A67]">{currentAdminName}</strong>
          </span>
        </div>
      </div>

      {/* 2. Quick KPI summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant font-semibold">Tổng đoàn viên</span>
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <MaterialIcon name="groups" />
            </div>
          </div>
          <p className="mt-2 text-headline-lg font-black text-[#173A67]">{profiles.length}</p>
          <p className="text-label-sm text-on-surface-variant mt-1">Đoàn viên chính thức</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-label-md text-amber-900 font-semibold">Tổng điểm thi đua</span>
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-700">
              <MaterialIcon name="military_tech" />
            </div>
          </div>
          <p className="mt-2 text-headline-lg font-black text-amber-900">
            {totalPointsAwarded.toLocaleString("vi-VN")} <span className="text-title-sm font-bold text-amber-700">điểm</span>
          </p>
          <p className="text-label-sm text-amber-800/80 mt-1">Đang ghi nhận trên toàn hệ thống</p>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant font-semibold">Lượt ghi nhận gần đây</span>
            <div className="rounded-xl bg-tertiary-container p-2 text-on-tertiary-container">
              <MaterialIcon name="history" />
            </div>
          </div>
          <p className="mt-2 text-headline-lg font-black text-[#173A67]">{recentEvents.length}</p>
          <p className="text-label-sm text-on-surface-variant mt-1">Lịch sử cộng điểm lưu trữ</p>
        </div>
      </div>

      {/* Success & Error Banners */}
      {successMessage ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-xs">
          <MaterialIcon className="text-[24px] text-emerald-600 shrink-0" name="check_circle" />
          <p className="text-body-md font-medium">{successMessage}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-center gap-3 rounded-2xl border border-error/40 bg-error-container/40 p-4 text-on-error-container shadow-xs">
          <MaterialIcon className="text-[24px] text-error shrink-0" name="error" />
          <p className="text-body-md font-medium">{errorMessage}</p>
        </div>
      ) : null}

      {/* 3. Main Form: Cộng điểm đoàn viên */}
      {view === "form" ? (
      <div
        ref={formRef}
        className="overflow-hidden rounded-2xl border border-amber-300/80 bg-surface-container-lowest shadow-md"
      >
        <div className="border-b border-amber-200/80 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent px-6 py-5">
          <div className="flex items-center gap-2 text-amber-900">
            <MaterialIcon className="text-[26px] text-amber-600" name="add_circle" />
            <h2 className="text-title-lg font-extrabold">Form Cộng Điểm Cho Đoàn Viên</h2>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Chọn đoàn viên, nhập số điểm và lý do. Hệ thống sẽ tự động cộng điểm và cập nhật Bảng xếp hạng.
          </p>
        </div>

        <form className="space-y-6 p-6 sm:p-8" onSubmit={handleSubmit}>
          {/* Step 1: Chọn đoàn viên */}
          <div className="space-y-2">
            <label className="text-label-lg font-bold text-[#173A67] flex items-center justify-between" htmlFor={searchInputId}>
              <span>1. Chọn đoàn viên nhận điểm <span className="text-error">*</span></span>
              {selectedUser || selectedWhitelist ? (
                <button
                  className="text-label-sm text-primary hover:underline font-semibold"
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setSelectedWhitelist(null);
                    setSearchTerm("");
                  }}
                >
                  Đổi người khác ✕
                </button>
              ) : null}
            </label>

            {/* Selected Card Preview */}
            {selectedUser ? (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-primary bg-primary/5 p-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white shadow-xs">
                    {selectedUser.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={selectedUser.full_name}
                        className="h-full w-full rounded-full object-cover"
                        src={selectedUser.avatar_url}
                      />
                    ) : (
                      selectedUser.full_name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="text-title-md font-extrabold text-[#173A67]">{selectedUser.full_name}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
                      <span>Mã NV: <strong>{selectedUser.employee_code ?? "—"}</strong></span>
                      <span>·</span>
                      <span>Bộ phận: <strong>{selectedUser.department ?? "Chưa phân bộ phận"}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-2 border border-outline-variant">
                  <div className="text-right">
                    <p className="text-label-sm text-on-surface-variant">Điểm hiện tại</p>
                    <p className="text-title-md font-black text-amber-700">{selectedUser.total_score} đ</p>
                  </div>
                  <div className="h-8 w-px bg-outline-variant" />
                  <div>
                    <p className="text-label-sm text-on-surface-variant">Hạng</p>
                    <p className="text-title-md font-bold text-[#173A67]">#{selectedUser.rank ?? "—"}</p>
                  </div>
                </div>
              </div>
            ) : selectedWhitelist ? (
              <div className="flex items-center justify-between rounded-xl border-2 border-amber-500 bg-amber-50 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-label-xs font-bold text-amber-900">
                      Chưa kích hoạt tài khoản
                    </span>
                    <h3 className="text-title-md font-bold text-amber-950">{selectedWhitelist.full_name}</h3>
                  </div>
                  <p className="text-body-sm text-amber-900/80 mt-1">
                    Mã NV: <strong>{selectedWhitelist.employee_code}</strong> · Bộ phận: <strong>{selectedWhitelist.department ?? "—"}</strong>
                  </p>
                </div>
                <p className="text-label-sm text-amber-800 italic">Điểm sẽ lưu đệm và kích hoạt khi đăng ký</p>
              </div>
            ) : (
              /* Search Input */
              <div className="relative">
                <div className="flex items-center rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <MaterialIcon className="text-on-surface-variant mr-2" name="search" />
                  <input
                    id={searchInputId}
                    className="w-full bg-transparent text-body-md text-on-surface outline-hidden placeholder:text-on-surface-variant/60"
                    placeholder="Gõ tên hoặc mã nhân viên để tìm nhanh..."
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsSearching(true);
                    }}
                    onFocus={() => setIsSearching(true)}
                  />
                </div>

                {/* Dropdown search suggestions */}
                {isSearching && searchTerm.trim() ? (
                  <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-outline-variant bg-white p-2 shadow-xl">
                    {searchResults.matchedProfiles.length === 0 && searchResults.matchedWhitelist.length === 0 ? (
                      <p className="p-4 text-center text-sm text-on-surface-variant">
                        Không tìm thấy đoàn viên nào phù hợp với từ khóa &ldquo;{searchTerm}&rdquo;.
                      </p>
                    ) : (
                      <>
                        {searchResults.matchedProfiles.map((p) => (
                          <button
                            key={p.id}
                            className="flex w-full items-center justify-between rounded-lg p-2.5 text-left transition hover:bg-primary/10"
                            type="button"
                            onClick={() => {
                              setSelectedUser(p);
                              setSelectedWhitelist(null);
                              setIsSearching(false);
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                                {p.full_name.slice(0, 1)}
                              </span>
                              <div>
                                <p className="font-bold text-[#173A67]">{p.full_name}</p>
                                <p className="text-xs text-on-surface-variant">
                                  Mã: {p.employee_code ?? "—"} · {p.department ?? "—"}
                                </p>
                              </div>
                            </div>
                            <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                              {p.total_score} điểm
                            </span>
                          </button>
                        ))}

                        {searchResults.matchedWhitelist.length > 0 ? (
                          <div className="border-t border-outline-variant/60 pt-2 mt-2">
                            <p className="px-2 pb-1 text-label-xs font-bold text-amber-800 uppercase">
                              Nhân viên chưa tạo tài khoản web
                            </p>
                            {searchResults.matchedWhitelist.map((w) => (
                              <button
                                key={w.employee_code}
                                className="flex w-full items-center justify-between rounded-lg p-2 text-left hover:bg-amber-50"
                                type="button"
                                onClick={() => {
                                  setSelectedWhitelist(w);
                                  setSelectedUser(null);
                                  setIsSearching(false);
                                }}
                              >
                                <div>
                                  <p className="text-sm font-semibold text-amber-950">{w.full_name}</p>
                                  <p className="text-xs text-amber-800/80">Mã: {w.employee_code} · {w.department ?? "—"}</p>
                                </div>
                                <span className="text-label-xs text-amber-700 italic">Lưu đệm</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Step 2: Chọn sự kiện / hoạt động liên kết */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-label-lg font-bold text-[#173A67]" htmlFor="activity-select">
                2. Gắn với Hoạt động / Giải đấu (Tùy chọn)
              </label>
              <select
                id="activity-select"
                className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={selectedActivityId}
                onChange={(e) => handleActivityChange(e.target.value)}
              >
                <option value="">-- Chọn hoạt động công đoàn (nếu có) --</option>
                {activities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.title} ({act.points > 0 ? `+${act.points}đ` : "Điểm mở"})
                  </option>
                ))}
              </select>
              <p className="text-label-sm text-on-surface-variant">
                Gợi ý: Chọn &ldquo;Giải thể thao Pickleball CDILV 2026&rdquo; để tự động gắn điểm sự kiện.
              </p>
            </div>

            {/* Step 3: Nhập số điểm */}
            <div className="space-y-2">
              <label className="text-label-lg font-bold text-[#173A67]" htmlFor="points-input">
                3. Số điểm cộng (+/-) <span className="text-error">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="points-input"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-headline-sm font-black text-[#173A67] focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Nhập số điểm..."
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                />
                <span className="text-title-md font-bold text-[#173A67] shrink-0">điểm</span>
              </div>
            </div>
          </div>

          {/* Quick Point Buttons */}
          <div className="space-y-2">
            <p className="text-label-sm text-on-surface-variant font-semibold">Gợi ý mức điểm nhanh:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_POINTS.map((qp) => (
                <button
                  key={qp.value}
                  className={`rounded-lg px-2.5 py-1 text-label-sm font-bold transition ${
                    points === qp.value
                      ? "bg-amber-500 text-white shadow-xs"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-amber-100 hover:text-amber-900"
                  }`}
                  type="button"
                  onClick={() => setPoints(qp.value)}
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: Lý do & Nhãn */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <label className="text-label-lg font-bold text-[#173A67]" htmlFor="note-input">
                4. Lý do / Nội dung cộng điểm <span className="text-error">*</span>
              </label>
              <input
                id="note-input"
                className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="VD: Đạt giải Nhất đôi nam Pickleball 2026, Tham gia cắm hoa 20-10..."
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-label-lg font-bold text-[#173A67]" htmlFor="label-input">
                5. Nhãn giải thưởng (Tùy chọn)
              </label>
              <input
                id="label-input"
                className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="VD: pickleball_2026, cam_hoa..."
                type="text"
                value={awardLabel}
                onChange={(e) => setAwardLabel(e.target.value)}
              />
            </div>
          </div>

          {/* Submit button */}
          <div className="flex items-center justify-end gap-4 border-t border-outline-variant/60 pt-6">
            <button
              className="rounded-xl border border-outline-variant px-5 py-2.5 text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-high transition"
              disabled={submitting}
              type="button"
              onClick={() => {
                setSelectedUser(null);
                setSelectedWhitelist(null);
                setPoints(50);
                setNote("");
                setSelectedActivityId("");
                setAwardLabel("");
              }}
            >
              Làm mới form
            </button>

            <button
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-label-lg font-bold text-white shadow-md transition hover:bg-amber-600 disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              <MaterialIcon className="text-[20px]" name="check" />
              <span>{submitting ? "Đang xử lý..." : "Xác nhận cộng điểm"}</span>
            </button>
          </div>
        </form>
      </div>
      ) : null}

      {/* 4. Recent Score Events History */}
      {view === "history" ? (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MaterialIcon className="text-[24px] text-[#173A67]" name="history" />
            <h2 className="text-title-lg font-bold text-[#173A67]">Lịch sử cộng điểm gần đây</h2>
          </div>
        </div>

        <DataTable
          columns={historyColumns}
          emptyText="Chưa có lượt cộng điểm nào trong hệ thống."
          footerNote="Đang hiển thị 50 lượt cộng điểm gần nhất"
          rowKey={(evt) => evt.id}
          rows={recentEvents}
        />
      </div>
      ) : null}

      {/* 5. Member Roster Table with Quick Award Action */}
      {view === "members" ? (
      <div className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MaterialIcon className="text-[24px] text-[#173A67]" name="leaderboard" />
            <h2 className="text-title-lg font-bold text-[#173A67]">Danh sách đoàn viên & Điểm tích lũy</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Dept filter */}
            <select
              className="rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-sm text-on-surface focus:border-primary"
              value={tableDept}
              onChange={(e) => setTableDept(e.target.value)}
            >
              <option value="ALL">Tất cả bộ phận</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Search filter */}
            <input
              className="rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary"
              placeholder="Tìm kiếm đoàn viên..."
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
            />
          </div>
        </div>

        <DataTable
          columns={rosterColumns}
          emptyText="Không tìm thấy đoàn viên nào phù hợp."
          rowKey={(p) => p.id}
          rows={filteredProfiles}
        />
      </div>
      ) : null}
    </div>
  );
}
