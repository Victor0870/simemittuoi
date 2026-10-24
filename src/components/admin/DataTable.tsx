"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ColumnFilter,
  EMPTY_LABEL,
  isFilterActive,
  normalizeText,
  type ColumnFilterOption,
  type ColumnFilterState,
  type ColumnFilterType,
  type SortDir,
} from "@/components/admin/ColumnFilter";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export type DataTableCellValue = string | number | Date | null | undefined;

export type DataTableColumn<T> = {
  key: string;
  header: string;
  type?: ColumnFilterType;
  /** Giá trị dùng để lọc / sắp xếp; mặc định lấy row[key]. */
  accessor?: (row: T) => DataTableCellValue;
  render?: (row: T) => ReactNode;
  filterable?: boolean;
  className?: string;
  headerClassName?: string;
};

export type DataTablePageSize = 10 | 20 | 50;

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  rowClassName?: (row: T) => string;
  emptyText?: string;
  defaultPageSize?: DataTablePageSize;
  maxHeightClass?: string;
  footerNote?: ReactNode;
  /** Dòng <tr> luôn ở đầu tbody mọi trang, không bị lọc / sắp xếp / phân trang. */
  pinnedRows?: ReactNode;
  /** Dòng <tr> trong tfoot (tổng cộng...). */
  footerRows?: ReactNode;
  /** Ghi chú hiện khi đang sắp xếp theo một cột. */
  sortHint?: ReactNode;
  /**
   * Từ lg trở lên: bảng giãn hết chiều cao khung cha (cha cần chiều cao cố định, min-h-0),
   * chỉ thân bảng cuộn, thanh phân trang luôn ở đáy. Dưới lg vẫn dùng maxHeightClass.
   */
  fill?: boolean;
};

type Cell = { label: string; norm: string; num: number | null; day: string | null; sortValue: number | string | null };
type PreparedRow<T> = { row: T; cells: Cell[] };

const PAGE_SIZES: DataTablePageSize[] = [10, 20, 50];

const pad = (n: number) => String(n).padStart(2, "0");

function rawValue<T>(column: DataTableColumn<T>, row: T): DataTableCellValue {
  if (column.accessor) return column.accessor(row);
  const value = (row as Record<string, unknown>)[column.key];
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) return value;
  return String(value);
}

function buildCell<T>(column: DataTableColumn<T>, row: T): Cell {
  const type = column.type ?? "text";
  const value = rawValue(column, row);
  if (type === "date") {
    const dateOnly = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
    const date =
      value == null || value === ""
        ? null
        : value instanceof Date
          ? value
          : dateOnly
            ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
            : new Date(value);
    if (!date || Number.isNaN(date.getTime())) return { label: "", norm: "", num: null, day: null, sortValue: null };
    const label = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return { label, norm: label, num: null, day, sortValue: date.getTime() };
  }
  if (type === "number") {
    const num = value == null || value === "" ? null : Number(value);
    if (num == null || !Number.isFinite(num)) return { label: "", norm: "", num: null, day: null, sortValue: null };
    const label = num.toLocaleString("vi-VN");
    return { label, norm: label, num, day: null, sortValue: num };
  }
  const label = value == null ? "" : value instanceof Date ? value.toLocaleString("vi-VN") : String(value).trim();
  return { label, norm: normalizeText(label), num: null, day: null, sortValue: label || null };
}

function passes(cell: Cell, type: ColumnFilterType, filter: ColumnFilterState): boolean {
  if (filter.values && !filter.values.includes(cell.label)) return false;
  const q = normalizeText(filter.contains.trim());
  if (q && !cell.norm.includes(q)) return false;
  if (type === "number") {
    if (filter.min !== "" && (cell.num == null || cell.num < Number(filter.min))) return false;
    if (filter.max !== "" && (cell.num == null || cell.num > Number(filter.max))) return false;
  }
  if (type === "date") {
    if (filter.min && (!cell.day || cell.day < filter.min)) return false;
    if (filter.max && (!cell.day || cell.day > filter.max)) return false;
  }
  return true;
}

function compareValues(a: number | string | null, b: number | string | null): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "vi", { numeric: true, sensitivity: "base" });
}

function formatBound(value: string, type: ColumnFilterType): string {
  if (type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return value;
}

function describeFilter(filter: ColumnFilterState, type: ColumnFilterType): string {
  const parts: string[] = [];
  if (filter.contains.trim()) parts.push(`chứa “${filter.contains.trim()}”`);
  if (filter.values) {
    if (filter.values.length === 0) parts.push("không chọn giá trị nào");
    else if (filter.values.length <= 2) parts.push(filter.values.map((v) => v || EMPTY_LABEL).join(", "));
    else parts.push(`${filter.values.length} giá trị`);
  }
  if (filter.min && filter.max) parts.push(`${formatBound(filter.min, type)} – ${formatBound(filter.max, type)}`);
  else if (filter.min) parts.push(`từ ${formatBound(filter.min, type)}`);
  else if (filter.max) parts.push(`đến ${formatBound(filter.max, type)}`);
  return parts.join("; ");
}

function pageItems(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const items: (number | "gap")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(count - 1, current + 1);
  if (from > 2) items.push("gap");
  for (let i = from; i <= to; i++) items.push(i);
  if (to < count - 1) items.push("gap");
  items.push(count);
  return items;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowClassName,
  emptyText = "Không có dữ liệu",
  defaultPageSize = 20,
  maxHeightClass = "max-h-[calc(100vh-320px)] min-h-[240px]",
  footerNote,
  pinnedRows,
  footerRows,
  sortHint,
  fill = false,
}: DataTableProps<T>) {
  const [filters, setFilters] = useState<Record<string, ColumnFilterState>>({});
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);
  const [pageSize, setPageSize] = useState<DataTablePageSize>(defaultPageSize);
  const [page, setPage] = useState(1);
  const rowsSignature = rows.map(rowKey).join("\u0001");
  const [seenSignature, setSeenSignature] = useState(rowsSignature);

  if (seenSignature !== rowsSignature) {
    setSeenSignature(rowsSignature);
    setPage(1);
  }

  const prepared = useMemo<PreparedRow<T>[]>(
    () => rows.map((row) => ({ row, cells: columns.map((column) => buildCell(column, row)) })),
    [rows, columns],
  );

  const activeFilters = columns
    .map((column, index) => ({ column, index, filter: filters[column.key] }))
    .filter((entry): entry is { column: DataTableColumn<T>; index: number; filter: ColumnFilterState } =>
      isFilterActive(entry.filter),
    );

  function filterRows(skipIndex: number | null): PreparedRow<T>[] {
    const entries = activeFilters.filter((entry) => entry.index !== skipIndex);
    if (entries.length === 0) return prepared;
    return prepared.filter((p) => entries.every((e) => passes(p.cells[e.index], e.column.type ?? "text", e.filter)));
  }

  const filtered = filterRows(null);
  const sortIndex = sort ? columns.findIndex((column) => column.key === sort.key) : -1;
  const sorted =
    sort && sortIndex >= 0
      ? [...filtered].sort((a, b) => {
          const av = a.cells[sortIndex].sortValue;
          const bv = b.cells[sortIndex].sortValue;
          if (av == null || bv == null) return av == null ? (bv == null ? 0 : 1) : -1;
          const result = compareValues(av, bv);
          return sort.dir === "asc" ? result : -result;
        })
      : filtered;

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);
  const from = total === 0 ? 0 : start + 1;
  const to = start + pageRows.length;
  const isFiltered = activeFilters.length > 0;

  function getOptions(index: number): ColumnFilterOption[] {
    const counts = new Map<string, { count: number; sortValue: number | string | null }>();
    for (const p of filterRows(index)) {
      const cell = p.cells[index];
      const hit = counts.get(cell.label);
      if (hit) hit.count += 1;
      else counts.set(cell.label, { count: 1, sortValue: cell.sortValue });
    }
    return Array.from(counts.entries())
      .sort(([, a], [, b]) => {
        if (a.sortValue == null || b.sortValue == null) return a.sortValue == null ? (b.sortValue == null ? 0 : 1) : -1;
        return compareValues(a.sortValue, b.sortValue);
      })
      .map(([value, { count }]) => ({ value, count }));
  }

  function setColumnFilter(key: string, filter: ColumnFilterState | null) {
    setFilters((prev) => {
      const next = { ...prev };
      if (filter) next[key] = filter;
      else delete next[key];
      return next;
    });
    setPage(1);
  }

  const navButton =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className={fill ? "flex flex-col gap-3 lg:h-full lg:min-h-0 lg:flex-1" : "space-y-3"}>
      {sort && sortHint ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-on-surface-variant print:hidden">
          <MaterialIcon className="text-[#4a6b82]" name="info" size={16} />
          <span>{sortHint}</span>
          <button
            className="font-semibold text-[#4a6b82] hover:text-[#173A67] hover:underline"
            type="button"
            onClick={() => {
              setSort(null);
              setPage(1);
            }}
          >
            Bỏ sắp xếp
          </button>
        </div>
      ) : null}

      {isFiltered ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs print:hidden">
          {activeFilters.map(({ column, filter }) => (
            <span
              key={column.key}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#4a6b82]/30 bg-[#ecf4ff] py-1 pl-3 pr-1 text-[#173A67]"
            >
              <span className="truncate">
                <strong className="font-semibold">{column.header}:</strong> {describeFilter(filter, column.type ?? "text")}
              </span>
              <button
                aria-label={`Bỏ lọc cột ${column.header}`}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#4a6b82] hover:bg-[#4a6b82]/15"
                type="button"
                onClick={() => setColumnFilter(column.key, null)}
              >
                <MaterialIcon name="close" size={14} />
              </button>
            </span>
          ))}
          <button
            className="font-semibold text-[#4a6b82] hover:text-[#173A67] hover:underline"
            type="button"
            onClick={() => {
              setFilters({});
              setPage(1);
            }}
          >
            Xóa tất cả bộ lọc
          </button>
        </div>
      ) : null}

      <div
        className={`overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xs ${
          fill ? "flex flex-col lg:min-h-0 lg:flex-1" : ""
        }`}
      >
        <div
          className={`overflow-auto ${maxHeightClass} ${
            fill ? "lg:max-h-none lg:min-h-0 lg:flex-1" : ""
          } print:max-h-none print:overflow-visible`}
        >
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#ecf4ff] text-[#173A67]">
              <tr>
                {columns.map((column, index) => {
                  const type = column.type ?? "text";
                  const sortDir = sort?.key === column.key ? sort.dir : null;
                  return (
                    <th
                      key={column.key}
                      aria-sort={sortDir === "asc" ? "ascending" : sortDir === "desc" ? "descending" : undefined}
                      className={`whitespace-nowrap px-4 py-3 font-bold shadow-[inset_0_-1px_0_rgb(0_0_0/0.08)] ${column.headerClassName ?? ""}`}
                      scope="col"
                    >
                      <span className="inline-flex items-center gap-1 align-middle">
                        <span>{column.header}</span>
                        {sortDir ? <MaterialIcon className="text-[#4a6b82]" name={sortDir === "asc" ? "arrow_upward" : "arrow_downward"} size={14} /> : null}
                        {column.filterable !== false ? (
                          <ColumnFilter
                            filter={filters[column.key]}
                            getOptions={() => getOptions(index)}
                            label={column.header}
                            sortDir={sortDir}
                            type={type}
                            onApply={(filter) => setColumnFilter(column.key, filter)}
                            onSort={(dir) => {
                              setSort(dir ? { key: column.key, dir } : null);
                              setPage(1);
                            }}
                          />
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pinnedRows}
              {pageRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-on-surface-variant" colSpan={columns.length}>
                    {isFiltered && rows.length > 0 ? "Không có dòng nào khớp bộ lọc" : emptyText}
                  </td>
                </tr>
              ) : (
                pageRows.map(({ row }) => (
                  <tr
                    key={rowKey(row)}
                    className={`border-t border-outline-variant hover:bg-surface-container-low/50 ${rowClassName?.(row) ?? ""}`}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={`px-4 py-3 ${column.className ?? ""}`}>
                        {column.render ? column.render(row) : (() => {
                          const value = rawValue(column, row);
                          return value instanceof Date ? value.toLocaleString("vi-VN") : value ?? "—";
                        })()}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {footerRows ? <tfoot>{footerRows}</tfoot> : null}
          </table>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-outline-variant bg-white px-4 py-2.5 text-xs text-on-surface-variant print:hidden">
          <span>
            Hiển thị {from}–{to} / {isFiltered ? `${total} (lọc từ ${rows.length})` : `tổng ${total}`}
          </span>
          <label className="flex items-center gap-2">
            <span>Số dòng:</span>
            <select
              className="rounded-lg border border-outline-variant bg-white px-2 py-1 text-xs text-on-surface focus:border-[#4a6b82]"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as DataTablePageSize);
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <nav aria-label="Phân trang" className="flex items-center gap-1">
            <button aria-label="Trang đầu" className={`${navButton} text-[#173A67] hover:bg-[#ecf4ff]`} disabled={currentPage <= 1} type="button" onClick={() => setPage(1)}>
              «
            </button>
            <button aria-label="Trang trước" className={`${navButton} text-[#173A67] hover:bg-[#ecf4ff]`} disabled={currentPage <= 1} type="button" onClick={() => setPage(currentPage - 1)}>
              ‹
            </button>
            {pageItems(currentPage, pageCount).map((item, i) =>
              item === "gap" ? (
                <span key={`gap-${i}`} className="px-1">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  aria-current={item === currentPage ? "page" : undefined}
                  className={`${navButton} ${item === currentPage ? "bg-[#4a6b82] text-white" : "text-[#173A67] hover:bg-[#ecf4ff]"}`}
                  type="button"
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ),
            )}
            <button aria-label="Trang sau" className={`${navButton} text-[#173A67] hover:bg-[#ecf4ff]`} disabled={currentPage >= pageCount} type="button" onClick={() => setPage(currentPage + 1)}>
              ›
            </button>
            <button aria-label="Trang cuối" className={`${navButton} text-[#173A67] hover:bg-[#ecf4ff]`} disabled={currentPage >= pageCount} type="button" onClick={() => setPage(pageCount)}>
              »
            </button>
          </nav>
        </div>
        {footerNote ? (
          <div className="shrink-0 border-t border-outline-variant/60 bg-white px-4 py-2 text-xs italic text-on-surface-variant">{footerNote}</div>
        ) : null}
      </div>
    </div>
  );
}
