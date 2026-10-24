"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RegulationContent } from "@/components/finance/RegulationContent";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  SPENDING_REGULATION_LIMITS,
  formatRegulationDate,
  nextRegulationNumbers,
  regulationOutline,
  type SpendingRegulation,
} from "@/lib/finance/regulation";
import { uploadPostImage } from "@/lib/post-image-upload";
import { POST_IMAGE_ACCEPT, postInlineImageMarkup } from "@/lib/post-images";

type Props = {
  initial: SpendingRegulation;
  updatedAt: string | null;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#173A67] focus:outline-hidden focus:ring-2 focus:ring-[#173A67]/20";

const toolButton =
  "inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-[#173A67] transition hover:border-[#173A67] hover:bg-[#ecf4ff] disabled:opacity-60";

const STARTER_OUTLINE = [
  "# Chương I. QUY ĐỊNH CHUNG",
  "",
  "## Điều 1. Phạm vi điều chỉnh",
  "",
  "## Điều 2. Đối tượng áp dụng",
  "",
  "# Chương II. NỘI DUNG VÀ MỨC CHI",
  "",
  "## Điều 3. Tên điều",
  "",
  "# Chương III. TỔ CHỨC THỰC HIỆN",
  "",
  "## Điều 4. Hiệu lực thi hành",
].join("\n");

function formatSavedAt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : null;
}

/** Soạn Quy chế chi tiêu: thông tin chung + nội dung theo Chương / Điều, xem trước nội dung. */
export function SpendingRegulationEditor({ initial, updatedAt }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [regulationNo, setRegulationNo] = useState(initial.regulationNo);
  const [effectiveDate, setEffectiveDate] = useState(initial.effectiveDate ?? "");
  const [content, setContent] = useState(initial.content);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(updatedAt);
  const [panel, setPanel] = useState<"preview" | "outline">("preview");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  const outline = useMemo(() => regulationOutline(content), [content]);
  const numbers = useMemo(() => nextRegulationNumbers(content), [content]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function touch() {
    setDirty(true);
    setSuccess(null);
  }

  function updateContent(next: string, selStart: number, selEnd = selStart) {
    setContent(next);
    touch();
    requestAnimationFrame(() => {
      const textarea = contentRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(selStart, selEnd);
    });
  }

  function currentSelection() {
    const textarea = contentRef.current;
    const start = Math.min(textarea?.selectionStart ?? content.length, content.length);
    const end = Math.min(Math.max(textarea?.selectionEnd ?? start, start), content.length);
    return { start, end };
  }

  /** Chèn một khối (tiêu đề, ảnh…) thành dòng riêng tại con trỏ; chọn sẵn phần chữ cần gõ lại. */
  function insertBlock(text: string, placeholder?: string, at = currentSelection(), base = content) {
    const before = base.slice(0, at.start);
    const after = base.slice(at.end);
    const prefix = !before ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const suffix = after.startsWith("\n") ? "" : "\n";
    const blockStart = before.length + prefix.length;
    const selStart = placeholder ? blockStart + text.indexOf(placeholder) : blockStart + text.length;
    updateContent(before + prefix + text + suffix + after, selStart, placeholder ? selStart + placeholder.length : selStart);
  }

  /** Thêm "- " hoặc "1. " vào đầu các dòng đang chọn. */
  function prefixLines(kind: "ul" | "ol") {
    const { start, end } = currentSelection();
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const nextBreak = content.indexOf("\n", end);
    const lineEnd = nextBreak === -1 ? content.length : nextBreak;
    let n = 0;
    const block = content
      .slice(lineStart, lineEnd)
      .split("\n")
      .map((line) => {
        const bare = line.replace(/^\s*(?:[-•*]\s+|\d{1,3}[.)]\s+)/, "");
        n += 1;
        return kind === "ul" ? `- ${bare}` : `${n}. ${bare}`;
      })
      .join("\n");
    updateContent(content.slice(0, lineStart) + block + content.slice(lineEnd), lineStart + block.length);
  }

  function makeBold() {
    const { start, end } = currentSelection();
    const selected = content.slice(start, end);
    const inner = selected || "chữ đậm";
    const next = `${content.slice(0, start)}**${inner}**${content.slice(end)}`;
    updateContent(next, start + 2, start + 2 + inner.length);
  }

  function jumpToLine(line: number, anchor: string) {
    const textarea = contentRef.current;
    if (!textarea) return;
    const lines = content.split("\n");
    const offset = lines.slice(0, line).reduce((sum, l) => sum + l.length + 1, 0);
    textarea.focus();
    textarea.setSelectionRange(offset, offset + (lines[line]?.length ?? 0));
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    textarea.scrollTop = Math.max(0, line * lineHeight - 40);
    document.getElementById(anchor)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function pickImage() {
    selectionRef.current = currentSelection();
    fileRef.current?.click();
  }

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadPostImage(file, "/api/finance/regulation/images");
      const base = contentRef.current?.value ?? content;
      const at = selectionRef.current ?? { start: base.length, end: base.length };
      insertBlock(postInlineImageMarkup(url), undefined, {
        start: Math.min(at.start, base.length),
        end: Math.min(at.end, base.length),
      }, base);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được ảnh lên.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving || uploading) return;
    if (!title.trim()) {
      setError("Vui lòng nhập tên quy chế.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/finance/regulation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, regulationNo, effectiveDate: effectiveDate || null, content }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Không lưu được quy chế chi tiêu.");
      setSavedAt(json.updatedAt ?? new Date().toISOString());
      setDirty(false);
      setSuccess("Đã lưu Quy chế chi tiêu.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được quy chế chi tiêu.");
    } finally {
      setSaving(false);
    }
  }

  const previewMeta = [
    regulationNo.trim() ? `Số: ${regulationNo.trim()}` : null,
    effectiveDate ? `Hiệu lực từ ngày ${formatRegulationDate(effectiveDate)}` : null,
  ].filter(Boolean);

  return (
    <form className="flex flex-col gap-3" onSubmit={save}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1 className="text-lg font-extrabold text-[#173A67]">Quy chế chi tiêu</h1>
        {dirty ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">Chưa lưu</span>
        ) : savedAt ? (
          <span className="text-xs text-on-surface-variant">Lưu lần cuối: {formatSavedAt(savedAt)}</span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#1E4A7D] disabled:opacity-50"
            disabled={saving || uploading}
            type="submit"
          >
            <MaterialIcon className={`text-[16px] ${saving ? "animate-spin" : ""}`} name={saving ? "progress_activity" : "save"} />
            {saving ? "Đang lưu..." : "Lưu quy chế"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-error/40 bg-error-container/40 px-3 py-2 text-sm text-on-error-container" role="alert">
          {error}
        </p>
      ) : null}
      {success ? <p className="rounded-xl bg-[#D9F2EC] px-3 py-2 text-sm font-semibold text-[#173A67]">{success}</p> : null}

      <div className="grid gap-3 rounded-xl border border-[#d2dfe9] bg-white p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-700">
          Tên quy chế <span className="sr-only">(bắt buộc)</span>
          <input
            className={inputClass}
            maxLength={SPENDING_REGULATION_LIMITS.title}
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              touch();
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-700">
          Số quy chế
          <input
            className={inputClass}
            maxLength={SPENDING_REGULATION_LIMITS.regulationNo}
            placeholder="VD: 01/QC-CĐCS"
            value={regulationNo}
            onChange={(e) => {
              setRegulationNo(e.target.value);
              touch();
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-700">
          Ngày hiệu lực
          <input
            className={inputClass}
            type="date"
            value={effectiveDate}
            onChange={(e) => {
              setEffectiveDate(e.target.value);
              touch();
            }}
          />
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-[#d2dfe9] bg-white p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-bold text-slate-700">Nội dung</span>
            <button
              className={toolButton}
              title="Thêm Chương mới (tự đánh số La Mã)"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlock(`# Chương ${numbers.chapter}. TÊN CHƯƠNG`, "TÊN CHƯƠNG")}
            >
              <MaterialIcon className="text-[15px]" name="library_books" />
              Chương {numbers.chapter}
            </button>
            <button
              className={toolButton}
              title="Thêm Điều mới (đánh số liên tục toàn văn bản)"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlock(`## Điều ${numbers.article}. Tên điều`, "Tên điều")}
            >
              <MaterialIcon className="text-[15px]" name="article" />
              Điều {numbers.article}
            </button>
            <button
              className={toolButton}
              title="Thêm tiêu đề mục nhỏ trong một Điều"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlock("### Tên mục", "Tên mục")}
            >
              <MaterialIcon className="text-[15px]" name="title" />
              Mục
            </button>
            <button
              className={toolButton}
              title="Gạch đầu dòng cho các dòng đang chọn"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => prefixLines("ul")}
            >
              <MaterialIcon className="text-[15px]" name="format_list_bulleted" />
              Gạch đầu dòng
            </button>
            <button
              className={toolButton}
              title="Đánh số 1. 2. 3. cho các dòng đang chọn"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => prefixLines("ol")}
            >
              <MaterialIcon className="text-[15px]" name="format_list_numbered" />
              Đánh số
            </button>
            <button
              className={toolButton}
              title="In đậm chữ đang chọn"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={makeBold}
            >
              <MaterialIcon className="text-[15px]" name="format_bold" />
              Đậm
            </button>
            <input ref={fileRef} accept={POST_IMAGE_ACCEPT} className="hidden" type="file" onChange={(e) => void handleImage(e.target.files?.[0])} />
            <button
              className={toolButton}
              disabled={uploading}
              title="Tải ảnh lên và chèn vào vị trí con trỏ"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={pickImage}
            >
              <MaterialIcon className={`text-[15px] ${uploading ? "animate-spin" : ""}`} name={uploading ? "progress_activity" : "image"} />
              {uploading ? "Đang tải ảnh..." : "Chèn ảnh"}
            </button>
            {!content.trim() ? (
              <button
                className={`${toolButton} border-dashed`}
                title="Chèn khung Chương / Điều gợi ý để điền nội dung"
                type="button"
                onClick={() => updateContent(STARTER_OUTLINE, 0)}
              >
                <MaterialIcon className="text-[15px]" name="auto_awesome" />
                Chèn khung mẫu
              </button>
            ) : null}
          </div>

          <textarea
            ref={contentRef}
            className="min-h-[50vh] w-full resize-y rounded-xl border border-slate-300 p-3 font-mono text-[13px] leading-relaxed text-slate-800 focus:border-[#173A67] focus:outline-hidden focus:ring-2 focus:ring-[#173A67]/20 lg:h-[calc(100dvh-380px)] lg:min-h-[360px]"
            placeholder={"# Chương I. QUY ĐỊNH CHUNG\n\n## Điều 1. Phạm vi điều chỉnh\nNội dung điều...\n- Gạch đầu dòng\n1. Đánh số"}
            spellCheck={false}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              touch();
            }}
          />
          <p className="text-[11px] leading-snug text-slate-500">
            Mỗi dòng bắt đầu bằng <code className="rounded bg-slate-100 px-1"># </code> là Chương,{" "}
            <code className="rounded bg-slate-100 px-1">## </code> là Điều, <code className="rounded bg-slate-100 px-1">### </code>{" "}
            là mục nhỏ; <code className="rounded bg-slate-100 px-1">- </code> gạch đầu dòng,{" "}
            <code className="rounded bg-slate-100 px-1">1. </code> đánh số, <code className="rounded bg-slate-100 px-1">**chữ**</code> in
            đậm. Dòng trống tách đoạn. Ảnh hiện thành dòng <code className="rounded bg-slate-100 px-1">![Ảnh](đường dẫn)</code>, không sửa
            đường dẫn. {content.length.toLocaleString("vi-VN")} ký tự.
          </p>
        </section>

        <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-[#d2dfe9] bg-white p-3">
          <div className="flex items-center gap-1.5" role="tablist">
            {(
              [
                { key: "preview", label: "Xem trước", icon: "visibility" },
                { key: "outline", label: `Mục lục (${outline.length})`, icon: "toc" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                aria-selected={panel === tab.key}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                  panel === tab.key
                    ? "border-[#4a6b82] bg-[#4a6b82] text-white"
                    : "border-[#d2dfe9] bg-white text-[#4a6b82] hover:bg-[#ecf4ff]"
                }`}
                role="tab"
                type="button"
                onClick={() => setPanel(tab.key)}
              >
                <MaterialIcon className="text-[14px]" name={tab.icon} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="max-h-[70vh] min-h-[200px] overflow-y-auto rounded-xl border border-dusty-border/60 p-4 lg:h-[calc(100dvh-380px)] lg:max-h-none lg:min-h-[360px]">
            {panel === "preview" ? (
              <>
                <div className="border-b border-dusty-border/70 pb-3 text-center">
                  <h2 className="text-lg font-extrabold uppercase text-[#173A67]">{title.trim() || "Quy chế chi tiêu"}</h2>
                  {previewMeta.length > 0 ? <p className="mt-1 text-sm text-on-surface-variant">{previewMeta.join(" · ")}</p> : null}
                </div>
                {content.trim() ? (
                  <RegulationContent className="mt-4" content={content} />
                ) : (
                  <p className="py-10 text-center text-sm font-semibold text-on-surface-variant">Chưa có nội dung</p>
                )}
              </>
            ) : outline.length === 0 ? (
              <p className="py-10 text-center text-sm text-on-surface-variant">
                Chưa có Chương / Điều nào. Bấm <strong>Chương</strong> hoặc <strong>Điều</strong> trên thanh công cụ để thêm.
              </p>
            ) : (
              <ul className="space-y-0.5 text-sm">
                {outline.map((h) => (
                  <li key={h.anchor} className={h.level === 1 ? "pt-1.5 font-bold" : h.level === 2 ? "pl-4" : "pl-8 text-xs"}>
                    <button
                      className="w-full truncate rounded px-1 py-0.5 text-left text-[#27496D] hover:bg-[#ecf4ff] hover:text-primary"
                      title="Đến dòng này trong ô soạn thảo"
                      type="button"
                      onClick={() => jumpToLine(h.line, h.anchor)}
                    >
                      {h.text.replace(/\*\*/g, "")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </form>
  );
}
