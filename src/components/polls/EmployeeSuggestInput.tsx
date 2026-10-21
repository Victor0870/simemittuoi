"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export type EmployeeSuggestion = {
  employeeCode: string;
  fullName: string;
  department: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPick: (employee: EmployeeSuggestion) => void;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
  searchUrl?: string;
};

export function EmployeeSuggestInput({
  value,
  onChange,
  onPick,
  placeholder,
  className,
  align = "left",
  searchUrl = "/api/polls/employee-search",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EmployeeSuggestion[]>([]);
  const [highlight, setHighlight] = useState(0);
  const typedRef = useRef(false);

  useEffect(() => {
    if (!typedRef.current) return;
    const q = value.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`${searchUrl}?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        setResults(Array.isArray(data.results) ? data.results : []);
        setHighlight(0);
      } catch {
        // bị hủy do gõ tiếp
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value, searchUrl]);

  function pick(emp: EmployeeSuggestion) {
    typedRef.current = false;
    onPick(emp);
    setOpen(false);
    setResults([]);
  }

  const showList = open && value.trim().length > 0 && (loading || results.length > 0 || typedRef.current);

  return (
    <div className="relative min-w-0">
      <input
        autoComplete="off"
        className={className}
        placeholder={placeholder}
        type="text"
        value={value}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          typedRef.current = true;
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + results.length) % results.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList ? (
        <div
          className={`absolute z-30 mt-1 w-72 max-w-[80vw] overflow-hidden rounded-xl border border-outline-variant bg-white shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {loading && results.length === 0 ? (
            <p className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-on-surface-variant">
              <MaterialIcon className="text-[14px] animate-spin" name="sync" />
              Đang tìm...
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-on-surface-variant">
              Không có nhân viên khớp &ldquo;{value.trim()}&rdquo;. Vẫn có thể nhập tay.
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {results.map((emp, i) => (
                <li key={emp.employeeCode}>
                  <button
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition ${
                      i === highlight ? "bg-primary/10" : "hover:bg-surface-container-low"
                    }`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(emp)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-[#173A67]">{emp.fullName}</span>
                      {emp.department ? (
                        <span className="block truncate text-[11px] text-on-surface-variant">{emp.department}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 rounded-md bg-surface-container-high px-1.5 py-0.5 text-[11px] font-bold text-on-surface-variant">
                      {emp.employeeCode}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
