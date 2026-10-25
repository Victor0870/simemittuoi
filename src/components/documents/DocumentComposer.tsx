"use client";

import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
import { IssueDocumentDialog } from "@/components/documents/IssueDocumentDialog";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  describeFieldErrors,
  layoutDocument,
  validateFieldValues,
  type DocumentDraft,
  type FieldValues,
} from "@/lib/documents/compose";
import { issueDefaults, type IssuedDocument } from "@/lib/documents/registry";
import type { DocumentOrgSettings } from "@/lib/documents/settings";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  type DocumentTemplate,
  type DocumentType,
  type TemplateField,
} from "@/lib/documents/templates";

type Tab = "compose" | "drafts";

const controlClass =
  "h-8 rounded-lg border border-outline-variant bg-white px-2 text-xs text-on-surface outline-none focus:border-[#173A67]";
const fieldControlClass =
  "block w-full rounded-lg border bg-white px-2 text-sm text-on-surface outline-none focus:border-[#173A67]";

function snapshot(templateId: string, title: string, values: FieldValues): string {
  const clean = Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => v.trim())
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify([templateId, title.trim(), clean]);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function downloadName(header: string | null): string {
  const star = header?.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) return decodeURIComponent(star[1]);
  return header?.match(/filename="([^"]+)"/i)?.[1] ?? "van-ban.docx";
}

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: TemplateField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `field-${field.key}`;
  const border = error ? "border-error" : "border-outline-variant";
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-0.5 flex items-baseline gap-1 text-[11px] font-semibold text-on-surface-variant">
        <span className="min-w-0 flex-1">
          {field.label}
          {field.required ? <span className="text-error"> *</span> : null}
        </span>
        {error ? <span className="shrink-0 text-[10px] font-bold text-error">{error}</span> : null}
      </span>
      {field.type === "textarea" ? (
        <textarea
          className={`${fieldControlClass} ${border} min-h-[76px] py-1.5 leading-snug`}
          id={id}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={`${fieldControlClass} ${border} h-8`}
          id={id}
          inputMode={field.type === "number" ? "numeric" : undefined}
          type={field.type === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

/** Soạn văn bản từ mẫu: form theo danh sách trường, xem trước trực tiếp, lưu nháp, xuất .docx; danh sách bản nháp. */
export function DocumentComposer({
  templates,
  settings,
  initialDrafts,
  initialDraftId = null,
  isAdmin = false,
}: {
  templates: DocumentTemplate[];
  settings: DocumentOrgSettings;
  initialDrafts: DocumentDraft[];
  /** Mở sẵn bản nháp này (từ Sổ văn bản: /admin/documents/compose?draft=…). */
  initialDraftId?: string | null;
  /** Quản trị viên được nhập số văn bản thủ công khi ban hành. */
  isAdmin?: boolean;
}) {
  const opened = initialDrafts.find(
    (d) => d.id === initialDraftId && templates.some((t) => t.id === d.templateId),
  );
  const [tab, setTab] = useState<Tab>("compose");
  const [drafts, setDrafts] = useState<DocumentDraft[]>(initialDrafts);
  const [typeFilter, setTypeFilter] = useState<DocumentType | "">("");
  const [templateId, setTemplateId] = useState(opened?.templateId ?? "");
  const [title, setTitle] = useState(opened?.title ?? "");
  const [values, setValues] = useState<FieldValues>(() => ({ ...(opened?.fieldValues ?? {}) }));
  const [draftId, setDraftId] = useState<string | null>(opened?.id ?? null);
  const [saved, setSaved] = useState(() =>
    opened ? snapshot(opened.templateId, opened.title, opened.fieldValues) : snapshot("", "", {}),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<"save" | "export" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [issuing, setIssuing] = useState<DocumentDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const template = templates.find((t) => t.id === templateId) ?? null;
  const pickable = templates.filter(
    (t) => (t.isActive || t.id === templateId) && (!typeFilter || t.docType === typeFilter),
  );
  const dirty = snapshot(templateId, title, values) !== saved;

  const fieldErrors = useMemo(
    () => (template ? validateFieldValues(template.fields, values) : {}),
    [template, values],
  );
  const requiredFields = template?.fields.filter((f) => f.required) ?? [];
  const requiredDone = requiredFields.filter((f) => !fieldErrors[f.key]).length;
  const layout = useMemo(
    () => (template ? layoutDocument(template.body, template.fields, values, settings) : null),
    [template, values, settings],
  );

  function clearNotice() {
    setMessage(null);
    setError(null);
  }

  function confirmDiscard(): boolean {
    return !dirty || window.confirm("Nội dung đang soạn chưa được lưu. Bỏ qua các thay đổi?");
  }

  function chooseTemplate(id: string) {
    clearNotice();
    const next = templates.find((t) => t.id === id) ?? null;
    if (next && (!title.trim() || title === template?.name)) setTitle(next.name);
    setTemplateId(id);
    setShowErrors(false);
  }

  function startNew() {
    if (!confirmDiscard()) return;
    clearNotice();
    setTemplateId("");
    setTitle("");
    setValues({});
    setDraftId(null);
    setShowErrors(false);
    setSaved(snapshot("", "", {}));
  }

  function reopen(draft: DocumentDraft) {
    if (draft.id !== draftId && !confirmDiscard()) return;
    clearNotice();
    const t = templates.find((x) => x.id === draft.templateId);
    if (!t) {
      setError("Không tìm thấy mẫu của bản nháp này.");
      return;
    }
    setTypeFilter("");
    setTemplateId(t.id);
    setTitle(draft.title);
    setValues({ ...draft.fieldValues });
    setDraftId(draft.id);
    setShowErrors(false);
    setSaved(snapshot(t.id, draft.title, draft.fieldValues));
    setTab("compose");
    if (!t.isActive) setMessage("Mẫu của bản nháp này đã ngừng dùng; vẫn sửa và xuất được.");
  }

  function focusField(key: string) {
    const el = document.getElementById(`field-${key}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }

  function payload() {
    return { templateId, title: title.trim() || template?.name || "", values, draftId };
  }

  async function saveDraft() {
    if (!template) {
      setError("Vui lòng chọn mẫu văn bản.");
      return;
    }
    clearNotice();
    setBusy("save");
    try {
      const body = payload();
      const res = await fetch(draftId ? `/api/documents/drafts/${draftId}` : "/api/documents/drafts", {
        method: draftId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; draft?: DocumentDraft };
      if (!res.ok || !data.draft) throw new Error(data.error || "Không lưu được bản nháp.");
      const draft = data.draft;
      setDrafts((list) => [draft, ...list.filter((d) => d.id !== draft.id)]);
      setDraftId(draft.id);
      setTitle(draft.title);
      setValues({ ...draft.fieldValues });
      setSaved(snapshot(draft.templateId, draft.title, draft.fieldValues));
      const missing = requiredFields.length - requiredDone;
      setMessage(
        missing > 0
          ? `Đã lưu bản nháp “${draft.title}” (còn ${missing} trường bắt buộc chưa nhập đúng).`
          : `Đã lưu bản nháp “${draft.title}”.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được bản nháp.");
    } finally {
      setBusy(null);
    }
  }

  async function exportDocx() {
    if (!template) {
      setError("Vui lòng chọn mẫu văn bản.");
      return;
    }
    clearNotice();
    if (Object.keys(fieldErrors).length > 0) {
      setShowErrors(true);
      setError(`Chưa nhập đúng / đủ: ${describeFieldErrors(template.fields, fieldErrors)}.`);
      const first = template.fields.find((f) => fieldErrors[f.key]);
      if (first) focusField(first.key);
      return;
    }
    setBusy("export");
    try {
      const res = await fetch("/api/documents/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 400) setShowErrors(true);
        throw new Error(data.error || "Không xuất được file Word.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName(res.headers.get("Content-Disposition"));
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(dirty ? "Đã xuất file Word. Nội dung chưa được lưu nháp." : "Đã xuất file Word.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xuất được file Word.");
    } finally {
      setBusy(null);
    }
  }

  async function removeDraft(draft: DocumentDraft) {
    if (!window.confirm(`Xóa bản nháp “${draft.title}”? Thao tác này không hoàn tác được.`)) return;
    clearNotice();
    setDeletingId(draft.id);
    try {
      const res = await fetch(`/api/documents/drafts/${draft.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Không xóa được bản nháp.");
      setDrafts((list) => list.filter((d) => d.id !== draft.id));
      if (draft.id === draftId) {
        setDraftId(null);
        setSaved(snapshot("", "", {}));
      }
      setMessage(`Đã xóa bản nháp “${draft.title}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được bản nháp.");
    } finally {
      setDeletingId(null);
    }
  }

  function startIssue(draft: DocumentDraft) {
    if (
      draft.id === draftId &&
      dirty &&
      !window.confirm("Nội dung đang soạn chưa được lưu. Bản ban hành sẽ dùng nội dung đã lưu nháp. Tiếp tục?")
    ) {
      return;
    }
    clearNotice();
    setIssuing(draft);
  }

  function afterIssued(issued: IssuedDocument) {
    setIssuing(null);
    setDrafts((list) => list.filter((d) => d.id !== issued.id));
    if (issued.id === draftId) {
      setTemplateId("");
      setTitle("");
      setValues({});
      setDraftId(null);
      setShowErrors(false);
      setSaved(snapshot("", "", {}));
    }
    setMessage(`Đã ban hành “${issued.title}” số ${issued.soVanBan}. Văn bản đã chuyển sang Sổ văn bản.`);
  }

  const templateName = (id: string) => templates.find((t) => t.id === id)?.name ?? "";
  const issuingDefaults = issuing
    ? issueDefaults(templates.find((t) => t.id === issuing.templateId), issuing.fieldValues, settings)
    : null;

  const columns: DataTableColumn<DocumentDraft>[] = [
    {
      key: "title",
      header: "Tiêu đề",
      accessor: (d) => d.title,
      render: (d) => (
        <button className="text-left hover:underline" type="button" onClick={() => reopen(d)}>
          <span className="block font-semibold text-[#173A67]">{d.title}</span>
          {templateName(d.templateId) && templateName(d.templateId) !== d.title ? (
            <span className="block text-[11px] text-on-surface-variant">Mẫu: {templateName(d.templateId)}</span>
          ) : null}
        </button>
      ),
      className: "min-w-[240px]",
    },
    {
      key: "type",
      header: "Loại",
      accessor: (d) => DOCUMENT_TYPE_LABEL[d.type],
      className: "whitespace-nowrap",
    },
    {
      key: "createdAt",
      header: "Ngày tạo",
      type: "date",
      accessor: (d) => d.createdAt,
      render: (d) => formatDate(d.createdAt),
      className: "whitespace-nowrap tabular-nums",
    },
    {
      key: "creator",
      header: "Người tạo",
      accessor: (d) => d.createdByName || "—",
      className: "whitespace-nowrap",
    },
    {
      key: "updatedAt",
      header: "Sửa lần cuối",
      type: "date",
      accessor: (d) => d.updatedAt,
      render: (d) => formatDate(d.updatedAt),
      className: "whitespace-nowrap tabular-nums",
    },
    {
      key: "actions",
      header: "",
      filterable: false,
      className: "sticky right-0 w-px whitespace-nowrap bg-white text-right shadow-[-6px_0_6px_-6px_rgb(0_0_0/0.18)]",
      headerClassName: "sticky right-0 z-10 bg-[#ecf4ff]",
      render: (d) => (
        <span className="inline-flex items-center gap-1">
          <button
            aria-label={`Mở lại bản nháp ${d.title}`}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-outline-variant px-2 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
            title="Mở lại để sửa, lưu và xuất lại"
            type="button"
            onClick={() => reopen(d)}
          >
            <MaterialIcon className="text-[16px]" name="edit_document" />
            <span className="hidden sm:inline">Mở lại</span>
          </button>
          <button
            aria-label={`Đánh dấu đã ban hành ${d.title}`}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-300 px-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            title="Đánh dấu đã ban hành (nhập số, ngày, bản scan đã ký)"
            type="button"
            onClick={() => startIssue(d)}
          >
            <MaterialIcon className="text-[16px]" name="verified" />
            <span className="hidden sm:inline">Ban hành</span>
          </button>
          <button
            aria-label={`Xóa bản nháp ${d.title}`}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-outline-variant px-2 text-xs font-semibold text-on-surface-variant hover:border-error hover:text-error disabled:opacity-50"
            disabled={deletingId === d.id}
            title="Xóa bản nháp"
            type="button"
            onClick={() => void removeDraft(d)}
          >
            <MaterialIcon className="text-[16px]" name="delete" />
            <span className="hidden sm:inline">Xóa</span>
          </button>
        </span>
      ),
    },
  ];

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${
      active ? "bg-[#173A67] text-white" : "text-[#173A67] hover:bg-[#ecf4ff]"
    }`;

  return (
    <div className="flex flex-col gap-2 lg:h-[calc(100dvh-120px)] lg:min-h-0 lg:overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1 className="text-lg font-extrabold text-[#173A67]">Soạn văn bản</h1>
        <div className="inline-flex rounded-lg border border-[#d2dfe9] bg-white p-0.5" role="tablist">
          <button aria-selected={tab === "compose"} className={tabClass(tab === "compose")} role="tab" type="button" onClick={() => setTab("compose")}>
            <MaterialIcon className="text-[16px]" name="edit_document" />
            Soạn thảo
          </button>
          <button aria-selected={tab === "drafts"} className={tabClass(tab === "drafts")} role="tab" type="button" onClick={() => setTab("drafts")}>
            <MaterialIcon className="text-[16px]" name="edit_note" />
            Bản nháp ({drafts.length})
          </button>
        </div>
        {tab === "compose" && draftId ? (
          <span className="text-xs text-on-surface-variant">
            Đang sửa bản nháp{dirty ? <strong className="text-amber-700"> • chưa lưu</strong> : null}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="shrink-0 rounded-xl border border-error/30 bg-error-container/40 px-3 py-1.5 text-xs font-semibold text-on-error-container">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
          {message}
        </p>
      ) : null}

      {tab === "drafts" ? (
        <div className="flex flex-col lg:min-h-0 lg:flex-1">
          <DataTable
            columns={columns}
            density="compact"
            emptyText="Chưa có bản nháp nào. Soạn văn bản rồi bấm “Lưu nháp”."
            fill
            rowKey={(d) => d.id}
            rows={drafts}
          />
        </div>
      ) : (
        <div className="grid gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
          <section className="flex flex-col rounded-xl border border-[#d2dfe9] bg-white lg:min-h-0">
            <div className="flex shrink-0 flex-col gap-1.5 border-b border-[#e3ecf3] px-3 py-2">
              <div className="flex gap-1.5">
                <select
                  aria-label="Lọc mẫu theo loại văn bản"
                  className={`${controlClass} w-[42%] shrink-0`}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as DocumentType | "")}
                >
                  <option value="">Tất cả loại</option>
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {DOCUMENT_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Chọn mẫu văn bản"
                  className={`${controlClass} min-w-0 flex-1`}
                  value={templateId}
                  onChange={(e) => chooseTemplate(e.target.value)}
                >
                  <option value="">— Chọn mẫu ({pickable.length}) —</option>
                  {DOCUMENT_TYPES.filter((type) => pickable.some((t) => t.docType === type)).map((type) => (
                    <optgroup key={type} label={DOCUMENT_TYPE_LABEL[type]}>
                      {pickable
                        .filter((t) => t.docType === type)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                            {t.isActive ? "" : " (ngừng dùng)"}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {template ? (
                <label className="block">
                  <span className="mb-0.5 flex items-baseline gap-2 text-[11px] font-semibold text-on-surface-variant">
                    <span className="min-w-0 flex-1">Tiêu đề (để tìm trong danh sách bản nháp)</span>
                    {requiredFields.length ? (
                      <span className="shrink-0 font-normal">
                        Bắt buộc:{" "}
                        <strong className={requiredDone === requiredFields.length ? "text-emerald-700" : "text-error"}>
                          {requiredDone}/{requiredFields.length}
                        </strong>
                      </span>
                    ) : null}
                  </span>
                  <input
                    className={`${fieldControlClass} h-8 border-outline-variant`}
                    maxLength={300}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 px-3 py-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {template ? (
                template.fields.length ? (
                  template.fields.map((field) => (
                    <FieldInput
                      key={field.key}
                      error={showErrors ? fieldErrors[field.key] : undefined}
                      field={field}
                      value={values[field.key] ?? ""}
                      onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                    />
                  ))
                ) : (
                  <p className="text-xs text-on-surface-variant">Mẫu này không có ô nhập; có thể xuất ngay.</p>
                )
              ) : (
                <p className="py-4 text-center text-xs text-on-surface-variant">
                  Chọn loại và mẫu văn bản đang dùng để bắt đầu soạn, hoặc mở lại một bản nháp.
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 border-t border-[#e3ecf3] px-3 py-2">
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]"
                title="Soạn văn bản mới"
                type="button"
                onClick={startNew}
              >
                <MaterialIcon className="text-[16px]" name="note_add" />
                Soạn mới
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-[#173A67] bg-white px-2.5 py-1.5 text-xs font-bold text-[#173A67] hover:bg-[#ecf4ff] disabled:opacity-50"
                disabled={!template || busy !== null}
                type="button"
                onClick={() => void saveDraft()}
              >
                <MaterialIcon className="text-[16px]" name="save" />
                {busy === "save" ? "Đang lưu…" : "Lưu nháp"}
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-lg bg-[#173A67] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-50"
                disabled={!template || busy !== null}
                type="button"
                onClick={() => void exportDocx()}
              >
                <MaterialIcon className="text-[16px]" name="download" />
                {busy === "export" ? "Đang xuất…" : "Xuất .docx"}
              </button>
            </div>
          </section>

          <section className="flex flex-col rounded-xl border border-[#d2dfe9] bg-[#eef2f6] lg:min-h-0">
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#d2dfe9] px-3 py-1.5 text-[11px] text-on-surface-variant">
              <strong className="text-xs text-[#173A67]">Xem trước</strong>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-100 ring-1 ring-red-300" /> bắt buộc chưa nhập
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-100 ring-1 ring-amber-300" /> không bắt buộc
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#e8f1ff] ring-1 ring-[#b9d3f5]" /> đã nhập
              </span>
            </div>
            <div className="p-2 sm:p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {layout ? (
                <DocumentPreview layout={layout} onPick={focusField} />
              ) : (
                <div className="flex h-full min-h-[160px] items-center justify-center text-xs text-on-surface-variant">
                  Bản xem trước hiện ở đây sau khi chọn mẫu.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {issuing && issuingDefaults ? (
        <IssueDocumentDialog
          canOverride={isAdmin}
          defaultDate={issuingDefaults.date}
          defaultNumber={issuingDefaults.number}
          document={issuing}
          onClose={() => setIssuing(null)}
          onIssued={afterIssued}
        />
      ) : null}
    </div>
  );
}
