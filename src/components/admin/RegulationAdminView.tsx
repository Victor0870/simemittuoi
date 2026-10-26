"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { RegulationSection, RegulationWithSections } from "@/lib/regulations/types";

type Props = {
  initialData: RegulationWithSections;
};

export function RegulationAdminView({ initialData }: Props) {
  const [doc] = useState(initialData);
  const [sections, setSections] = useState<RegulationSection[]>(initialData.sections);

  // Trạng thái sửa inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftHeading, setDraftHeading] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Trạng thái trích bài viết
  const [extractingId, setExtractingId] = useState<string | null>(null);

  // Thông báo phản hồi
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
    postId?: string;
  } | null>(null);

  // Nhóm mục lục theo Chương
  const chapterGroups = useMemo(() => {
    const groups: { chapter: string; items: RegulationSection[] }[] = [];
    for (const sec of sections) {
      const chName = sec.chapter || "Chương khác";
      let group = groups.find((g) => g.chapter === chName);
      if (!group) {
        group = { chapter: chName, items: [] };
        groups.push(group);
      }
      group.items.push(sec);
    }
    return groups;
  }, [sections]);

  // Cuộn tới điều khoản
  function scrollToSection(id: string) {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Bắt đầu sửa inline
  function startEdit(sec: RegulationSection) {
    setEditingId(sec.id);
    setDraftHeading(sec.heading);
    setDraftBody(sec.body_text);
    setNotice(null);
  }

  // Hủy sửa inline
  function cancelEdit() {
    setEditingId(null);
    setDraftHeading("");
    setDraftBody("");
  }

  // Lưu sửa inline
  async function saveEdit(id: string) {
    if (!draftHeading.trim()) {
      setNotice({ type: "error", message: "Tiêu đề điều khoản không được để trống." });
      return;
    }
    setSavingId(id);
    setNotice(null);

    try {
      const res = await fetch(`/api/admin/regulations/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heading: draftHeading,
          body_text: draftBody,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Không thể lưu thay đổi.");
      }

      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, heading: draftHeading.trim(), body_text: draftBody } : s)),
      );
      setEditingId(null);
      setNotice({ type: "success", message: "Đã lưu thay đổi điều khoản thành công." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi khi lưu.";
      setNotice({ type: "error", message: msg });
    } finally {
      setSavingId(null);
    }
  }

  // Trích thành bài viết
  async function handleExtractPost(sec: RegulationSection) {
    setExtractingId(sec.id);
    setNotice(null);

    try {
      const res = await fetch("/api/admin/regulations/extract-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: sec.id }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Không thể trích bài viết.");
      }

      setNotice({
        type: "success",
        message: `Đã trích “${sec.article_number || sec.heading}” thành bản nháp bài viết mới (chưa xuất bản).`,
        postId: data.postId,
      });

      // Mở trình soạn thảo bài viết ở tab mới
      if (typeof window !== "undefined") {
        window.open(`/admin/content/posts?edit=${data.postId}`, "_blank");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi khi trích bài viết.";
      setNotice({ type: "error", message: msg });
    } finally {
      setExtractingId(null);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header trang */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-[#173A67]/10 px-2.5 py-0.5 text-xs font-bold text-[#173A67]">
              <MaterialIcon className="text-sm" name="gavel" />
              Năm {doc.year}
            </span>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
              Hiệu lực
            </span>
            {doc.document_number ? (
              <span className="text-xs text-slate-500">Số: {doc.document_number}</span>
            ) : null}
          </div>
          <h1 className="mt-1 text-2xl font-black text-[#173A67] tracking-tight">Quy chế chi tiêu</h1>
          <p className="mt-0.5 text-sm text-[#27496D]">{doc.title}</p>
        </div>
      </div>

      {/* Thông báo thao tác */}
      {notice ? (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl p-4 text-sm transition-all shadow-xs ${
            notice.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <MaterialIcon
              className={`text-xl ${notice.type === "success" ? "text-emerald-600" : "text-rose-600"}`}
              name={notice.type === "success" ? "check_circle" : "error"}
            />
            <div>
              <p className="font-medium">{notice.message}</p>
              {notice.postId ? (
                <div className="mt-1.5">
                  <Link
                    className="inline-flex items-center gap-1 font-bold text-emerald-800 underline hover:text-emerald-950"
                    href={`/admin/content/posts?edit=${notice.postId}`}
                    target="_blank"
                  >
                    Mở bản nháp trong trình soạn thảo bài viết
                    <MaterialIcon className="text-sm" name="open_in_new" />
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
          <button
            aria-label="Đóng thông báo"
            className="text-slate-400 hover:text-slate-600"
            onClick={() => setNotice(null)}
            type="button"
          >
            <MaterialIcon className="text-lg" name="close" />
          </button>
        </div>
      ) : null}

      {/* Căn cứ / Preamble */}
      {doc.preamble ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-700 shadow-2xs">
          <div className="mb-2 flex items-center gap-2 font-bold text-[#173A67]">
            <MaterialIcon className="text-base text-primary" name="info" />
            <span>Căn cứ ban hành</span>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed text-slate-600">{doc.preamble}</p>
        </div>
      ) : null}

      {/* Khung 2 cột: Mục lục bên trái (desktop) + Toàn văn quy chế bên phải */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        {/* Cột mục lục */}
        <div className="lg:col-span-4 xl:col-span-4">
          <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="flex items-center gap-2 text-base font-extrabold text-[#173A67]">
                <MaterialIcon className="text-lg text-primary" name="menu_book" />
                Mục lục quy chế
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {sections.length} điều
              </span>
            </div>

            <nav aria-label="Mục lục quy chế" className="max-h-[calc(100vh-14rem)] space-y-4 overflow-y-auto pr-1 text-xs">
              {chapterGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1.5">
                  <div className="font-bold text-slate-500 uppercase tracking-wider">{group.chapter}</div>
                  <ul className="space-y-1 pl-2">
                    {group.items.map((sec) => (
                      <li key={sec.id}>
                        <button
                          className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-[#ecf4ff] hover:text-[#173A67]"
                          onClick={() => scrollToSection(sec.id)}
                          type="button"
                        >
                          <span className="font-bold text-[#173A67]">{sec.article_number || `Điều ${sec.order_index}`}:</span>{" "}
                          <span className="line-clamp-1">{sec.heading.replace(/^.*?(Điều\s+\d+[:.]?\s*)/i, "") || sec.heading}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>

        {/* Cột toàn văn quy chế */}
        <div className="space-y-6 lg:col-span-8 xl:col-span-8">
          {chapterGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-4">
              {/* Tiêu đề chương */}
              <div className="rounded-xl bg-[#173A67] px-4 py-2.5 text-white shadow-xs">
                <h2 className="text-sm font-extrabold tracking-wide uppercase">{group.chapter}</h2>
              </div>

              {/* Danh sách các điều trong chương */}
              <div className="space-y-4">
                {group.items.map((sec) => {
                  const isEditing = editingId === sec.id;
                  const isSaving = savingId === sec.id;
                  const isExtracting = extractingId === sec.id;

                  return (
                    <article
                      id={`section-${sec.id}`}
                      key={sec.id}
                      className={`scroll-mt-24 rounded-2xl border transition-all ${
                        isEditing
                          ? "border-[#173A67] bg-white ring-2 ring-[#173A67]/15 shadow-md"
                          : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
                      }`}
                    >
                      {/* Tiêu đề điều và nút thao tác */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-3 rounded-t-2xl">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-[#173A67]/10 px-2 py-0.5 text-xs font-bold text-[#173A67]">
                            {sec.article_number || `Điều ${sec.order_index}`}
                          </span>
                          {!isEditing ? (
                            <h3 className="text-sm font-bold text-[#173A67]">{sec.heading}</h3>
                          ) : null}
                        </div>

                        {/* Các nút hành động */}
                        {!isEditing ? (
                          <div className="flex items-center gap-2">
                            {/* Nút Trích thành bài viết */}
                            <button
                              aria-label="Trích thành bài viết"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#173A67] transition hover:border-[#173A67] hover:bg-[#ecf4ff] hover:text-[#173A67] disabled:opacity-50 shadow-2xs"
                              disabled={isExtracting}
                              onClick={() => handleExtractPost(sec)}
                              title="Tạo bản nháp bài viết mới từ điều khoản này (chưa xuất bản)"
                              type="button"
                            >
                              <MaterialIcon className="text-base text-primary" name={isExtracting ? "hourglass_top" : "post_add"} />
                              <span>{isExtracting ? "Đang trích..." : "Trích thành bài viết"}</span>
                            </button>

                            {/* Nút Chỉnh sửa inline */}
                            <button
                              aria-label="Chỉnh sửa điều khoản"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 disabled:opacity-50 shadow-2xs"
                              onClick={() => startEdit(sec)}
                              type="button"
                            >
                              <MaterialIcon className="text-base text-slate-600" name="edit" />
                              <span>Sửa</span>
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {/* Thân bài viết: Hiển thị văn bản thuần hoặc Form sửa */}
                      <div className="p-5">
                        {!isEditing ? (
                          <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
                            {sec.body_text}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                Tiêu đề / Tên điều khoản
                              </label>
                              <input
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#173A67] focus:outline-hidden focus:ring-2 focus:ring-[#173A67]/20"
                                onChange={(e) => setDraftHeading(e.target.value)}
                                value={draftHeading}
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                Nội dung điều khoản (văn bản thuần, hỗ trợ xuống dòng)
                              </label>
                              <textarea
                                className="w-full rounded-xl border border-slate-300 bg-white p-3 font-sans text-sm leading-relaxed text-slate-800 focus:border-[#173A67] focus:outline-hidden focus:ring-2 focus:ring-[#173A67]/20"
                                onChange={(e) => setDraftBody(e.target.value)}
                                rows={Math.max(6, draftBody.split("\n").length + 2)}
                                value={draftBody}
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                              <button
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                                disabled={isSaving}
                                onClick={cancelEdit}
                                type="button"
                              >
                                Hủy
                              </button>
                              <button
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1f4a83] disabled:opacity-50 shadow-xs"
                                disabled={isSaving}
                                onClick={() => saveEdit(sec.id)}
                                type="button"
                              >
                                <MaterialIcon className="text-base" name={isSaving ? "hourglass_top" : "check"} />
                                <span>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
