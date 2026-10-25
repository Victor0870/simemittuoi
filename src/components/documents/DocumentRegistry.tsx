"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { DocumentNumberingDialog } from "@/components/documents/DocumentNumberingDialog";
import { IssueDocumentDialog } from "@/components/documents/IssueDocumentDialog";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { DocumentDraft } from "@/lib/documents/compose";
import { issueDefaults, type IssuedDocument } from "@/lib/documents/registry";
import type { DocumentOrgSettings } from "@/lib/documents/settings";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL, type DocumentTemplate, type DocumentType } from "@/lib/documents/templates";

type Tab = "issued" | "pending";

const controlClass =
  "h-8 rounded-lg border border-outline-variant bg-white px-2 text-xs text-on-surface outline-none focus:border-[#173A67]";
const actionClass =
  "inline-flex h-7 items-center gap-1 rounded-lg border border-outline-variant px-2 text-xs font-semibold text-[#173A67] hover:border-[#173A67]";

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
}

function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m && value.length === 10) return `${m[3]}/${m[2]}/${m[1]}`;
  return value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "";
}

function sortIssued(list: IssuedDocument[]): IssuedDocument[] {
  return [...list].sort((a, b) => b.ngayBanHanh.localeCompare(a.ngayBanHanh) || b.issuedAt.localeCompare(a.issuedAt));
}

/** Sổ văn bản đã ban hành: lọc theo loại / năm / số – tiêu đề, công khai, xem bản scan, tải lại .docx; ban hành bản nháp. */
export function DocumentRegistry({
  initialDocuments,
  initialDrafts,
  templates,
  settings,
  isAdmin,
}: {
  initialDocuments: IssuedDocument[];
  initialDrafts: DocumentDraft[];
  templates: DocumentTemplate[];
  settings: DocumentOrgSettings;
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState<Tab>("issued");
  const [documents, setDocuments] = useState(initialDocuments);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "">("");
  const [year, setYear] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issuing, setIssuing] = useState<DocumentDraft | null>(null);
  const [numbering, setNumbering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(
    () => [...new Set(documents.map((d) => d.ngayBanHanh.slice(0, 4)).filter(Boolean))].sort().reverse(),
    [documents],
  );
  const rows = useMemo(() => {
    const q = normalize(query.trim());
    return documents.filter(
      (d) =>
        (!typeFilter || d.type === typeFilter) &&
        (!year || d.ngayBanHanh.startsWith(year)) &&
        (!q || normalize(`${d.soVanBan} ${d.title}`).includes(q)),
    );
  }, [documents, query, typeFilter, year]);

  function clearNotice() {
    setMessage(null);
    setError(null);
  }

  async function togglePublic(doc: IssuedDocument) {
    clearNotice();
    const next = !doc.congKhai;
    setBusyId(doc.id);
    setDocuments((list) => list.map((d) => (d.id === doc.id ? { ...d, congKhai: next } : d)));
    try {
      const res = await fetch(`/api/documents/registry/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congKhai: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Không lưu được.");
    } catch (err) {
      setDocuments((list) => list.map((d) => (d.id === doc.id ? { ...d, congKhai: doc.congKhai } : d)));
      setError(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setBusyId(null);
    }
  }

  async function unissue(doc: IssuedDocument) {
    if (
      !window.confirm(
        `Hủy ban hành văn bản số ${doc.soVanBan} “${doc.title}”?\n\n` +
          "Văn bản trở về bản nháp (sửa được ở Soạn văn bản); số, ngày ban hành bị xóa, cờ công khai tắt " +
          "và bản scan đã ký bị xóa vĩnh viễn khỏi kho. Thao tác này không hoàn tác được.",
      )
    ) {
      return;
    }
    clearNotice();
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/documents/registry/${doc.id}/unissue`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; draft?: DocumentDraft | null };
      if (!res.ok) throw new Error(data.error || "Không hủy ban hành được.");
      setDocuments((list) => list.filter((d) => d.id !== doc.id));
      const draft = data.draft;
      if (draft) setDrafts((list) => [draft, ...list.filter((d) => d.id !== draft.id)]);
      setMessage(`Đã hủy ban hành “${doc.title}”. Văn bản trở về bản nháp.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hủy ban hành được.");
    } finally {
      setBusyId(null);
    }
  }

  function afterIssued(issued: IssuedDocument) {
    setIssuing(null);
    setDrafts((list) => list.filter((d) => d.id !== issued.id));
    setDocuments((list) => sortIssued([issued, ...list.filter((d) => d.id !== issued.id)]));
    setTab("issued");
    setMessage(`Đã ban hành “${issued.title}” số ${issued.soVanBan}.`);
  }

  const issuedColumns: DataTableColumn<IssuedDocument>[] = [
    {
      key: "type",
      header: "Loại",
      accessor: (d) => DOCUMENT_TYPE_LABEL[d.type],
      className: "whitespace-nowrap",
    },
    {
      key: "so",
      header: "Số",
      accessor: (d) => d.soVanBan,
      className: "whitespace-nowrap font-semibold text-[#173A67] tabular-nums",
    },
    {
      key: "title",
      header: "Tiêu đề",
      accessor: (d) => d.title,
      className: "min-w-[150px]",
    },
    {
      key: "ngay",
      header: "Ngày ban hành",
      type: "date",
      accessor: (d) => d.ngayBanHanh,
      render: (d) => formatDate(d.ngayBanHanh),
      className: "whitespace-nowrap tabular-nums",
    },
    {
      key: "issuedBy",
      header: "Người ban hành",
      accessor: (d) => d.issuedByName || "—",
      className: "whitespace-nowrap",
    },
    {
      key: "public",
      header: "Công khai",
      filterable: false,
      accessor: (d) => (d.congKhai ? "Có" : "Không"),
      render: (d) => (
        <button
          aria-checked={d.congKhai}
          aria-label={`Công khai văn bản số ${d.soVanBan}`}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
            d.congKhai ? "bg-emerald-600" : "bg-outline-variant"
          }`}
          disabled={busyId === d.id}
          role="switch"
          title={d.congKhai ? "Đang công khai – bấm để tắt" : "Chưa công khai – bấm để bật"}
          type="button"
          onClick={() => void togglePublic(d)}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${d.congKhai ? "translate-x-[18px]" : "translate-x-0.5"}`}
          />
        </button>
      ),
      className: "whitespace-nowrap",
    },
    {
      key: "actions",
      header: "",
      filterable: false,
      className: "sticky right-0 w-px whitespace-nowrap bg-white text-right shadow-[-6px_0_6px_-6px_rgb(0_0_0/0.18)]",
      headerClassName: "sticky right-0 z-10 bg-[#ecf4ff]",
      render: (d) => (
        <span className="inline-flex items-center gap-1">
          {d.scanKind ? (
            <a
              aria-label={`Xem / tải bản scan số ${d.soVanBan}`}
              className={actionClass}
              href={`/api/documents/registry/${d.id}/scan`}
              rel="noopener noreferrer"
              target="_blank"
              title="Xem / tải bản scan đã ký (mở tab mới, link hết hạn sau 60 giây)"
            >
              <MaterialIcon className="text-[16px]" name={d.scanKind === "pdf" ? "picture_as_pdf" : "image"} />
              <span className="hidden 2xl:inline">Bản scan</span>
            </a>
          ) : null}
          <a
            aria-label={`Tải lại file Word số ${d.soVanBan}`}
            className={actionClass}
            download
            href={`/api/documents/registry/${d.id}/docx`}
            title="Tải lại file Word (.docx) theo số và ngày ban hành"
          >
            <MaterialIcon className="text-[16px]" name="description" />
            <span className="hidden 2xl:inline">.docx</span>
          </a>
          {isAdmin ? (
            <button
              aria-label={`Hủy ban hành số ${d.soVanBan}`}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-outline-variant px-2 text-xs font-semibold text-on-surface-variant hover:border-error hover:text-error disabled:opacity-50"
              disabled={busyId === d.id}
              title="Hủy ban hành (chỉ Quản trị viên): trở về bản nháp, xóa bản scan"
              type="button"
              onClick={() => void unissue(d)}
            >
              <MaterialIcon className="text-[16px]" name="undo" />
              <span className="hidden 2xl:inline">Hủy ban hành</span>
            </button>
          ) : null}
        </span>
      ),
    },
  ];

  const draftColumns: DataTableColumn<DocumentDraft>[] = [
    {
      key: "title",
      header: "Tiêu đề",
      accessor: (d) => d.title,
      className: "min-w-[220px] font-semibold text-[#173A67]",
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
      key: "actions",
      header: "",
      filterable: false,
      className: "sticky right-0 w-px whitespace-nowrap bg-white text-right shadow-[-6px_0_6px_-6px_rgb(0_0_0/0.18)]",
      headerClassName: "sticky right-0 z-10 bg-[#ecf4ff]",
      render: (d) => (
        <span className="inline-flex items-center gap-1">
          <Link
            aria-label={`Mở soạn thảo ${d.title}`}
            className={actionClass}
            href={`/admin/documents/compose?draft=${d.id}`}
            title="Mở trong Soạn văn bản để sửa"
          >
            <MaterialIcon className="text-[16px]" name="edit_document" />
            <span className="hidden sm:inline">Mở soạn</span>
          </Link>
          <button
            aria-label={`Đánh dấu đã ban hành ${d.title}`}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-300 px-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            title="Đánh dấu đã ban hành (số cấp tự động, ngày, bản scan đã ký)"
            type="button"
            onClick={() => {
              clearNotice();
              setIssuing(d);
            }}
          >
            <MaterialIcon className="text-[16px]" name="verified" />
            <span className="hidden sm:inline">Đánh dấu đã ban hành</span>
          </button>
        </span>
      ),
    },
  ];

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${
      active ? "bg-[#173A67] text-white" : "text-[#173A67] hover:bg-[#ecf4ff]"
    }`;
  const filtered = query || typeFilter || year;
  const issuingDefaults = issuing
    ? issueDefaults(templates.find((t) => t.id === issuing.templateId), issuing.fieldValues, settings)
    : null;

  return (
    <div className="flex flex-col gap-2 lg:h-[calc(100dvh-120px)] lg:min-h-0 lg:overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1 className="text-lg font-extrabold text-[#173A67]">Sổ văn bản</h1>
        <div className="inline-flex rounded-lg border border-[#d2dfe9] bg-white p-0.5" role="tablist">
          <button aria-selected={tab === "issued"} className={tabClass(tab === "issued")} role="tab" type="button" onClick={() => setTab("issued")}>
            <MaterialIcon className="text-[16px]" name="menu_book" />
            Đã ban hành ({documents.length})
          </button>
          <button aria-selected={tab === "pending"} className={tabClass(tab === "pending")} role="tab" type="button" onClick={() => setTab("pending")}>
            <MaterialIcon className="text-[16px]" name="pending_actions" />
            Chờ ban hành ({drafts.length})
          </button>
        </div>
        <button
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[#173A67] bg-white px-3 py-1.5 text-xs font-bold text-[#173A67] transition hover:bg-[#ecf4ff]"
          title="Mẫu số và chu kỳ đếm của số văn bản tự động theo loại"
          type="button"
          onClick={() => setNumbering(true)}
        >
          <MaterialIcon className="text-[17px]" name="pin" />
          Cấu hình số
        </button>
        <Link
          className="inline-flex items-center gap-1 rounded-lg bg-[#173A67] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1E4A7D]"
          href="/admin/documents/compose"
        >
          <MaterialIcon className="text-[17px]" name="edit_document" />
          Soạn văn bản
        </Link>
      </div>

      {tab === "issued" ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-[#d2dfe9] bg-white px-3 py-2">
          <label className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <MaterialIcon
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant"
              name="search"
            />
            <input
              aria-label="Tìm theo số hoặc tiêu đề"
              className={`${controlClass} w-full pl-8`}
              placeholder="Tìm theo số hoặc tiêu đề"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Lọc theo loại văn bản"
            className={controlClass}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as DocumentType | "")}
          >
            <option value="">Tất cả loại</option>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {DOCUMENT_TYPE_LABEL[type]} ({documents.filter((d) => d.type === type).length})
              </option>
            ))}
          </select>
          <select aria-label="Lọc theo năm ban hành" className={controlClass} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Mọi năm</option>
            {years.map((y) => (
              <option key={y} value={y}>
                Năm {y}
              </option>
            ))}
          </select>
          {filtered ? (
            <button
              className="text-xs font-semibold text-[#4a6b82] hover:text-[#173A67] hover:underline"
              type="button"
              onClick={() => {
                setQuery("");
                setTypeFilter("");
                setYear("");
              }}
            >
              Xóa lọc
            </button>
          ) : null}
        </div>
      ) : null}

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

      <div className="flex flex-col lg:min-h-0 lg:flex-1">
        {tab === "issued" ? (
          <DataTable
            columns={issuedColumns}
            density="compact"
            emptyText={
              documents.length
                ? "Không có văn bản nào khớp điều kiện lọc."
                : "Chưa có văn bản nào được ban hành. Bấm “Đánh dấu đã ban hành” ở bản nháp để đưa vào sổ."
            }
            fill
            rowKey={(d) => d.id}
            rows={rows}
          />
        ) : (
          <DataTable
            columns={draftColumns}
            density="compact"
            emptyText="Không có bản nháp nào chờ ban hành."
            fill
            rowKey={(d) => d.id}
            rows={drafts}
          />
        )}
      </div>

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
      {numbering ? <DocumentNumberingDialog onClose={() => setNumbering(false)} /> : null}
    </div>
  );
}
