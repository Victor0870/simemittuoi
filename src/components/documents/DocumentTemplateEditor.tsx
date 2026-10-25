"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  DEFAULT_DOCUMENT_ORG_SETTINGS,
  SYSTEM_SETTING_TOKENS,
  type DocumentOrgSettings,
} from "@/lib/documents/settings";
import {
  DOCUMENT_HEADING_UPPER,
  DOCUMENT_TEMPLATE_LIMITS,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  PRESET_ARTICLES,
  STANDARD_TEMPLATE_FIELDS,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABEL,
  TEMPLATE_FIELD_TYPES,
  TEMPLATE_FIELD_TYPE_LABEL,
  extractPlaceholders,
  formatTemplateNameWithCategory,
  getTemplateCategory,
  getTemplateDisplayName,
  parseStructuredDocument,
  parseTemplateFields,
  placeholderToken,
  previewDocumentWithOrgSettings,
  serializeStructuredDocument,
  toTemplateFieldKey,
  type DecisionArticle,
  type DocumentTemplate,
  type DocumentType,
  type StructuredDocument,
  type TemplateCategory,
  type TemplateField,
  type TemplateFieldType,
} from "@/lib/documents/templates";

export type TemplateDraft = {
  id?: string;
  name: string;
  category?: TemplateCategory;
  docType: DocumentType;
  body: string;
  fields: TemplateField[];
  isActive: boolean;
};

type EditorMode = "structured" | "raw" | "preview";

type Props = {
  initial: TemplateDraft;
  orgSettings?: DocumentOrgSettings;
  onOpenSettings?: () => void;
  onClose: () => void;
  onSaved: (template: DocumentTemplate, created: boolean) => void;
};

const inputClass =
  "w-full rounded-lg border border-outline-variant bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#173A67]";
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";
const fieldControlClass =
  "h-7 rounded-lg border border-outline-variant bg-white px-2 text-xs outline-none focus:border-[#173A67]";
const iconButton =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-[#173A67] disabled:opacity-30";

/**
 * Hộp soạn mẫu văn bản:
 * - Hỗ trợ phân loại "Mẫu chuẩn (QĐ 933)" và "Mẫu tùy chỉnh".
 * - Cho phép mở một Mẫu chuẩn lên sửa Căn cứ / Các Điều / Nội dung rồi bấm "Lưu thành Mẫu tùy chỉnh"
 *   (tạo mẫu tùy chỉnh mới mà vẫn giữ nguyên mẫu chuẩn gốc).
 */
export function DocumentTemplateEditor({
  initial,
  orgSettings = DEFAULT_DOCUMENT_ORG_SETTINGS,
  onOpenSettings,
  onClose,
  onSaved,
}: Props) {
  const initialCategory: TemplateCategory = initial.category ?? getTemplateCategory(initial.name);
  const [category, setCategory] = useState<TemplateCategory>(initialCategory);
  const [displayName, setDisplayName] = useState<string>(() => getTemplateDisplayName(initial.name));

  const [draft, setDraft] = useState<TemplateDraft>(() => {
    if (!initial.body.trim() && (initial.docType === "quyet_dinh" || initial.docType === "quy_dinh")) {
      const defaultStruct = parseStructuredDocument("", initial.docType);
      return {
        ...initial,
        body: serializeStructuredDocument(initial.docType, defaultStruct),
      };
    }
    return initial;
  });

  const [structured, setStructured] = useState<StructuredDocument>(() =>
    parseStructuredDocument(draft.body, draft.docType),
  );
  const [mode, setMode] = useState<EditorMode>(() => {
    const hasArticles = /(^|\n)\s*Điều\s+\d+\s*[.:]/i.test(draft.body);
    if (hasArticles || (!draft.body.trim() && (initial.docType === "quyet_dinh" || initial.docType === "quy_dinh"))) {
      return "structured";
    }
    return "raw";
  });
  const [activeArticleIndex, setActiveArticleIndex] = useState<number>(0);
  const [showPresetBases, setShowPresetBases] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const articleContentRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const isNew = !initial.id;
  const isEditingExistingStandard = !isNew && initialCategory === "standard";
  const dirty =
    displayName !== getTemplateDisplayName(initial.name) ||
    category !== initialCategory ||
    JSON.stringify({ ...draft, name: "" }) !== JSON.stringify({ ...initial, name: "" });

  const placeholders = extractPlaceholders(draft.body);
  const fieldKeys = new Set(draft.fields.map((f) => f.key));
  const missingFields = placeholders.filter((key) => !fieldKeys.has(key));
  const unusedFields = draft.fields.filter((f) => f.key && !placeholders.includes(f.key));

  function syncStructuredToBody(nextStruct: StructuredDocument, docType = draft.docType) {
    setStructured(nextStruct);
    const nextBody = serializeStructuredDocument(docType, nextStruct);
    setDraft((d) => ({ ...d, docType, body: nextBody }));
  }

  function switchMode(nextMode: EditorMode) {
    if (nextMode === "structured" && mode === "raw") {
      setStructured(parseStructuredDocument(draft.body, draft.docType));
    }
    setMode(nextMode);
  }

  function requestClose() {
    if (dirty && !window.confirm("Đóng mà không lưu các thay đổi?")) return;
    onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // --- Quản lý Căn cứ (Thêm / Bớt / Sắp xếp) ---
  function updateBase(index: number, value: string) {
    const nextBases = structured.bases.map((b, i) => (i === index ? value : b));
    syncStructuredToBody({ ...structured, bases: nextBases });
  }

  function addBase(text = "Căn cứ ") {
    syncStructuredToBody({ ...structured, bases: [...structured.bases, text] });
  }

  function removeBase(index: number) {
    syncStructuredToBody({
      ...structured,
      bases: structured.bases.filter((_, i) => i !== index),
    });
  }

  function moveBase(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= structured.bases.length) return;
    const nextBases = [...structured.bases];
    [nextBases[index], nextBases[target]] = [nextBases[target], nextBases[index]];
    syncStructuredToBody({ ...structured, bases: nextBases });
  }

  // --- Quản lý Các Điều (Thêm / Bớt / Sắp xếp / Nhập nội dung) ---
  function updateArticle(index: number, patch: Partial<DecisionArticle>) {
    const nextArticles = structured.articles.map((art, i) => (i === index ? { ...art, ...patch } : art));
    syncStructuredToBody({ ...structured, articles: nextArticles });
  }

  function addArticle(article: DecisionArticle = { title: "", content: "" }) {
    const nextArticles = [...structured.articles, { ...article }];
    syncStructuredToBody({ ...structured, articles: nextArticles });
    setActiveArticleIndex(nextArticles.length - 1);
  }

  function removeArticle(index: number) {
    if (structured.articles.length <= 1) {
      updateArticle(0, { title: "", content: "" });
      return;
    }
    const nextArticles = structured.articles.filter((_, i) => i !== index);
    syncStructuredToBody({ ...structured, articles: nextArticles });
    setActiveArticleIndex(Math.max(0, Math.min(activeArticleIndex, nextArticles.length - 1)));
  }

  function moveArticle(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= structured.articles.length) return;
    const nextArticles = [...structured.articles];
    [nextArticles[index], nextArticles[target]] = [nextArticles[target], nextArticles[index]];
    syncStructuredToBody({ ...structured, articles: nextArticles });
    setActiveArticleIndex(target);
  }

  // --- Quản lý Danh sách Trường (Fields) ---
  function setField(index: number, patch: Partial<TemplateField>) {
    setDraft((d) => ({ ...d, fields: d.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) }));
  }

  function moveField(index: number, delta: -1 | 1) {
    setDraft((d) => {
      const next = [...d.fields];
      const target = index + delta;
      if (target < 0 || target >= next.length) return d;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...d, fields: next };
    });
  }

  function addField(field?: Partial<TemplateField>) {
    setDraft((d) => ({
      ...d,
      fields: [...d.fields, { key: "", label: "", type: "text", required: false, ...field }],
    }));
  }

  function addStandardFields() {
    setDraft((d) => {
      const keys = new Set(d.fields.map((f) => f.key));
      return {
        ...d,
        fields: [
          ...d.fields,
          ...STANDARD_TEMPLATE_FIELDS.filter((f) => !keys.has(f.key)).map((f) => ({ ...f })),
        ],
      };
    });
  }

  function insertPlaceholder(key: string) {
    const token = placeholderToken(key);
    if (mode === "structured") {
      const targetIdx = Math.min(activeArticleIndex, structured.articles.length - 1);
      if (targetIdx >= 0) {
        const el = articleContentRefs.current[targetIdx];
        const currentContent = structured.articles[targetIdx]?.content ?? "";
        const start = el?.selectionStart ?? currentContent.length;
        const end = el?.selectionEnd ?? currentContent.length;
        const nextContent = currentContent.slice(0, start) + token + currentContent.slice(end);
        updateArticle(targetIdx, { content: nextContent });
        requestAnimationFrame(() => {
          if (!el) return;
          el.focus();
          el.setSelectionRange(start + token.length, start + token.length);
        });
        return;
      }
    }

    const el = bodyRef.current;
    const start = el?.selectionStart ?? draft.body.length;
    const end = el?.selectionEnd ?? draft.body.length;
    const base = el?.value ?? draft.body;
    setDraft((d) => ({ ...d, body: base.slice(0, start) + token + base.slice(end) }));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save(saveAsNewCustom = false) {
    const cleanTitle = displayName.trim();
    if (!cleanTitle) {
      setError("Vui lòng nhập tên mẫu.");
      return;
    }
    const parsed = parseTemplateFields(draft.fields);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }

    const targetCategory: TemplateCategory = saveAsNewCustom ? "custom" : category;
    const rawForFormat = targetCategory === "standard" && initialCategory === "standard" ? initial.name : cleanTitle;
    const finalName =
      targetCategory === "standard"
        ? formatTemplateNameWithCategory(
            rawForFormat.startsWith("[") ? rawForFormat.replace(/\].*$/, `] ${cleanTitle}`) : cleanTitle,
            "standard",
          )
        : formatTemplateNameWithCategory(cleanTitle, "custom");

    const createNewRecord = isNew || saveAsNewCustom;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(createNewRecord ? "/api/documents/templates" : `/api/documents/templates/${initial.id}`, {
        method: createNewRecord ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName,
          docType: draft.docType,
          body: draft.body,
          fields: parsed.fields,
          isActive: draft.isActive,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; template?: DocumentTemplate };
      if (!res.ok || !data.template) throw new Error(data.error || "Không lưu được mẫu văn bản.");
      onSaved(data.template, createNewRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được mẫu văn bản.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      aria-labelledby="document-template-editor-title"
      aria-modal="true"
      className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-3"
      role="dialog"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-bg shadow-xl sm:h-auto sm:max-h-[95dvh] sm:max-w-7xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant bg-white px-4 py-2.5">
          <MaterialIcon className="text-[22px] text-[#173A67]" name="description" />
          <h2 id="document-template-editor-title" className="text-base font-extrabold text-[#173A67]">
            {isNew
              ? "Thêm mẫu văn bản"
              : isEditingExistingStandard
                ? "Xem / Tùy chỉnh từ Mẫu chuẩn (QĐ 933/QĐ-TLĐ)"
                : "Sửa mẫu văn bản tùy chỉnh"}
          </h2>
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[11px] font-bold shadow-2xs ${
              category === "standard"
                ? "border-sky-200 bg-sky-100/80 text-sky-900"
                : "border-amber-200 bg-amber-100/80 text-amber-900"
            }`}
          >
            <MaterialIcon
              className={`text-[13px] ${category === "standard" ? "text-sky-700" : "text-amber-700"}`}
              name={category === "standard" ? "menu_book" : "tune"}
            />
            {TEMPLATE_CATEGORY_LABEL[category]}
          </span>
          {dirty ? <span className="text-xs font-semibold text-amber-700">Chưa lưu</span> : null}
          <div className="ml-auto flex items-center gap-2">
            {onOpenSettings ? (
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-[#d2dfe9] bg-[#ecf4ff] px-2.5 py-1 text-xs font-bold text-[#173A67] hover:border-[#173A67]"
                title="Cài đặt các thông tin cố định của Công ty / Công đoàn"
                type="button"
                onClick={onOpenSettings}
              >
                <MaterialIcon className="text-[16px]" name="settings" />
                Cài đặt cố định (Đơn vị)
              </button>
            ) : null}
            <button aria-label="Đóng" className={iconButton} type="button" onClick={requestClose}>
              <MaterialIcon className="text-[20px]" name="close" />
            </button>
          </div>
        </div>

        {isEditingExistingStandard ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#c5d9f0] bg-[#eef5ff] px-4 py-2 text-xs text-[#173A67]">
            <MaterialIcon className="text-[18px]" name="info" />
            <span>
              Đây là <strong>Mẫu chuẩn (QĐ 933/QĐ-TLĐ)</strong>. Bạn có thể sửa tên, thêm/bớt Căn cứ, thêm/bớt các Điều rồi bấm{" "}
              <strong>“Lưu thành Mẫu tùy chỉnh mới”</strong> ở góc dưới để tạo mẫu riêng cho đơn vị (mẫu chuẩn gốc vẫn giữ nguyên).
            </span>
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-3">
            {/* Thông tin tên mẫu, nhóm mẫu & loại văn bản */}
            <div className="grid gap-3 rounded-xl border border-[#d2dfe9] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_175px_185px]">
              <div>
                <label className={labelClass} htmlFor="tpl-name">
                  Tên mẫu văn bản *
                </label>
                <input
                  className={inputClass}
                  id="tpl-name"
                  maxLength={DOCUMENT_TEMPLATE_LIMITS.name - 30}
                  placeholder="VD: Quyết định tổ chức cuộc thi cắm hoa 20/10"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="tpl-category">
                  Nhóm mẫu *
                </label>
                <select
                  className={inputClass}
                  id="tpl-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                >
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {TEMPLATE_CATEGORY_LABEL[cat]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="tpl-type">
                  Loại văn bản *
                </label>
                <select
                  className={inputClass}
                  id="tpl-type"
                  value={draft.docType}
                  onChange={(e) => {
                    const nextType = e.target.value as DocumentType;
                    if (mode === "structured") {
                      syncStructuredToBody(structured, nextType);
                    } else {
                      setDraft({ ...draft, docType: nextType });
                    }
                  }}
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {DOCUMENT_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                  <input
                    checked={draft.isActive}
                    type="checkbox"
                    onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                  />
                  Đang dùng
                  <span className="text-xs font-normal text-on-surface-variant">
                    (bỏ chọn để ngừng dùng; mẫu không bị xóa)
                  </span>
                </label>

                <div className="inline-flex rounded-lg border border-[#d2dfe9] bg-surface-container-low p-0.5">
                  <button
                    className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                      mode === "structured"
                        ? "bg-[#173A67] text-white shadow-sm"
                        : "text-on-surface-variant hover:text-[#173A67]"
                    }`}
                    type="button"
                    onClick={() => switchMode("structured")}
                  >
                    Bố cục Căn cứ & Các Điều
                  </button>
                  <button
                    className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                      mode === "preview"
                        ? "bg-[#173A67] text-white shadow-sm"
                        : "text-on-surface-variant hover:text-[#173A67]"
                    }`}
                    type="button"
                    onClick={() => switchMode("preview")}
                  >
                    Xem trước mẫu in
                  </button>
                  <button
                    className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                      mode === "raw"
                        ? "bg-[#173A67] text-white shadow-sm"
                        : "text-on-surface-variant hover:text-[#173A67]"
                    }`}
                    type="button"
                    onClick={() => switchMode("raw")}
                  >
                    Văn bản thô
                  </button>
                </div>
              </div>
            </div>

            {/* Thanh công cụ chèn nhanh chỗ trống {{khoa}} */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#d2dfe9] bg-white px-3 py-2">
              <span className="text-xs font-bold text-[#173A67]">Chèn chỗ trống:</span>
              {draft.fields
                .filter((f) => f.key)
                .map((f) => (
                  <button
                    key={f.key}
                    className="rounded-md border border-[#d2dfe9] bg-[#ecf4ff] px-1.5 py-0.5 font-mono text-[11px] text-[#173A67] hover:border-[#173A67]"
                    title={`Chèn ${placeholderToken(f.key)} (${f.label || f.key}) vào ô đang chọn`}
                    type="button"
                    onClick={() => insertPlaceholder(f.key)}
                  >
                    {placeholderToken(f.key)}
                  </button>
                ))}
              <span className="ml-1 text-[11px] text-on-surface-variant">| Biến đơn vị cố định:</span>
              {SYSTEM_SETTING_TOKENS.slice(0, 4).map((t) => (
                <button
                  key={t.token}
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-900 hover:border-emerald-500"
                  title={`${t.label}: ${t.getValue(orgSettings)}`}
                  type="button"
                  onClick={() => insertPlaceholder(t.token.replace(/^\{\{|\}\}$/g, ""))}
                >
                  {t.token}
                </button>
              ))}
            </div>

            {mode === "structured" ? (
              <div className="space-y-3">
                {/* 1. Khung thông tin cố định từ Cài đặt đơn vị */}
                <div className="rounded-xl border border-dashed border-[#9bb6d0] bg-[#f5f9ff] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-[#173A67]">
                      <strong>Phần tiêu đề & chữ ký cố định (lấy tự động từ Cài đặt đơn vị):</strong>
                      <div className="mt-1 grid gap-x-6 gap-y-0.5 text-[11px] text-on-surface-variant sm:grid-cols-2">
                        <span>
                          • Đơn vị: <strong>{orgSettings.parentUnionName}</strong> /{" "}
                          <strong>{orgSettings.unionHeaderName}</strong>
                        </span>
                        <span>
                          • Quốc hiệu & Địa danh: <strong>{orgSettings.defaultLocation}, ngày {"{{ngay}}"}</strong>
                        </span>
                        <span>
                          • Số hiệu: <strong>Số: {"{{so_van_ban}}"}{orgSettings.decisionCodeSuffix}</strong>
                        </span>
                        <span>
                          • Ký tên: <strong>{orgSettings.signAuthority} — {orgSettings.signerTitle}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Trích yếu V/v */}
                <div className="rounded-xl border border-[#d2dfe9] bg-white p-3">
                  <label className={labelClass} htmlFor="struct-subject">
                    Trích yếu văn bản (V/v) *
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-lg bg-[#ecf4ff] px-2.5 py-1.5 text-xs font-bold text-[#173A67]">
                      V/v:
                    </span>
                    <input
                      className={inputClass}
                      id="struct-subject"
                      placeholder="VD: Tổ chức Cuộc thi Cắm hoa chào mừng Ngày Phụ nữ Việt Nam 20/10"
                      value={structured.subject}
                      onChange={(e) => syncStructuredToBody({ ...structured, subject: e.target.value })}
                    />
                  </div>
                </div>

                {/* 3. Danh sách Căn cứ (Thêm / Bớt tự do) */}
                <div className="rounded-xl border border-[#d2dfe9] bg-white p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#173A67]">
                        Các phần Căn cứ ({structured.bases.length})
                      </h3>
                      <p className="text-[11px] text-on-surface-variant">
                        Có thể thêm, bớt, sửa hoặc đổi thứ tự từng dòng Căn cứ cho phù hợp với từng Quyết định.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        className="inline-flex items-center gap-1 rounded-lg border border-[#d2dfe9] bg-[#ecf4ff] px-2.5 py-1 text-xs font-bold text-[#173A67] hover:border-[#173A67]"
                        type="button"
                        onClick={() => setShowPresetBases((v) => !v)}
                      >
                        <MaterialIcon className="text-[16px]" name="library_add" />
                        Chọn Căn cứ chuẩn ({orgSettings.defaultBases.length})
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-lg bg-[#173A67] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#1E4A7D]"
                        type="button"
                        onClick={() => addBase("Căn cứ ")}
                      >
                        <MaterialIcon className="text-[16px]" name="add" />
                        Thêm căn cứ
                      </button>
                    </div>
                  </div>

                  {showPresetBases ? (
                    <div className="mb-3 rounded-lg border border-[#d2dfe9] bg-[#f8fbff] p-2.5">
                      <p className="mb-1.5 text-[11px] font-bold text-[#173A67]">
                        Bấm vào dòng Căn cứ chuẩn để thêm vào văn bản:
                      </p>
                      <div className="space-y-1">
                        {orgSettings.defaultBases.map((preset, idx) => {
                          const exists = structured.bases.includes(preset);
                          return (
                            <button
                              key={idx}
                              className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1 text-left text-xs transition ${
                                exists
                                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                                  : "border-outline-variant/60 bg-white text-on-surface hover:border-[#173A67] hover:bg-[#ecf4ff]"
                              }`}
                              type="button"
                              onClick={() => {
                                if (!exists) addBase(preset);
                              }}
                            >
                              <span className="line-clamp-1">{preset}</span>
                              <span className="shrink-0 text-[11px] font-bold text-[#173A67]">
                                {exists ? "Đã có" : "+ Thêm"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {structured.bases.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-outline-variant py-4 text-center text-xs text-on-surface-variant">
                      Chưa có dòng Căn cứ nào. Bấm “+ Thêm căn cứ” hoặc “Chọn Căn cứ chuẩn” để thêm.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {structured.bases.map((base, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span className="mt-1.5 w-6 shrink-0 text-center text-xs font-bold text-on-surface-variant">
                            {idx + 1}.
                          </span>
                          <input
                            className={inputClass}
                            placeholder="Căn cứ..."
                            value={base}
                            onChange={(e) => updateBase(idx, e.target.value)}
                          />
                          <button
                            aria-label="Lên"
                            className={iconButton}
                            disabled={idx === 0}
                            title="Đưa căn cứ lên"
                            type="button"
                            onClick={() => moveBase(idx, -1)}
                          >
                            <MaterialIcon className="text-[18px]" name="arrow_upward" />
                          </button>
                          <button
                            aria-label="Xuống"
                            className={iconButton}
                            disabled={idx === structured.bases.length - 1}
                            title="Đưa căn cứ xuống"
                            type="button"
                            onClick={() => moveBase(idx, 1)}
                          >
                            <MaterialIcon className="text-[18px]" name="arrow_downward" />
                          </button>
                          <button
                            aria-label="Xóa căn cứ"
                            className={`${iconButton} hover:text-error`}
                            title="Xóa (bớt) căn cứ này"
                            type="button"
                            onClick={() => removeBase(idx)}
                          >
                            <MaterialIcon className="text-[18px]" name="delete" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Danh sách Các Điều (Thêm / Bớt tự do + Ô nhập nội dung) */}
                <div className="rounded-xl border border-[#d2dfe9] bg-white p-3">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#173A67]">
                        Nội dung các Điều ({structured.articles.length} Điều)
                      </h3>
                      <p className="text-[11px] text-on-surface-variant">
                        Thêm / bớt các Điều tùy ý; mỗi Điều có ô nhập Tiêu đề và ô nhập Nội dung chi tiết.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {PRESET_ARTICLES.map((p, idx) => (
                        <button
                          key={idx}
                          className="rounded-lg border border-[#d2dfe9] bg-[#ecf4ff] px-2 py-1 text-[11px] font-bold text-[#173A67] hover:border-[#173A67]"
                          type="button"
                          onClick={() => addArticle(p.article)}
                        >
                          {p.label}
                        </button>
                      ))}
                      <button
                        className="inline-flex items-center gap-1 rounded-lg bg-[#173A67] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#1E4A7D]"
                        type="button"
                        onClick={() => addArticle({ title: "", content: "" })}
                      >
                        <MaterialIcon className="text-[16px]" name="add" />
                        Thêm Điều mới
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {structured.articles.map((art, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl border p-3 transition ${
                          activeArticleIndex === idx
                            ? "border-[#173A67] bg-[#f8fbff]"
                            : "border-outline-variant/80 bg-surface-container-lowest"
                        }`}
                        onClick={() => setActiveArticleIndex(idx)}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className="shrink-0 rounded-lg bg-[#173A67] px-2.5 py-1 text-xs font-extrabold text-white">
                            Điều {idx + 1}
                          </span>
                          <input
                            className={`${inputClass} font-semibold`}
                            placeholder={`Tiêu đề Điều ${idx + 1} (VD: Tổ chức thực hiện, Kinh phí hỗ trợ...)`}
                            value={art.title}
                            onChange={(e) => updateArticle(idx, { title: e.target.value })}
                          />
                          <button
                            aria-label="Đưa Điều lên"
                            className={iconButton}
                            disabled={idx === 0}
                            title="Đưa Điều lên"
                            type="button"
                            onClick={() => moveArticle(idx, -1)}
                          >
                            <MaterialIcon className="text-[18px]" name="arrow_upward" />
                          </button>
                          <button
                            aria-label="Xuống"
                            className={iconButton}
                            disabled={idx === structured.articles.length - 1}
                            title="Đưa Điều xuống"
                            type="button"
                            onClick={() => moveArticle(idx, 1)}
                          >
                            <MaterialIcon className="text-[18px]" name="arrow_downward" />
                          </button>
                          <button
                            aria-label={`Xóa Điều ${idx + 1}`}
                            className={`${iconButton} hover:text-error`}
                            title={`Xóa (bớt) Điều ${idx + 1}`}
                            type="button"
                            onClick={() => removeArticle(idx)}
                          >
                            <MaterialIcon className="text-[18px]" name="delete" />
                          </button>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-on-surface-variant">
                            Nội dung chi tiết của Điều {idx + 1}:
                          </label>
                          <textarea
                            ref={(el) => {
                              articleContentRefs.current[idx] = el;
                            }}
                            className={`${inputClass} min-h-[88px] resize-y text-[13px] leading-relaxed`}
                            placeholder={`Nhập nội dung quy định tại Điều ${idx + 1}... (có thể bấm nút {{khoa}} ở trên để chèn chỗ trống)`}
                            rows={3}
                            value={art.content}
                            onFocus={() => setActiveArticleIndex(idx)}
                            onChange={(e) => updateArticle(idx, { content: e.target.value })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/60 pt-2.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-on-surface">
                      <input
                        checked={structured.includeRecipients}
                        type="checkbox"
                        onChange={(e) =>
                          syncStructuredToBody({ ...structured, includeRecipients: e.target.checked })
                        }
                      />
                      Hiển thị khối “Nơi nhận” ở cuối văn bản ({orgSettings.defaultRecipients.join(" ")})
                    </label>
                    <button
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[#173A67] px-3 py-1 text-xs font-bold text-[#173A67] hover:bg-[#ecf4ff]"
                      type="button"
                      onClick={() => addArticle({ title: "", content: "" })}
                    >
                      <MaterialIcon className="text-[16px]" name="add" />
                      Thêm Điều {structured.articles.length + 1}
                    </button>
                  </div>
                </div>
              </div>
            ) : mode === "preview" ? (
              /* Chế độ Xem trước văn bản hành chính đã ghép Cài đặt đơn vị */
              <div className="rounded-xl border border-[#d2dfe9] bg-white p-5 shadow-inner sm:p-7">
                <div className="mx-auto max-w-3xl font-serif text-[14px] leading-relaxed text-black">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-[12px] font-semibold uppercase">{orgSettings.parentUnionName}</p>
                      <p className="text-[12px] font-bold uppercase underline underline-offset-4">
                        {orgSettings.unionHeaderName}
                      </p>
                      <p className="mt-2 text-[13px]">
                        Số: <span className="rounded bg-amber-100 px-1 font-mono text-xs">{"{{so_van_ban}}"}</span>
                        {orgSettings.decisionCodeSuffix}
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] font-bold uppercase">{orgSettings.nationalHeader}</p>
                      <p className="text-[13px] font-bold underline underline-offset-4">{orgSettings.nationalMotto}</p>
                      <p className="mt-2 text-[13px] italic">
                        {orgSettings.defaultLocation}, ngày{" "}
                        <span className="rounded bg-amber-100 px-1 font-mono text-xs not-italic">{"{{ngay}}"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="my-5 whitespace-pre-line font-serif text-[14px]">
                    {previewDocumentWithOrgSettings(draft.body, orgSettings)
                      .split("\n")
                      .slice(6)
                      .join("\n")}
                  </div>
                </div>
              </div>
            ) : (
              /* Chế độ Văn bản thô (raw textarea) */
              <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-[#d2dfe9] bg-white p-3">
                <textarea
                  ref={bodyRef}
                  className={`${inputClass} min-h-[300px] flex-1 resize-y font-mono text-[13px] leading-relaxed lg:min-h-[380px]`}
                  id="tpl-body"
                  maxLength={DOCUMENT_TEMPLATE_LIMITS.body}
                  placeholder={
                    "Số: {{so_van_ban}}\n{{dia_danh}}, ngày {{ngay}}\n\nQUYẾT ĐỊNH\n...\n{{noi_dung}}\n\nNGƯỜI KÝ\n{{nguoi_ky}}"
                  }
                  spellCheck={false}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
                <p className="text-[11px] leading-relaxed text-on-surface-variant">
                  Chỗ cần điền khi soạn văn bản ghi dạng <code>{"{{khoa}}"}</code> trùng khóa trong danh sách trường.
                </p>
              </div>
            )}

            {missingFields.length ? (
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                <MaterialIcon className="text-[16px] text-amber-700" name="warning" />
                <span>Chỗ trống chưa có trong danh sách trường nhập:</span>
                {missingFields.map((key) => (
                  <button
                    key={key}
                    className="rounded-md border border-amber-400 bg-white px-1.5 py-0.5 font-mono text-[11px] hover:bg-amber-100"
                    title="Bấm để thêm trường nhập cho chỗ trống này"
                    type="button"
                    onClick={() => addField({ key, label: key })}
                  >
                    + {key}
                  </button>
                ))}
              </div>
            ) : null}
            {unusedFields.length ? (
              <p className="text-[11px] text-on-surface-variant">
                Trường chưa chèn vào nội dung: {unusedFields.map((f) => f.key).join(", ")}
              </p>
            ) : null}
          </div>

          {/* Cột phải: Danh sách các trường nhập (ô nhập dữ liệu động khi soạn văn bản) */}
          <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[#d2dfe9] bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-[#173A67]">Các ô nhập thông tin ({draft.fields.length})</p>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2 py-1 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
                  title="Thêm các trường chuẩn: Số văn bản, Ngày ban hành, Người ký"
                  type="button"
                  onClick={addStandardFields}
                >
                  <MaterialIcon className="text-[16px]" name="playlist_add" />
                  Trường chuẩn
                </button>
                <button
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-outline-variant px-2 py-1 text-xs font-semibold text-[#173A67] hover:border-[#173A67] disabled:opacity-50"
                  disabled={draft.fields.length >= DOCUMENT_TEMPLATE_LIMITS.fields}
                  type="button"
                  onClick={() => addField()}
                >
                  <MaterialIcon className="text-[16px]" name="add" />
                  Thêm ô nhập
                </button>
              </div>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Mỗi trường ở đây sẽ tạo thành một ô nhập liệu khi soạn văn bản (VD: Số văn bản, Ngày ban hành, Số tiền hỗ trợ, Thời gian tổ chức...).
            </p>

            {draft.fields.length === 0 ? (
              <p className="rounded-lg border border-dashed border-outline-variant px-3 py-6 text-center text-xs text-on-surface-variant">
                Chưa có trường nào.
              </p>
            ) : (
              <ol className="space-y-1.5 lg:max-h-[64dvh] lg:overflow-y-auto lg:pr-1">
                {draft.fields.map((f, index) => (
                  <li key={index} className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 shrink-0 text-center text-[11px] font-bold text-on-surface-variant">
                        {index + 1}
                      </span>
                      <input
                        aria-label={`Nhãn trường ${index + 1}`}
                        className={`${fieldControlClass} min-w-0 flex-1`}
                        maxLength={DOCUMENT_TEMPLATE_LIMITS.fieldLabel}
                        placeholder="Tên ô nhập (VD: Mức hỗ trợ)"
                        value={f.label}
                        onBlur={() => {
                          if (!f.key && f.label.trim()) setField(index, { key: toTemplateFieldKey(f.label) });
                        }}
                        onChange={(e) => setField(index, { label: e.target.value })}
                      />
                      <button
                        aria-label="Lên"
                        className={iconButton}
                        disabled={index === 0}
                        type="button"
                        onClick={() => moveField(index, -1)}
                      >
                        <MaterialIcon className="text-[18px]" name="arrow_upward" />
                      </button>
                      <button
                        aria-label="Xuống"
                        className={iconButton}
                        disabled={index === draft.fields.length - 1}
                        type="button"
                        onClick={() => moveField(index, 1)}
                      >
                        <MaterialIcon className="text-[18px]" name="arrow_downward" />
                      </button>
                      <button
                        aria-label={`Xóa trường ${f.label || index + 1}`}
                        className={`${iconButton} hover:text-error`}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, fields: d.fields.filter((_, i) => i !== index) }))}
                      >
                        <MaterialIcon className="text-[18px]" name="delete" />
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 pl-6">
                      <input
                        aria-label={`Khóa trường ${index + 1}`}
                        className={`${fieldControlClass} min-w-0 flex-1 font-mono ${
                          f.key && !/^[a-z][a-z0-9_]*$/.test(f.key) ? "border-error" : ""
                        }`}
                        maxLength={DOCUMENT_TEMPLATE_LIMITS.fieldKey}
                        placeholder="khoa_truong"
                        value={f.key}
                        onChange={(e) => setField(index, { key: e.target.value.trim() })}
                      />
                      <select
                        aria-label={`Kiểu nhập trường ${index + 1}`}
                        className={`${fieldControlClass} w-[115px] shrink-0`}
                        value={f.type}
                        onChange={(e) => setField(index, { type: e.target.value as TemplateFieldType })}
                      >
                        {TEMPLATE_FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {TEMPLATE_FIELD_TYPE_LABEL[type]}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-on-surface-variant">
                        <input
                          checked={f.required}
                          type="checkbox"
                          onChange={(e) => setField(index, { required: e.target.checked })}
                        />
                        Bắt buộc
                      </label>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-outline-variant bg-white px-4 py-2.5">
          {error ? <p className="mr-auto text-xs font-semibold text-error">{error}</p> : <span className="mr-auto" />}
          <button
            className="rounded-lg border border-outline-variant px-4 py-1.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
            type="button"
            onClick={requestClose}
          >
            Hủy
          </button>

          {isEditingExistingStandard ? (
            <>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#173A67] bg-white px-3.5 py-1.5 text-sm font-bold text-[#173A67] transition hover:bg-[#ecf4ff] disabled:opacity-60"
                disabled={saving}
                title="Cập nhật trực tiếp vào mẫu chuẩn này"
                type="button"
                onClick={() => void save(false)}
              >
                <MaterialIcon className="text-[18px]" name="save" />
                Cập nhật mẫu chuẩn gốc
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#173A67] px-4 py-1.5 text-sm font-bold text-white transition hover:bg-[#1E4A7D] disabled:opacity-60"
                disabled={saving}
                title="Giữ nguyên mẫu chuẩn gốc và lưu bản vừa chỉnh sửa thành một Mẫu tùy chỉnh mới"
                type="button"
                onClick={() => void save(true)}
              >
                <MaterialIcon className="text-[18px]" name="library_add" />
                {saving ? "Đang lưu…" : "Lưu thành Mẫu tùy chỉnh mới"}
              </button>
            </>
          ) : (
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#173A67] px-4 py-1.5 text-sm font-bold text-white transition hover:bg-[#1E4A7D] disabled:opacity-60"
              disabled={saving}
              type="button"
              onClick={() => void save(false)}
            >
              <MaterialIcon className="text-[18px]" name="save" />
              {saving ? "Đang lưu…" : isNew ? "Tạo mẫu" : "Lưu mẫu"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
