"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { DocumentTemplateEditor, type TemplateDraft } from "@/components/documents/DocumentTemplateEditor";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  STANDARD_TEMPLATE_FIELDS,
  type DocumentTemplate,
  type DocumentType,
} from "@/lib/documents/templates";

type ActiveFilter = "all" | "active" | "inactive";

const controlClass =
  "h-8 rounded-lg border border-outline-variant bg-white px-2 text-xs text-on-surface outline-none focus:border-[#173A67]";

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
}

/** Thư viện mẫu văn bản: lọc theo loại / trạng thái, tìm theo tên, thêm – sửa – ngừng dùng. */
export function DocumentTemplatesManager({ templates }: { templates: DocumentTemplate[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "">("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCount = templates.filter((t) => t.isActive).length;
  const rows = useMemo(() => {
    const q = normalize(query.trim());
    return templates.filter(
      (t) =>
        (!typeFilter || t.docType === typeFilter) &&
        (activeFilter === "all" || (activeFilter === "active") === t.isActive) &&
        (!q || normalize(t.name).includes(q)),
    );
  }, [templates, query, typeFilter, activeFilter]);

  function openNew() {
    setError(null);
    setMessage(null);
    setDraft({
      name: "",
      docType: typeFilter || "quyet_dinh",
      body: "",
      fields: STANDARD_TEMPLATE_FIELDS.map((f) => ({ ...f })),
      isActive: true,
    });
  }

  function openEdit(t: DocumentTemplate) {
    setError(null);
    setMessage(null);
    setDraft({
      id: t.id,
      name: t.name,
      docType: t.docType,
      body: t.body,
      fields: t.fields.map((f) => ({ ...f })),
      isActive: t.isActive,
    });
  }

  async function toggleActive(t: DocumentTemplate) {
    if (t.isActive && !window.confirm(`Ngừng dùng mẫu “${t.name}”? Mẫu vẫn được lưu và có thể dùng lại bất cứ lúc nào.`)) return;
    setBusyId(t.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/documents/templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Không lưu được mẫu văn bản.");
      setMessage(t.isActive ? `Đã ngừng dùng mẫu “${t.name}”.` : `Đã dùng lại mẫu “${t.name}”.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được mẫu văn bản.");
    } finally {
      setBusyId(null);
    }
  }

  const columns: DataTableColumn<DocumentTemplate>[] = [
    {
      key: "name",
      header: "Tên mẫu",
      accessor: (t) => t.name,
      render: (t) => (
        <button
          className={`text-left font-semibold hover:underline ${t.isActive ? "text-[#173A67]" : "text-on-surface-variant line-through"}`}
          type="button"
          onClick={() => openEdit(t)}
        >
          {t.name}
        </button>
      ),
      className: "min-w-[220px]",
    },
    {
      key: "docType",
      header: "Loại",
      accessor: (t) => DOCUMENT_TYPE_LABEL[t.docType],
      className: "whitespace-nowrap",
    },
    {
      key: "fields",
      header: "Số trường",
      type: "number",
      accessor: (t) => t.fields.length,
      className: "whitespace-nowrap text-right tabular-nums",
      headerClassName: "text-right",
    },
    {
      key: "status",
      header: "Trạng thái",
      accessor: (t) => (t.isActive ? "Đang dùng" : "Ngừng dùng"),
      render: (t) => (
        <span
          className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${
            t.isActive ? "bg-emerald-50 text-emerald-800" : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {t.isActive ? "Đang dùng" : "Ngừng dùng"}
        </span>
      ),
    },
    {
      key: "updatedAt",
      header: "Cập nhật",
      type: "date",
      accessor: (t) => t.updatedAt,
      render: (t) => new Date(t.updatedAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
      className: "whitespace-nowrap tabular-nums",
    },
    {
      key: "actions",
      header: "",
      filterable: false,
      className: "sticky right-0 w-px whitespace-nowrap bg-white text-right shadow-[-6px_0_6px_-6px_rgb(0_0_0/0.18)]",
      headerClassName: "sticky right-0 z-10 bg-[#ecf4ff]",
      render: (t) => (
        <span className="inline-flex items-center gap-1">
          <button
            aria-label={`Sửa mẫu ${t.name}`}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-outline-variant px-2 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
            title="Sửa mẫu"
            type="button"
            onClick={() => openEdit(t)}
          >
            <MaterialIcon className="text-[16px]" name="edit" />
            <span className="hidden sm:inline">Sửa</span>
          </button>
          <button
            aria-label={t.isActive ? `Ngừng dùng mẫu ${t.name}` : `Dùng lại mẫu ${t.name}`}
            className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-xs font-semibold disabled:opacity-50 ${
              t.isActive
                ? "border-outline-variant text-on-surface-variant hover:border-error hover:text-error"
                : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            }`}
            disabled={busyId === t.id}
            title={t.isActive ? "Ngừng dùng" : "Dùng lại"}
            type="button"
            onClick={() => void toggleActive(t)}
          >
            <MaterialIcon className="text-[16px]" name={t.isActive ? "block" : "restart_alt"} />
            <span className="hidden sm:inline">{t.isActive ? "Ngừng dùng" : "Dùng lại"}</span>
          </button>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-2 lg:h-[calc(100dvh-120px)] lg:min-h-0 lg:overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1 className="text-lg font-extrabold text-[#173A67]">Mẫu văn bản</h1>
        <span className="text-xs text-on-surface-variant">
          <strong className="text-[#173A67]">{activeCount}</strong> đang dùng / {templates.length} mẫu
        </span>
        <button
          className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#173A67] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1E4A7D]"
          type="button"
          onClick={openNew}
        >
          <MaterialIcon className="text-[18px]" name="add" />
          Thêm mẫu
        </button>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-[#d2dfe9] bg-white px-3 py-2">
        <label className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <MaterialIcon
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant"
            name="search"
          />
          <input
            aria-label="Tìm theo tên mẫu"
            className={`${controlClass} w-full pl-8`}
            placeholder="Tìm theo tên mẫu"
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
              {DOCUMENT_TYPE_LABEL[type]} ({templates.filter((t) => t.docType === type).length})
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc theo trạng thái"
          className={controlClass}
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
        >
          <option value="all">Mọi trạng thái</option>
          <option value="active">Đang dùng</option>
          <option value="inactive">Ngừng dùng</option>
        </select>
        {query || typeFilter || activeFilter !== "all" ? (
          <button
            className="text-xs font-semibold text-[#4a6b82] hover:text-[#173A67] hover:underline"
            type="button"
            onClick={() => {
              setQuery("");
              setTypeFilter("");
              setActiveFilter("all");
            }}
          >
            Xóa lọc
          </button>
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

      <div className="flex flex-col lg:min-h-0 lg:flex-1">
        <DataTable
          columns={columns}
          density="compact"
          emptyText={templates.length ? "Không có mẫu nào khớp điều kiện lọc." : "Chưa có mẫu văn bản nào. Bấm “Thêm mẫu” để tạo."}
          fill
          rowClassName={(t) => (t.isActive ? "" : "bg-surface-container-low/40")}
          rowKey={(t) => t.id}
          rows={rows}
        />
      </div>

      {draft ? (
        <DocumentTemplateEditor
          initial={draft}
          onClose={() => setDraft(null)}
          onSaved={(saved, created) => {
            setDraft(null);
            setMessage(created ? `Đã tạo mẫu “${saved.name}”.` : `Đã lưu mẫu “${saved.name}”.`);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
