"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export type ColumnFilterType = "text" | "number" | "date" | "enum";
export type SortDir = "asc" | "desc";
/** values = null nghĩa là không lọc theo giá trị; min/max là số hoặc yyyy-mm-dd. */
export type ColumnFilterState = { values: string[] | null; contains: string; min: string; max: string };
export type ColumnFilterOption = { value: string; count: number };

export const EMPTY_LABEL = "(Trống)";

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

export function isFilterActive(filter: ColumnFilterState | undefined | null): filter is ColumnFilterState {
  if (!filter) return false;
  return filter.values !== null || filter.contains.trim() !== "" || filter.min !== "" || filter.max !== "";
}

const SORT_LABELS: Record<ColumnFilterType, [string, string]> = {
  text: ["Sắp xếp A→Z", "Sắp xếp Z→A"],
  enum: ["Sắp xếp A→Z", "Sắp xếp Z→A"],
  number: ["Nhỏ → lớn", "Lớn → nhỏ"],
  date: ["Cũ → mới", "Mới → cũ"],
};

function Highlight({ text, query }: { text: string; query: string }) {
  const q = normalizeText(query.trim());
  if (!q) return <>{text}</>;
  let normalized = "";
  const sourceIndex: number[] = [];
  let offset = 0;
  for (const ch of text) {
    const n = normalizeText(ch);
    for (let k = 0; k < n.length; k++) {
      normalized += n[k];
      sourceIndex.push(offset);
    }
    offset += ch.length;
  }
  const at = normalized.indexOf(q);
  if (at < 0) return <>{text}</>;
  const start = sourceIndex[at];
  const lastStart = sourceIndex[at + q.length - 1];
  let end = lastStart + ((text.codePointAt(lastStart) ?? 0) > 0xffff ? 2 : 1);
  while (end < text.length && /[\u0300-\u036f]/.test(text[end])) end++;
  return (
    <>
      {text.slice(0, start)}
      <strong className="font-bold text-[#173A67]">{text.slice(start, end)}</strong>
      {text.slice(end)}
    </>
  );
}

type Props = {
  label: string;
  type: ColumnFilterType;
  filter: ColumnFilterState | undefined;
  sortDir: SortDir | null;
  /** Giá trị phân biệt của cột, tính trên các dòng đã lọc bởi những cột khác. */
  getOptions: () => ColumnFilterOption[];
  onApply: (filter: ColumnFilterState | null) => void;
  onSort: (dir: SortDir | null) => void;
};

export function ColumnFilter({ label, type, filter, sortDir, getOptions, onApply, onSort }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ColumnFilterOption[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const active = isFilterActive(filter);
  const hasRange = type === "number" || type === "date";
  const query = normalizeText(search.trim());
  const visible = query ? options.filter((o) => normalizeText(o.value || EMPTY_LABEL).includes(query)) : options;

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setPos(null);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  function openPopover() {
    setOptions(getOptions());
    setSearch(filter?.contains ?? "");
    setDraft(filter?.values ? new Set(filter.values) : null);
    setMin(filter?.min ?? "");
    setMax(filter?.max ?? "");
    setOpen(true);
  }

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    const popover = popoverRef.current;
    if (!button || !popover) return;
    const rect = button.getBoundingClientRect();
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    let top = rect.bottom + 4;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 4);
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePosition) : null;
    if (observer && popoverRef.current) observer.observe(popoverRef.current);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      observer?.disconnect();
    };
  }, [open, close, updatePosition]);

  function apply(containsOnly: boolean) {
    const text = search.trim();
    let values: string[] | null = null;
    let contains = "";
    if (containsOnly && text) {
      contains = text;
    } else if (draft !== null) {
      values = options.every((o) => draft.has(o.value)) ? null : options.filter((o) => draft.has(o.value)).map((o) => o.value);
    } else if (text) {
      contains = text;
    }
    const next: ColumnFilterState = { values, contains, min: hasRange ? min.trim() : "", max: hasRange ? max.trim() : "" };
    onApply(isFilterActive(next) ? next : null);
    close(true);
  }

  function toggle(value: string) {
    setDraft((prev) => {
      const next = new Set(prev ?? options.map((o) => o.value));
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function selectVisible() {
    setDraft((prev) => {
      if (!query) return null;
      const next = new Set(prev ?? []);
      visible.forEach((o) => next.add(o.value));
      return next;
    });
  }

  function clearVisible() {
    setDraft((prev) => {
      const next = new Set(prev ?? options.map((o) => o.value));
      visible.forEach((o) => next.delete(o.value));
      return next;
    });
  }

  function onEnter(event: KeyboardEvent<HTMLInputElement>, containsOnly: boolean) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    apply(containsOnly && search.trim() !== "");
  }

  const [ascLabel, descLabel] = SORT_LABELS[type];
  const inputClass =
    "w-full rounded-lg border border-outline-variant bg-white px-2.5 py-1.5 text-sm text-on-surface focus:border-[#4a6b82] focus:outline-hidden focus:ring-2 focus:ring-[#4a6b82]/20";

  return (
    <>
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Lọc cột ${label}`}
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition print:hidden ${
          active || open
            ? "bg-[#4a6b82]/15 text-[#4a6b82]"
            : "text-[#173A67]/45 hover:bg-white/70 hover:text-[#4a6b82]"
        }`}
        title={`Lọc / sắp xếp cột ${label}`}
        type="button"
        onClick={() => (open ? close(false) : openPopover())}
      >
        <MaterialIcon filled={active} name="filter_alt" size={16} />
      </button>

      {open
        ? createPortal(
            <div
              ref={popoverRef}
              aria-label={`Bộ lọc cột ${label}`}
              className="fixed z-[60] max-h-[calc(100vh-16px)] w-72 overflow-y-auto rounded-xl border border-outline-variant bg-white p-3 text-left text-sm font-normal text-on-surface shadow-xl"
              role="dialog"
              style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
            >
              <div className="mb-2 grid grid-cols-2 gap-1.5">
                {([
                  ["asc", ascLabel, "arrow_upward"],
                  ["desc", descLabel, "arrow_downward"],
                ] as const).map(([dir, text, icon]) => (
                  <button
                    key={dir}
                    className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                      sortDir === dir
                        ? "border-[#4a6b82] bg-[#4a6b82] text-white"
                        : "border-outline-variant text-[#173A67] hover:bg-[#ecf4ff]"
                    }`}
                    type="button"
                    onClick={() => {
                      onSort(sortDir === dir ? null : dir);
                      close(true);
                    }}
                  >
                    <MaterialIcon name={icon} size={14} />
                    {text}
                  </button>
                ))}
              </div>

              <input
                autoFocus
                className={inputClass}
                placeholder="Tìm giá trị…"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => onEnter(e, true)}
              />

              <div className="mt-2 flex items-center justify-between text-xs">
                <button className="font-semibold text-[#4a6b82] hover:text-[#173A67] hover:underline" type="button" onClick={selectVisible}>
                  Chọn tất cả (kết quả tìm)
                </button>
                <button className="font-semibold text-on-surface-variant hover:text-[#173A67] hover:underline" type="button" onClick={clearVisible}>
                  Bỏ chọn
                </button>
              </div>

              <div className="mt-1.5 max-h-56 overflow-auto rounded-lg border border-outline-variant/70 p-1">
                {visible.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-on-surface-variant">Không có giá trị phù hợp</p>
                ) : (
                  visible.map((o) => (
                    <label
                      key={o.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-[#ecf4ff]"
                      title={o.value || EMPTY_LABEL}
                    >
                      <input
                        checked={draft === null || draft.has(o.value)}
                        className="h-4 w-4 shrink-0 accent-[#4a6b82]"
                        type="checkbox"
                        onChange={() => toggle(o.value)}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {o.value ? <Highlight query={search} text={o.value} /> : <span className="italic text-on-surface-variant">{EMPTY_LABEL}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-on-surface-variant">{o.count}</span>
                    </label>
                  ))
                )}
              </div>

              {hasRange ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs font-semibold text-on-surface-variant">
                    <span>{type === "date" ? "Từ ngày" : "Từ"}</span>
                    <input className={inputClass} type={type} value={min} onChange={(e) => setMin(e.target.value)} onKeyDown={(e) => onEnter(e, false)} />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-on-surface-variant">
                    <span>{type === "date" ? "Đến ngày" : "Đến"}</span>
                    <input className={inputClass} type={type} value={max} onChange={(e) => setMax(e.target.value)} onKeyDown={(e) => onEnter(e, false)} />
                  </label>
                </div>
              ) : null}

              <div className="mt-3 flex items-center justify-end gap-2 border-t border-outline-variant/60 pt-3">
                <button
                  className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:bg-surface-container-high"
                  type="button"
                  onClick={() => {
                    onApply(null);
                    close(true);
                  }}
                >
                  Xóa lọc
                </button>
                <button
                  className="rounded-lg bg-[#4a6b82] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#173A67]"
                  type="button"
                  onClick={() => apply(false)}
                >
                  Áp dụng
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
