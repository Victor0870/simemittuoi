"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AdminShortcutLink } from "@/components/admin/AdminShortcutLink";
import { CHAIRMAN_TITLE } from "@/lib/chairman-title";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";

export type FeedbackItem = {
  id: string;
  userId: string;
  content: string;
  status: "pending" | "replied";
  adminReply: string | null;
  adminRepliedAt: string | null;
  adminName: string | null;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    department: string | null;
    role: string;
  };
};

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;
  return new Date(isoDate).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** `admin`: trang /admin/competition/feedback (thống kê, trả lời, xóa mọi ý kiến); trang công khai giống nhau với mọi người. */
export function FeedbackClient({ mode = "public" }: { mode?: "public" | "admin" }) {
  const { user, profile, isAdmin: isAdminRole } = useAuth();
  const isAdmin = mode === "admin" && isAdminRole;
  const [, startTransition] = useTransition();

  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Giới hạn 5 ý kiến chưa phản hồi
  const [myPendingCount, setMyPendingCount] = useState(0);
  const [showOverloadModal, setShowOverloadModal] = useState(false);

  // Bộ lọc
  const [activeTab, setActiveTab] = useState<"all" | "mine" | "pending" | "replied">("all");

  // Admin reply inline states
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyAdminName, setReplyAdminName] = useState("");
  const [savingReply, setSavingReply] = useState(false);

  // Xóa
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadFeedbacks() {
    try {
      setLoading(true);
      const res = await fetch("/api/feedbacks");
      const data = await res.json();
      if (res.ok) {
        setFeedbacks(data.feedbacks || []);
        setMyPendingCount(data.myPendingCount || 0);
      } else {
        setErrorMsg(data.error || "Không thể tải danh sách góp ý.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeedbacks();
  }, [user]);

  // Gửi ý kiến mới
  async function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    // Kiểm tra ngay trên client: nếu đã có 5 ý kiến chưa được phản hồi -> hiện popup quá tải
    if (myPendingCount >= 5) {
      setShowOverloadModal(true);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();

      if (res.status === 429 || data.error === "over_limit") {
        setShowOverloadModal(true);
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.error || "Gửi ý kiến không thành công.");
        return;
      }

      setContent("");
      setSuccessMsg("Cảm ơn bạn! Ý kiến đóng góp của bạn đã được gửi tới Ban Chấp hành.");
      await loadFeedbacks();
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi kết nối.");
    } finally {
      setSubmitting(false);
    }
  }

  // Admin gửi phản hồi
  async function handleSaveReply(feedbackId: string) {
    if (savingReply) return;
    setSavingReply(true);
    try {
      const res = await fetch("/api/feedbacks/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackId,
          reply: replyText.trim(),
          adminName: replyAdminName.trim() || CHAIRMAN_TITLE,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Không thể lưu phản hồi.");
        return;
      }
      setReplyingId(null);
      setReplyText("");
      await loadFeedbacks();
    } catch (err: any) {
      alert(err?.message || "Lỗi lưu phản hồi.");
    } finally {
      setSavingReply(false);
    }
  }

  // Xóa góp ý
  async function handleDeleteFeedback(feedbackId: string) {
    if (!confirm("Bạn có chắc chắn muốn xóa ý kiến đóng góp này?")) return;
    setDeletingId(feedbackId);
    try {
      const res = await fetch(`/api/feedbacks?id=${feedbackId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Không thể xóa ý kiến.");
        return;
      }
      await loadFeedbacks();
    } catch (err: any) {
      alert(err?.message || "Lỗi kết nối.");
    } finally {
      setDeletingId(null);
    }
  }

  // Danh sách sau khi lọc
  const filteredFeedbacks = feedbacks.filter((fb) => {
    if (activeTab === "mine") return user && fb.userId === user.id;
    if (activeTab === "pending") return fb.status === "pending" || !fb.adminReply;
    if (activeTab === "replied") return fb.status === "replied" && !!fb.adminReply;
    return true;
  });

  const pendingTotal = feedbacks.filter((f) => !f.adminReply).length;
  const repliedTotal = feedbacks.filter((f) => !!f.adminReply).length;

  return (
    <div className="max-w-4xl space-y-8 pb-16">
      {/* 1. Header trang */}
      <header className="rounded-3xl border border-dusty-border/80 bg-gradient-to-br from-[#173A67] via-[#1E4A7D] to-[#0E2849] p-6 text-white shadow-md sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-amber-300 backdrop-blur-sm">
              <MaterialIcon className="text-[16px]" name="rate_review" />
              <span>Hòm thư Lắng nghe & Đổi mới</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Góp ý & Nguyện vọng Đoàn viên
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm text-slate-200 leading-relaxed">
              Diễn đàn tiếp nhận tâm tư, kiến nghị và sáng kiến xây dựng Công đoàn cơ sở vững mạnh.
              Mọi ý kiến đóng góp đều được Ban Chấp hành và Chủ tịch BCH Công đoàn lắng nghe, tiếp thu và
              trực tiếp phản hồi.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-center justify-center rounded-2xl bg-white/10 p-4 text-center backdrop-blur-md border border-white/10 min-w-[130px]">
            <MaterialIcon className="text-[32px] text-amber-300" name="mark_email_read" />
            <span className="mt-1 text-xl font-black">{feedbacks.length}</span>
            <span className="text-[11px] text-slate-300">Ý kiến tiếp nhận</span>
          </div>
        </div>

        {/* Thống kê nhanh cho Admin */}
        {isAdmin && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-white/15 pt-4 text-xs font-medium">
            <span className="rounded-lg bg-amber-400/20 px-3 py-1 text-amber-200 border border-amber-300/30">
              ⚡ Đang chờ Chủ tịch phản hồi: <strong>{pendingTotal}</strong> ý kiến
            </span>
            <span className="rounded-lg bg-emerald-400/20 px-3 py-1 text-emerald-200 border border-emerald-300/30">
              ✓ Đã giải quyết & phản hồi: <strong>{repliedTotal}</strong> ý kiến
            </span>
          </div>
        )}
      </header>

      {mode === "public" ? (
        <div className="-mt-4 flex justify-end">
          <AdminShortcutLink href="/admin/competition/feedback" icon="reply" label="Trả lời góp ý" />
        </div>
      ) : null}

      {/* 2. Khung gửi ý kiến đóng góp */}
      {mode === "public" ? (
      <section className="rounded-2xl border border-dusty-border bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center gap-2 border-b border-dusty-border/60 pb-3">
          <div className="rounded-lg bg-amber-100 p-1.5 text-amber-900">
            <MaterialIcon className="text-[20px]" name="edit_note" />
          </div>
          <h2 className="text-base font-bold text-[#173A67] sm:text-lg">
            Gửi ý kiến đóng góp của bạn
          </h2>
        </div>

        {!user ? (
          <div className="my-6 rounded-xl border border-dashed border-dusty-border bg-slate-50 p-6 text-center">
            <MaterialIcon className="mx-auto text-[36px] text-slate-400" name="lock" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Vui lòng đăng nhập tài khoản Đoàn viên để gửi ý kiến đóng góp
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Ý kiến của bạn sẽ được gửi trực tiếp đến Chủ tịch và Ban Chấp hành Công đoàn.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                className="rounded-xl bg-[#173A67] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1E4A7D]"
                href="/login"
              >
                Đăng nhập ngay
              </Link>
              <Link
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                href="/register"
              >
                Đăng ký thành viên
              </Link>
            </div>
          </div>
        ) : profile?.approval_status !== "approved" ? (
          <div className="my-6 rounded-xl bg-amber-50 p-5 text-center text-xs text-amber-800 border border-amber-200">
            Tài khoản của bạn đang chờ Ban Chấp hành duyệt. Sau khi được duyệt, bạn sẽ có thể gửi ý kiến đóng góp.
          </div>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={handleSubmitFeedback}>
            {errorMsg && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200">
                {successMsg}
              </div>
            )}

            <div>
              <textarea
                className="w-full rounded-xl border border-slate-300 p-3.5 text-sm text-slate-800 placeholder-slate-400 focus:border-[#173A67] focus:outline-hidden focus:ring-2 focus:ring-[#173A67]/20 transition-all resize-y min-h-[110px]"
                placeholder="Nhập tâm tư, nguyện vọng, sáng kiến hoặc phản ánh đóng góp gửi tới Ban Chấp hành Công đoàn..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={2000}
                required
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Đoàn viên: <strong>{profile?.full_name || "Thành viên"}</strong>
                  {profile?.department && ` (${profile.department})`}
                </span>
                <span>{content.length}/2000 ký tự</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <p className="text-[11px] text-slate-500 italic">
                * Ý kiến được lưu trữ công khai để Ban Chấp hành theo dõi và phản hồi minh bạch.
              </p>
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173A67] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1E4A7D] active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <MaterialIcon className="animate-spin text-[16px]" name="progress_activity" />
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <MaterialIcon className="text-[16px]" name="send" />
                    <span>Gửi ý kiến đóng góp</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </section>
      ) : null}

      {/* 3. Danh sách ý kiến & phản hồi */}
      <section className="space-y-4">
        {/* Bộ lọc tabs */}
        <div className="flex items-center justify-between border-b border-dusty-border pb-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-[#173A67] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Tất cả ({feedbacks.length})
            </button>
            {user && (
              <button
                onClick={() => setActiveTab("mine")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "mine"
                    ? "bg-[#173A67] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Của tôi ({feedbacks.filter((f) => f.userId === user.id).length})
              </button>
            )}
            <button
              onClick={() => setActiveTab("pending")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === "pending"
                  ? "bg-amber-500 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Chờ phản hồi ({pendingTotal})
            </button>
            <button
              onClick={() => setActiveTab("replied")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === "replied"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Đã phản hồi ({repliedTotal})
            </button>
          </div>

          <button
            onClick={loadFeedbacks}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
            title="Tải lại danh sách"
          >
            <MaterialIcon className={`text-[16px] ${loading ? "animate-spin" : ""}`} name="refresh" />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>

        {/* Nội dung danh sách */}
        {loading && feedbacks.length === 0 ? (
          <div className="rounded-2xl border border-dusty-border bg-white p-12 text-center text-xs text-slate-500">
            <MaterialIcon className="mx-auto animate-spin text-[28px] text-[#173A67]" name="progress_activity" />
            <p className="mt-2">Đang tải danh sách góp ý...</p>
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-dusty-border bg-white p-12 text-center text-xs text-slate-500">
            <MaterialIcon className="mx-auto text-[36px] text-slate-300" name="chat_bubble_outline" />
            <p className="mt-2 font-medium">Chưa có ý kiến nào trong mục này.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFeedbacks.map((fb) => {
              const isOwner = user && fb.userId === user.id;
              const hasReplied = !!fb.adminReply;
              const isReplyingThis = replyingId === fb.id;

              return (
                <article
                  key={fb.id}
                  className="rounded-2xl border border-dusty-border bg-white p-5 shadow-xs transition-all hover:border-slate-300"
                >
                  {/* Header người gửi */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {fb.author.avatarUrl ? (
                        <img
                          src={fb.author.avatarUrl}
                          alt={fb.author.fullName}
                          className="h-10 w-10 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#173A67] font-bold text-xs text-white">
                          {fb.author.fullName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {fb.author.fullName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          {fb.author.department && <span>{fb.author.department}</span>}
                          {fb.author.department && <span>•</span>}
                          <span>{formatTimeAgo(fb.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Badge trạng thái */}
                    <div className="flex items-center gap-2">
                      {hasReplied ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                          <MaterialIcon className="text-[14px]" name="check_circle" />
                          <span>Đã phản hồi</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-200">
                          <MaterialIcon className="text-[14px]" name="hourglass_top" />
                          <span>Đang chờ</span>
                        </span>
                      )}

                      {/* Nút xóa cho Admin hoặc Tác giả (khi chưa reply) */}
                      {(isAdmin || (isOwner && !hasReplied)) && (
                        <button
                          onClick={() => handleDeleteFeedback(fb.id)}
                          disabled={deletingId === fb.id}
                          className="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                          title="Xóa ý kiến"
                        >
                          <MaterialIcon className="text-[18px]" name="delete" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nội dung ý kiến đóng góp */}
                  <div className="mt-3.5 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed pl-1">
                    {fb.content}
                  </div>

                  {/* HỘP PHẢN HỒI CỦA ADMIN / CHỦ TỊCH */}
                  {hasReplied && (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-slate-50 to-blue-50/50 p-4">
                      <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#173A67]">
                          <MaterialIcon className="text-[18px] text-amber-500" name="verified" />
                          <span>Phản hồi từ {fb.adminName || CHAIRMAN_TITLE}</span>
                        </div>
                        {fb.adminRepliedAt && (
                          <span className="text-[11px] text-slate-500">
                            {formatTimeAgo(fb.adminRepliedAt)}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {fb.adminReply}
                      </div>

                      {/* Cho phép Admin sửa phản hồi */}
                      {isAdmin && (
                        <div className="mt-2 flex justify-end">
                          <button
                            onClick={() => {
                              setReplyingId(fb.id);
                              setReplyText(fb.adminReply || "");
                              setReplyAdminName(fb.adminName || CHAIRMAN_TITLE);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#173A67] hover:underline cursor-pointer"
                          >
                            <MaterialIcon className="text-[14px]" name="edit" />
                            <span>Chỉnh sửa phản hồi</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Nút / Form Admin Phản hồi */}
                  {isAdmin && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      {!isReplyingThis ? (
                        !hasReplied && (
                          <button
                            onClick={() => {
                              setReplyingId(fb.id);
                              setReplyText("");
                              setReplyAdminName(CHAIRMAN_TITLE);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 border border-amber-300 hover:bg-amber-100 transition-all cursor-pointer"
                          >
                            <MaterialIcon className="text-[16px]" name="reply" />
                            <span>Trả lời ý kiến này</span>
                          </button>
                        )
                      ) : (
                        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/60 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#173A67]">
                              {hasReplied ? "Chỉnh sửa phản hồi của Chủ tịch" : "Nhập phản hồi của Chủ tịch / Ban Chấp hành:"}
                            </span>
                            <button
                              onClick={() => setReplyingId(null)}
                              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              Đóng
                            </button>
                          </div>

                          <input
                            type="text"
                            placeholder={`Danh xưng phản hồi (Mặc định: ${CHAIRMAN_TITLE})`}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                            value={replyAdminName}
                            onChange={(e) => setReplyAdminName(e.target.value)}
                          />

                          <textarea
                            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-[#173A67] focus:outline-hidden min-h-[90px]"
                            placeholder="Nhập nội dung tiếp thu, giải trình hoặc giải quyết phản ánh..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                          />

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setReplyingId(null)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              onClick={() => handleSaveReply(fb.id)}
                              disabled={savingReply}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#173A67] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#1E4A7D] cursor-pointer"
                            >
                              {savingReply ? (
                                <span>Đang lưu...</span>
                              ) : (
                                <>
                                  <MaterialIcon className="text-[16px]" name="send" />
                                  <span>Lưu phản hồi</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. MODAL POPUP QUÁ TẢI (THEO ĐÚNG YÊU CẦU: TỐI ĐA 5 Ý KIẾN CHƯA PHẢN HỒI) */}
      {showOverloadModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-dusty-border bg-white p-6 sm:p-7 shadow-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-inner">
              <MaterialIcon className="text-[36px]" name="hourglass_top" />
            </div>

            <h3 className="mt-4 text-xl font-black text-[#173A67]">
              Cảm ơn bạn đã đóng góp!
            </h3>

            <div className="mt-3 rounded-2xl bg-amber-50 p-4 border border-amber-200/80">
              <p className="text-sm font-bold text-amber-900 leading-relaxed">
                Hiện tại Chủ tịch đang quá tải sẽ giải quyết góp ý sau.
              </p>
              <p className="mt-1.5 text-xs text-amber-800/80 leading-normal">
                Ban Chấp hành đang khẩn trương tiếp nhận và xử lý các ý kiến trước đó của bạn.
                Ngay khi nhận được phản hồi từ Chủ tịch, bạn sẽ có thể tiếp tục gửi thêm ý kiến mới!
              </p>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setShowOverloadModal(false)}
                className="w-full rounded-xl bg-[#173A67] py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#1E4A7D] active:scale-98 transition-all cursor-pointer"
              >
                Đã hiểu, cảm ơn Chủ tịch!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
