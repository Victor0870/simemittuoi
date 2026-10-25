"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { DocumentSettingsModal } from "@/components/documents/DocumentSettingsModal";
import { DocumentTemplateEditor, type TemplateDraft } from "@/components/documents/DocumentTemplateEditor";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { DEFAULT_DOCUMENT_ORG_SETTINGS, type DocumentOrgSettings } from "@/lib/documents/settings";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  STANDARD_TEMPLATE_FIELDS,
  TEMPLATE_CATEGORY_LABEL,
  getStandardTemplateBadge,
  getTemplateCategory,
  getTemplateDisplayName,
  parseStructuredDocument,
  type DocumentTemplate,
  type DocumentType,
  type TemplateCategory,
} from "@/lib/documents/templates";

type ActiveFilter = "all" | "active" | "inactive";
type CategoryFilter = "all" | TemplateCategory;

const controlClass =
  "h-8 rounded-lg border border-outline-variant bg-white px-2 text-xs text-on-surface outline-none focus:border-[#173A67]";

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
}

/** Thư viện mẫu văn bản: phân nhóm Mẫu chuẩn (QĐ 933/QĐ-TLĐ) & Mẫu tùy chỉnh, tạo mẫu tùy chỉnh từ mẫu chuẩn. */
export function DocumentTemplatesManager({
  templates,
  initialSettings = DEFAULT_DOCUMENT_ORG_SETTINGS,
}: {
  templates: DocumentTemplate[];
  initialSettings?: DocumentOrgSettings;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "">("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [orgSettings, setOrgSettings] = useState<DocumentOrgSettings>(initialSettings);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCount = templates.filter((t) => t.isActive).length;
  const standardCount = templates.filter((t) => getTemplateCategory(t.name) === "standard").length;
  const customCount = templates.filter((t) => getTemplateCategory(t.name) === "custom").length;

  const rows = useMemo(() => {
    const q = normalize(query.trim());
    return templates.filter(
      (t) =>
        (categoryFilter === "all" || getTemplateCategory(t.name) === categoryFilter) &&
        (!typeFilter || t.docType === typeFilter) &&
        (activeFilter === "all" || (activeFilter === "active") === t.isActive) &&
        (!q || normalize(t.name).includes(q)),
    );
  }, [templates, query, categoryFilter, typeFilter, activeFilter]);

  function openNew() {
    setError(null);
    setMessage(null);
    setDraft({
      name: "",
      category: categoryFilter === "standard" ? "standard" : "custom",
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
      category: getTemplateCategory(t.name),
      docType: t.docType,
      body: t.body,
      fields: t.fields.map((f) => ({ ...f })),
      isActive: t.isActive,
    });
  }

  /** Mở Mẫu chuẩn dưới dạng tạo mới یک Mẫu tùy chỉnh (sửa thoải mái rồi lưu thành mẫu tùy chỉnh). */
  function openCustomizeFromStandard(t: DocumentTemplate) {
    setError(null);
    setMessage(null);
    const cleanName = getTemplateDisplayName(t.name);
    setDraft({
      name: `[Mẫu tùy chỉnh] ${cleanName}`,
      category: "custom",
      docType: t.docType,
      body: t.body,
      fields: t.fields.map((f) => ({ ...f })),
      isActive: true,
    });
  }

  async function toggleActive(t: DocumentTemplate) {
    if (
      t.isActive &&
      !window.confirm(`Ngừng dùng mẫu “${getTemplateDisplayName(t.name)}”? Mẫu vẫn được lưu và có thể dùng lại bất cứ lúc nào.`)
    ) {
      return;
    }
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
      setMessage(
        t.isActive
          ? `Đã ngừng dùng mẫu “${getTemplateDisplayName(t.name)}”.`
          : `Đã dùng lại mẫu “${getTemplateDisplayName(t.name)}”.`,
      );
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
      accessor: (t) => getTemplateDisplayName(t.name),
      render: (t) => {
        const cat = getTemplateCategory(t.name);
        const isStd = cat === "standard";
        return (
          <div className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={`mt-0.5 inline-block h-4 w-1 shrink-0 rounded-full ${
                !t.isActive
                  ? "bg-outline-variant"
                  : isStd
                    ? "bg-sky-400"
                    : "bg-amber-400"
              }`}
              title={TEMPLATE_CATEGORY_LABEL[cat]}
            />
            <button
              className={`text-left font-semibold hover:underline ${
                t.isActive ? "text-[#173A67]" : "text-on-surface-variant line-through"
              }`}
              type="button"
              onClick={() => openEdit(t)}
            >
              {getTemplateDisplayName(t.name)}
            </button>
          </div>
        );
      },
      className: "min-w-[240px]",
    },
    {
      key: "category",
      header: "Nhóm mẫu",
      accessor: (t) => TEMPLATE_CATEGORY_LABEL[getTemplateCategory(t.name)],
      render: (t) => {
        const cat = getTemplateCategory(t.name);
        const badge = getStandardTemplateBadge(t.name);
        return cat === "standard" ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-sky-200 bg-sky-100/80 px-2 py-0.5 text-[11px] font-bold text-sky-900 shadow-2xs">
            <MaterialIcon className="text-[13px] text-sky-700" name="menu_book" />
            {badge || "Mẫu chuẩn (QĐ 933)"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-amber-200 bg-amber-100/80 px-2 py-0.5 text-[11px] font-bold text-amber-900 shadow-2xs">
            <MaterialIcon className="text-[13px] text-amber-700" name="tune" />
            Mẫu tùy chỉnh
          </span>
        );
      },
      className: "whitespace-nowrap",
    },
    {
      key: "docType",
      header: "Loại",
      accessor: (t) => DOCUMENT_TYPE_LABEL[t.docType],
      className: "whitespace-nowrap",
    },
    {
      key: "structure",
      header: "Cấu trúc",
      filterable: false,
      accessor: (t) => {
        const s = parseStructuredDocument(t.body, t.docType);
        return `${s.bases.length} căn cứ • ${s.articles.length} điều`;
      },
      render: (t) => {
        const hasArticles = /(^|\n)\s*Điều\s+\d+\s*[.:]/i.test(t.body);
        if (!hasArticles && t.docType !== "quyet_dinh") {
          return <span className="whitespace-nowrap text-xs text-on-surface-variant">Theo biểu mẫu</span>;
        }
        const s = parseStructuredDocument(t.body, t.docType);
        return (
          <span className="whitespace-nowrap text-xs text-on-surface-variant">
            <strong>{s.bases.length}</strong> căn cứ • <strong>{s.articles.length}</strong> điều
          </span>
        );
      },
      className: "whitespace-nowrap",
    },
    {
      key: "fields",
      header: "Ô nhập",
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
      className: "sticky right-0 w-px whitespace-nowrap bg-white/95 backdrop-blur-xs text-right shadow-[-6px_0_6px_-6px_rgb(0_0_0/0.18)]",
      headerClassName: "sticky right-0 z-10 bg-[#ecf4ff]",
      render: (t) => {
        const isStd = getTemplateCategory(t.name) === "standard";
        return (
          <span className="inline-flex items-center gap-1">
            {isStd ? (
              <button
                aria-label={`Tạo mẫu tùy chỉnh từ ${t.name}`}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 text-xs font-bold text-amber-900 hover:border-amber-400 hover:bg-amber-100"
                title="Dùng Mẫu chuẩn này để sửa và lưu thành Mẫu tùy chỉnh riêng của đơn vị"
                type="button"
                onClick={() => openCustomizeFromStandard(t)}
              >
                <MaterialIcon className="text-[15px] text-amber-700" name="tune" />
                <span className="hidden sm:inline">Tạo tùy chỉnh</span>
              </button>
            ) : null}
            <button
              aria-label={`Sửa mẫu ${t.name}`}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-outline-variant px-2 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
              title="Xem / Sửa mẫu"
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
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-2 lg:h-[calc(100dvh-120px)] lg:min-h-0 lg:overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1 className="text-lg font-extrabold text-[#173A67]">Mẫu văn bản</h1>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100/80 px-2 py-0.5 font-semibold text-slate-700">
            <strong className="text-[#173A67]">{activeCount}</strong> đang dùng
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-900">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <strong>{standardCount}</strong> mẫu chuẩn (QĐ 933)
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <strong>{customCount}</strong> mẫu tùy chỉnh
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#173A67] bg-white px-3 py-1.5 text-xs font-bold text-[#173A67] transition hover:bg-[#ecf4ff]"
            type="button"
            onClick={() => {
              setError(null);
              setMessage(null);
              setShowSettingsModal(true);
            }}
          >
            <MaterialIcon className="text-[17px]" name="settings" />
            Cài đặt thông tin cố định (Đơn vị)
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-[#173A67] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1E4A7D]"
            type="button"
            onClick={openNew}
          >
            <MaterialIcon className="text-[18px]" name="add" />
            Thêm mẫu tùy chỉnh
          </button>
        </div>
      </div>

      {/* Thanh tóm tắt Cài đặt đơn vị cố định */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d2dfe9] bg-[#f5f9ff] px-3 py-1.5 text-xs text-on-surface-variant">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            Đơn vị: <strong className="text-[#173A67]">{orgSettings.unionHeaderName}</strong>
          </span>
          <span>
            Cấp trên: <strong>{orgSettings.parentUnionName}</strong>
          </span>
          <span>
            Địa danh: <strong>{orgSettings.defaultLocation}</strong> • Đuôi số QĐ:{" "}
            <strong className="font-mono">{orgSettings.decisionCodeSuffix}</strong>
          </span>
        </div>
        <button
          className="text-xs font-bold text-[#173A67] hover:underline"
          type="button"
          onClick={() => setShowSettingsModal(true)}
        >
          Thay đổi cài đặt đơn vị →
        </button>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-[#d2dfe9] bg-white px-3 py-2">
        <div className="inline-flex flex-wrap items-center gap-1.5">
          <button
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
              categoryFilter === "all"
                ? "border-[#173A67] bg-[#173A67] text-white shadow-xs"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
            }`}
            type="button"
            onClick={() => setCategoryFilter("all")}
          >
            Tất cả ({templates.length})
          </button>
          <button
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
              categoryFilter === "standard"
                ? "border-sky-500 bg-sky-100 text-sky-950 ring-2 ring-sky-200"
                : "border-sky-200 bg-sky-50/80 text-sky-900 hover:border-sky-300 hover:bg-sky-100/70"
            }`}
            type="button"
            onClick={() => setCategoryFilter("standard")}
          >
            <MaterialIcon className="text-[15px] text-sky-700" name="menu_book" />
            Mẫu chuẩn QĐ 933 ({standardCount})
          </button>
          <button
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
              categoryFilter === "custom"
                ? "border-amber-500 bg-amber-100 text-amber-950 ring-2 ring-amber-200"
                : "border-amber-200 bg-amber-50/80 text-amber-900 hover:border-amber-300 hover:bg-amber-100/70"
            }`}
            type="button"
            onClick={() => setCategoryFilter("custom")}
          >
            <MaterialIcon className="text-[15px] text-amber-700" name="tune" />
            Mẫu tùy chỉnh ({customCount})
          </button>
        </div>

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
        {query || categoryFilter !== "all" || typeFilter || activeFilter !== "all" ? (
          <button
            className="text-xs font-semibold text-[#4a6b82] hover:text-[#173A67] hover:underline"
            type="button"
            onClick={() => {
              setQuery("");
              setCategoryFilter("all");
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
          emptyText={
            templates.length
              ? "Không có mẫu nào khớp điều kiện lọc."
              : "Chưa có mẫu văn bản nào. Bấm “Thêm mẫu tùy chỉnh” để tạo."
          }
          fill
          rowClassName={(t) => {
            if (!t.isActive) return "bg-surface-container-low/50 opacity-75";
            return getTemplateCategory(t.name) === "standard"
              ? "bg-sky-50/40 hover:bg-sky-100/45"
              : "bg-amber-50/40 hover:bg-amber-100/45";
          }}
          rowKey={(t) => t.id}
          rows={rows}
        />
      </div>

      {draft ? (
        <DocumentTemplateEditor
          initial={draft}
          orgSettings={orgSettings}
          onClose={() => setDraft(null)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onSaved={(saved, created) => {
            setDraft(null);
            setMessage(
              created
                ? `Đã tạo mẫu “${getTemplateDisplayName(saved.name)}” (${TEMPLATE_CATEGORY_LABEL[getTemplateCategory(saved.name)]}).`
                : `Đã lưu mẫu “${getTemplateDisplayName(saved.name)}”.`,
            );
            router.refresh();
          }}
        />
      ) : null}

      {showSettingsModal ? (
        <DocumentSettingsModal
          initial={orgSettings}
          onClose={() => setShowSettingsModal(false)}
          onSaved={(nextSettings) => {
            setOrgSettings(nextSettings);
            setShowSettingsModal(false);
            setMessage("Đã lưu cài đặt thông tin cố định của đơn vị.");
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
