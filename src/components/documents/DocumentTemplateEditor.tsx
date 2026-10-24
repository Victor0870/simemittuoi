"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  DOCUMENT_TEMPLATE_LIMITS,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  STANDARD_TEMPLATE_FIELDS,
  TEMPLATE_FIELD_TYPES,
  TEMPLATE_FIELD_TYPE_LABEL,
  extractPlaceholders,
  parseTemplateFields,
  placeholderToken,
  toTemplateFieldKey,
  type DocumentTemplate,
  type DocumentType,
  type TemplateField,
  type TemplateFieldType,
} from "@/lib/documents/templates";

export type TemplateDraft = {
  id?: string;
  name: string;
  docType: DocumentType;
  body: string;
  fields: TemplateField[];
  isActive: boolean;
};

type Props = {
  initial: TemplateDraft;
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

/** Hộp soạn mẫu văn bản: thông tin chung, nội dung có chỗ trống {{khoa}} và danh sách trường. */
export function DocumentTemplateEditor({ initial, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<TemplateDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const isNew = !initial.id;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const placeholders = extractPlaceholders(draft.body);
  const fieldKeys = new Set(draft.fields.map((f) => f.key));
  const missingFields = placeholders.filter((key) => !fieldKeys.has(key));
  const unusedFields = draft.fields.filter((f) => f.key && !placeholders.includes(f.key));

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
      return { ...d, fields: [...d.fields, ...STANDARD_TEMPLATE_FIELDS.filter((f) => !keys.has(f.key)).map((f) => ({ ...f }))] };
    });
  }

  function insertPlaceholder(key: string) {
    const el = bodyRef.current;
    const token = placeholderToken(key);
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

  async function save() {
    if (!draft.name.trim()) {
      setError("Vui lòng nhập tên mẫu.");
      return;
    }
    const parsed = parseTemplateFields(draft.fields);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(isNew ? "/api/documents/templates" : `/api/documents/templates/${initial.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          docType: draft.docType,
          body: draft.body,
          fields: parsed.fields,
          isActive: draft.isActive,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; template?: DocumentTemplate };
      if (!res.ok || !data.template) throw new Error(data.error || "Không lưu được mẫu văn bản.");
      onSaved(data.template, isNew);
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
      className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-bg shadow-xl sm:h-auto sm:max-h-[94dvh] sm:max-w-6xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant bg-white px-4 py-2.5">
          <MaterialIcon className="text-[22px] text-[#173A67]" name="description" />
          <h2 id="document-template-editor-title" className="text-base font-extrabold text-[#173A67]">
            {isNew ? "Thêm mẫu văn bản" : "Sửa mẫu văn bản"}
          </h2>
          {dirty ? <span className="text-xs font-semibold text-amber-700">Chưa lưu</span> : null}
          <button aria-label="Đóng" className={`${iconButton} ml-auto`} type="button" onClick={requestClose}>
            <MaterialIcon className="text-[20px]" name="close" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="grid gap-3 rounded-xl border border-[#d2dfe9] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_190px]">
              <div>
                <label className={labelClass} htmlFor="tpl-name">
                  Tên mẫu *
                </label>
                <input
                  className={inputClass}
                  id="tpl-name"
                  maxLength={DOCUMENT_TEMPLATE_LIMITS.name}
                  placeholder="VD: Quyết định khen thưởng đoàn viên"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="tpl-type">
                  Loại văn bản *
                </label>
                <select
                  className={inputClass}
                  id="tpl-type"
                  value={draft.docType}
                  onChange={(e) => setDraft({ ...draft, docType: e.target.value as DocumentType })}
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {DOCUMENT_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-on-surface sm:col-span-2">
                <input
                  checked={draft.isActive}
                  type="checkbox"
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                />
                Đang dùng
                <span className="text-xs font-normal text-on-surface-variant">(bỏ chọn để ngừng dùng; mẫu không bị xóa)</span>
              </label>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-[#d2dfe9] bg-white p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant" htmlFor="tpl-body">
                  Nội dung mẫu
                </label>
                <span className="text-[11px] text-on-surface-variant">— bấm để chèn chỗ trống:</span>
                {draft.fields
                  .filter((f) => f.key)
                  .map((f) => (
                    <button
                      key={f.key}
                      className="rounded-md border border-[#d2dfe9] bg-[#ecf4ff] px-1.5 py-0.5 font-mono text-[11px] text-[#173A67] hover:border-[#173A67]"
                      title={`Chèn ${placeholderToken(f.key)} (${f.label || f.key})`}
                      type="button"
                      onClick={() => insertPlaceholder(f.key)}
                    >
                      {placeholderToken(f.key)}
                    </button>
                  ))}
              </div>
              <textarea
                ref={bodyRef}
                className={`${inputClass} min-h-[260px] flex-1 resize-y font-mono text-[13px] leading-relaxed lg:min-h-[340px]`}
                id="tpl-body"
                maxLength={DOCUMENT_TEMPLATE_LIMITS.body}
                placeholder={"Số: {{so_van_ban}}\n{{noi_ban_hanh}}, ngày {{ngay}}\n\nQUYẾT ĐỊNH\n...\n{{noi_dung}}\n\nNGƯỜI KÝ\n{{nguoi_ky}}"}
                spellCheck={false}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
              <p className="text-[11px] leading-relaxed text-on-surface-variant">
                Viết nội dung như văn bản thường; chỗ cần điền khi soạn văn bản ghi dạng <code>{"{{khoa}}"}</code> trùng khóa
                trong danh sách trường. Mỗi dòng là một đoạn khi xuất file Word.
              </p>
              {missingFields.length ? (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                  <MaterialIcon className="text-[16px] text-amber-700" name="warning" />
                  <span>Chỗ trống chưa có trường:</span>
                  {missingFields.map((key) => (
                    <button
                      key={key}
                      className="rounded-md border border-amber-400 bg-white px-1.5 py-0.5 font-mono text-[11px] hover:bg-amber-100"
                      title="Thêm trường cho chỗ trống này"
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
                  Trường chưa dùng trong nội dung: {unusedFields.map((f) => f.key).join(", ")}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[#d2dfe9] bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-[#173A67]">Danh sách trường ({draft.fields.length})</p>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2 py-1 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
                  title="Thêm các trường chuẩn còn thiếu: số văn bản, ngày, nơi ban hành, người ký, nội dung"
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
                  Thêm trường
                </button>
              </div>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Mỗi trường thành một ô nhập trong form Soạn văn bản. Khóa: chữ thường không dấu, số, gạch dưới.
            </p>

            {draft.fields.length === 0 ? (
              <p className="rounded-lg border border-dashed border-outline-variant px-3 py-6 text-center text-xs text-on-surface-variant">
                Chưa có trường nào.
              </p>
            ) : (
              <ol className="space-y-1.5 lg:max-h-[56dvh] lg:overflow-y-auto lg:pr-1">
                {draft.fields.map((f, index) => (
                  <li key={index} className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 shrink-0 text-center text-[11px] font-bold text-on-surface-variant">{index + 1}</span>
                      <input
                        aria-label={`Nhãn trường ${index + 1}`}
                        className={`${fieldControlClass} min-w-0 flex-1`}
                        maxLength={DOCUMENT_TEMPLATE_LIMITS.fieldLabel}
                        placeholder="Nhãn (VD: Người ký)"
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
                        className={`${fieldControlClass} w-[120px] shrink-0`}
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
          <button
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#173A67] px-4 py-1.5 text-sm font-bold text-white transition hover:bg-[#1E4A7D] disabled:opacity-60"
            disabled={saving}
            type="button"
            onClick={() => void save()}
          >
            <MaterialIcon className="text-[18px]" name="save" />
            {saving ? "Đang lưu…" : isNew ? "Tạo mẫu" : "Lưu mẫu"}
          </button>
        </div>
      </div>
    </div>
  );
}
