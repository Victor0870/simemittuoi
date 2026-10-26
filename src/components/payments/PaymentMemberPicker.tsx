"use client";

import { useState } from "react";
import { foldText } from "@/lib/catalogs/registry";
import type { PaymentMember } from "@/lib/payments/server";

type Field = "name" | "code";

type Props = {
  members: PaymentMember[];
  memberId: string;
  onPick: (member: PaymentMember | null) => void;
  inputClass: string;
  labelClass: string;
};

const MAX_SUGGESTIONS = 8;

function sameCode(a: string | null, b: string): boolean {
  return Boolean(a) && a!.trim().toUpperCase() === b.trim().toUpperCase();
}

export function PaymentMemberPicker({ members, memberId, onPick, inputClass, labelClass }: Props) {
  const picked = members.find((m) => m.id === memberId) ?? null;
  const [name, setName] = useState(picked?.full_name ?? "");
  const [code, setCode] = useState(picked?.employee_code ?? "");
  const [open, setOpen] = useState<Field | null>(null);
  const [active, setActive] = useState(0);

  const query = open === "code" ? code : name;
  const q = foldText(query.trim());
  const suggestions = q
    ? members
        .filter((m) =>
          open === "code"
            ? foldText(m.employee_code ?? "").includes(q)
            : foldText(`${m.full_name} ${m.employee_code ?? ""}`).includes(q),
        )
        .slice(0, MAX_SUGGESTIONS)
    : [];

  function choose(m: PaymentMember) {
    setName(m.full_name);
    setCode(m.employee_code ?? "");
    setOpen(null);
    onPick(m);
  }

  function change(field: Field, value: string) {
    if (field === "name") setName(value);
    else setCode(value);
    setOpen(field);
    setActive(0);
    if (field === "code") {
      const exact = members.find((m) => sameCode(m.employee_code, value));
      if (exact) {
        setName(exact.full_name);
        if (exact.id !== memberId) onPick(exact);
        return;
      }
    }
    if (memberId) onPick(null);
  }

  function keyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(suggestions[Math.min(active, suggestions.length - 1)]);
    } else if (e.key === "Escape") {
      setOpen(null);
    }
  }

  const list = (field: Field) =>
    open === field && suggestions.length ? (
      <ul className="absolute z-20 mt-1 max-h-64 w-full min-w-[260px] overflow-y-auto rounded-xl border border-outline-variant bg-white py-1 shadow-lg">
        {suggestions.map((m, i) => (
          <li key={m.id}>
            <button
              className={`block w-full px-3 py-1.5 text-left text-sm ${i === active ? "bg-[#173A67]/10" : "hover:bg-surface-container-low"}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                choose(m);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <b>{m.employee_code ?? "—"}</b> · {m.full_name}
              {m.department ? <span className="text-xs text-on-surface-variant"> · {m.department}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    ) : open === field && q ? (
      <p className="absolute z-20 mt-1 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface-variant shadow-lg">
        Không tìm thấy đoàn viên phù hợp.
      </p>
    ) : null;

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
      <div className="relative">
        <label className={labelClass}>Họ tên đoàn viên</label>
        <input
          autoComplete="off"
          className={inputClass}
          placeholder="Nhập tên để tìm"
          value={name}
          onBlur={() => setOpen(null)}
          onChange={(e) => change("name", e.target.value)}
          onFocus={() => name && !memberId && setOpen("name")}
          onKeyDown={keyDown}
        />
        {list("name")}
      </div>
      <div className="relative">
        <label className={labelClass}>Mã NV</label>
        <input
          autoComplete="off"
          className={inputClass}
          placeholder="Hoặc nhập mã NV"
          value={code}
          onBlur={() => setOpen(null)}
          onChange={(e) => change("code", e.target.value)}
          onFocus={() => code && !memberId && setOpen("code")}
          onKeyDown={keyDown}
        />
        {list("code")}
      </div>
    </div>
  );
}
