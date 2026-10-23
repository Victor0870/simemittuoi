"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { FundCategory } from "@/lib/finance/registry";
import {
  LINE_TYPE_LABEL,
  TEMPLATE_LIMITS,
  TEMPLATE_SIDE_LABEL,
  VERSION_STATUS_LABEL,
  isItemCode,
  lineDepth,
  sideLines,
  validateTemplateLines,
  type ReportTemplate,
  type TemplateLine,
  type TemplateLineType,
  type TemplateSide,
  type TemplateVersion,
} from "@/lib/report-templates/registry";

type Props = {
  template: ReportTemplate | null;
  canEdit: boolean;
  categories: FundCategory[];
  today: string;
};

type Result = { error: string | null; data: Record<string, unknown> };

const SIDES: TemplateSide[] = ["income", "expense"];
const inputClass =
  "w-full rounded-lg border border-outline-variant bg-white px-2 py-1.5 text-sm outline-none focus:border-[#173A67]";
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";
const buttonClass =
  "inline-flex items-center gap-1 rounded-full border border-outline-variant bg-white px-3 py-1.5 text-sm font-bold text-on-surface-variant hover:border-[#173A67] disabled:opacity-50";
const primaryClass =
  "inline-flex items-center gap-1 rounded-full bg-[#173A67] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#0f2a4d] disabled:opacity-50";

async function postTemplate(body: unknown): Promise<Result> {
  try {
    const res = await fetch("/api/report-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { error: res.ok ? null : ((data.error as string) ?? "Không lưu được."), data };
  } catch {
    return { error: "Mất kết nối, vui lòng thử lại.", data: {} };
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Bảng chỉ đọc các dòng của một phiên bản. */
function LinesTable({ lines, categories }: { lines: TemplateLine[]; categories: FundCategory[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {SIDES.map((side) => {
        const rows = sideLines(lines, side);
        return (
          <div key={side} className="overflow-hidden rounded-xl border border-outline-variant">
            <p className="bg-[#173A67] px-3 py-1.5 text-sm font-bold text-white">{TEMPLATE_SIDE_LABEL[side]}</p>
            <table className="w-full text-sm">
              <tbody>
                {rows.map((l) => {
                  const mapped = categories.filter((c) => c.kind === side && c.is_active && c.report_group === l.code).length;
                  return (
                    <tr
                      key={l.code}
                      className={`border-t border-outline-variant/60 ${l.line_type === "subtotal" ? "bg-[#173A67]/5 font-bold" : ""} ${
                        l.line_type === "group" ? "font-semibold" : ""
                      }`}
                    >
                      <td className="w-16 px-2 py-1.5 align-top text-xs text-on-surface-variant">
                        {l.line_type === "subtotal" ? "" : l.code}
                      </td>
                      <td className="py-1.5 pr-2" style={{ paddingLeft: `${lineDepth(rows, l) * 1.25}rem` }}>
                        {l.label}
                        {l.line_type === "subtotal" ? (
                          <span className="block text-[11px] font-normal text-on-surface-variant">= {l.sum_codes.join(" + ")}</span>
                        ) : null}
                      </td>
                      <td className="w-24 px-2 py-1.5 text-right text-[11px] text-on-surface-variant">
                        {l.line_type === "item" ? (mapped ? `${mapped} danh mục` : "chưa có danh mục") : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

type EditRow = TemplateLine & { key: number; sumText: string };

function toEditRows(lines: TemplateLine[]): EditRow[] {
  return SIDES.flatMap((side) => sideLines(lines, side)).map((l, i) => ({ ...l, key: i, sumText: l.sum_codes.join(", ") }));
}

function toLines(rows: EditRow[]): TemplateLine[] {
  return rows.map(({ key: _k, sumText, ...l }, i) => ({
    ...l,
    code: l.code.trim(),
    label: l.label.trim(),
    parent_code: l.line_type === "subtotal" ? null : l.parent_code || null,
    sum_codes:
      l.line_type === "subtotal"
        ? [
            ...new Set(
              sumText
                .split(/[,;+\s]+/)
                .map((s) => s.trim())
                .filter(Boolean),
            ),
          ]
        : [],
    sort_order: (i + 1) * 10,
  }));
}

/** Soạn bản nháp: sửa dòng, lưu nháp, áp dụng hoặc hủy. */
function DraftEditor({
  draft,
  categories,
  today,
}: {
  draft: TemplateVersion;
  categories: FundCategory[];
  today: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(draft.title);
  const [note, setNote] = useState(draft.note ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [rows, setRows] = useState<EditRow[]>(() => toEditRows(draft.lines));
  const [nextKey, setNextKey] = useState(draft.lines.length + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lines = useMemo(() => toLines(rows), [rows]);
  const errors = useMemo(() => validateTemplateLines(lines), [lines]);
  const orphaned = categories.filter((c) => c.is_active && !isItemCode(lines, c.kind, c.report_group));

  function update(key: number, patch: Partial<EditRow>) {
    setRows((prev) => {
      const target = prev.find((r) => r.key === key);
      if (!target) return prev;
      const renamed = patch.code !== undefined && patch.code !== target.code ? { from: target.code, to: patch.code } : null;
      return prev.map((r) => {
        if (r.key === key) return { ...r, ...patch };
        if (!renamed || r.side !== target.side) return r;
        const sums = r.sumText.split(/\s*,\s*/).map((s) => (s === renamed.from ? renamed.to : s));
        return {
          ...r,
          parent_code: r.parent_code === renamed.from ? renamed.to : r.parent_code,
          sumText: r.line_type === "subtotal" ? sums.join(", ") : r.sumText,
        };
      });
    });
  }

  function move(key: number, delta: -1 | 1) {
    setRows((prev) => {
      const index = prev.findIndex((r) => r.key === key);
      const side = prev[index]?.side;
      let j = index + delta;
      while (j >= 0 && j < prev.length && prev[j].side !== side) j += delta;
      if (index < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function remove(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function add(side: TemplateSide) {
    setRows((prev) => {
      const row: EditRow = {
        key: nextKey,
        side,
        code: "",
        label: "",
        line_type: "item",
        parent_code: null,
        sum_codes: [],
        sort_order: 0,
        sumText: "",
      };
      const lastIndex = prev.map((r) => r.side).lastIndexOf(side);
      const next = [...prev];
      next.splice(lastIndex < 0 ? (side === "income" ? 0 : prev.length) : lastIndex + 1, 0, row);
      return next;
    });
    setNextKey((k) => k + 1);
  }

  async function save(): Promise<boolean> {
    if (errors.length) {
      setError("Bản nháp còn lỗi – xem danh sách bên dưới.");
      return false;
    }
    const res = await postTemplate({ action: "saveDraft", versionId: draft.id, title, note, lines });
    if (res.error) setError(res.error);
    return !res.error;
  }

  async function run(action: "save" | "publish" | "discard") {
    setError(null);
    setMessage(null);
    if (action === "discard" && !window.confirm("Hủy bản nháp này? Các thay đổi chưa áp dụng sẽ mất.")) return;
    if (action === "publish") {
      if (!effectiveFrom) {
        setError("Vui lòng chọn ngày bắt đầu áp dụng.");
        return;
      }
      const warn = orphaned.length
        ? `\n\nLưu ý: ${orphaned.length} danh mục sẽ chưa có chỉ tiêu (cần chọn lại): ${orphaned.map((c) => c.name).join(", ")}.`
        : "";
      if (!window.confirm(`Áp dụng phiên bản ${draft.version} cho toàn bộ đơn vị từ ${formatDate(effectiveFrom)}?${warn}`)) return;
    }
    setBusy(true);
    if (action === "discard") {
      const res = await postTemplate({ action: "discardDraft", versionId: draft.id });
      setBusy(false);
      if (res.error) return setError(res.error);
      router.refresh();
      return;
    }
    const saved = await save();
    if (!saved) return setBusy(false);
    if (action === "save") {
      setBusy(false);
      setMessage("Đã lưu bản nháp.");
      router.refresh();
      return;
    }
    const res = await postTemplate({ action: "publish", versionId: draft.id, effectiveFrom, note });
    setBusy(false);
    if (res.error) return setError(res.error);
    const left = (res.data.orphaned as string[] | undefined) ?? [];
    window.alert(
      left.length
        ? `Đã áp dụng phiên bản mới. Còn ${left.length} danh mục cần chọn lại chỉ tiêu: ${left.join(", ")}.`
        : "Đã áp dụng phiên bản mới. Mọi danh mục vẫn giữ đúng chỉ tiêu.",
    );
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-[#173A67]">Bản nháp phiên bản {draft.version}</h2>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
          Chưa áp dụng – báo cáo vẫn dùng phiên bản hiện tại
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
        <div>
          <label className={labelClass}>Tên phiên bản *</label>
          <input className={inputClass} maxLength={TEMPLATE_LIMITS.title} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Áp dụng từ ngày *</label>
          <input className={inputClass} type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Nội dung thay đổi (VD: theo Hướng dẫn số …/HD-TLĐ)</label>
        <textarea
          className={inputClass}
          maxLength={TEMPLATE_LIMITS.note}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {SIDES.map((side) => {
        const sideRows = rows.filter((r) => r.side === side);
        const groups = sideRows.filter((r) => r.line_type === "group" && r.code.trim());
        return (
          <div key={side} className="space-y-2">
            <p className="text-sm font-bold text-[#173A67]">{TEMPLATE_SIDE_LABEL[side]}</p>
            <div className="hidden grid-cols-[80px_1fr_150px_120px_96px] gap-2 px-2 text-[11px] font-bold text-on-surface-variant sm:grid">
              <span>Mã</span>
              <span>Tên dòng</span>
              <span>Loại</span>
              <span>Thuộc nhóm</span>
              <span />
            </div>
            {sideRows.map((r) => (
              <div key={r.key} className="space-y-1 rounded-xl border border-outline-variant bg-white p-2">
                <div className="grid gap-2 sm:grid-cols-[80px_1fr_150px_120px_96px]">
                  <input
                    className={inputClass}
                    maxLength={TEMPLATE_LIMITS.code}
                    placeholder="Mã"
                    value={r.code}
                    onChange={(e) => update(r.key, { code: e.target.value.replace(/\s/g, "") })}
                  />
                  <input
                    className={inputClass}
                    maxLength={TEMPLATE_LIMITS.label}
                    placeholder="Tên dòng"
                    value={r.label}
                    onChange={(e) => update(r.key, { label: e.target.value })}
                  />
                  <select
                    className={inputClass}
                    value={r.line_type}
                    onChange={(e) => update(r.key, { line_type: e.target.value as TemplateLineType })}
                  >
                    {(Object.keys(LINE_TYPE_LABEL) as TemplateLineType[]).map((t) => (
                      <option key={t} value={t}>
                        {LINE_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputClass}
                    disabled={r.line_type === "subtotal"}
                    value={r.parent_code ?? ""}
                    onChange={(e) => update(r.key, { parent_code: e.target.value || null })}
                  >
                    <option value="">— Dòng gốc —</option>
                    {groups
                      .filter((g) => g.key !== r.key)
                      .map((g) => (
                        <option key={g.key} value={g.code}>
                          {g.code}
                        </option>
                      ))}
                  </select>
                  <div className="flex items-center justify-end gap-0.5">
                    <button className="rounded p-1 hover:bg-surface-container" title="Lên" type="button" onClick={() => move(r.key, -1)}>
                      <MaterialIcon className="text-[18px]" name="arrow_upward" />
                    </button>
                    <button className="rounded p-1 hover:bg-surface-container" title="Xuống" type="button" onClick={() => move(r.key, 1)}>
                      <MaterialIcon className="text-[18px]" name="arrow_downward" />
                    </button>
                    <button className="rounded p-1 text-red-700 hover:bg-red-50" title="Xóa dòng" type="button" onClick={() => remove(r.key)}>
                      <MaterialIcon className="text-[18px]" name="delete" />
                    </button>
                  </div>
                </div>
                {r.line_type === "subtotal" ? (
                  <input
                    className={inputClass}
                    placeholder="Cộng các mã, cách nhau bằng dấu phẩy – VD: 22, 23, 25"
                    value={r.sumText}
                    onChange={(e) => update(r.key, { sumText: e.target.value })}
                  />
                ) : null}
              </div>
            ))}
            <button className={buttonClass} type="button" onClick={() => add(side)}>
              <MaterialIcon className="text-[18px]" name="add" />
              Thêm dòng {side === "income" ? "thu" : "chi"}
            </button>
          </div>
        );
      })}

      {errors.length ? (
        <ul className="list-disc space-y-0.5 rounded-xl bg-red-50 py-2 pl-7 pr-3 text-sm text-red-800">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {orphaned.length ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">
          Nếu áp dụng bản này, {orphaned.length} danh mục sẽ không còn chỉ tiêu tương ứng (cần chọn lại trong tab Danh mục thu / chi):{" "}
          {orphaned.map((c) => c.name).join(", ")}.
        </p>
      ) : null}
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</p> : null}
      {message ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button className={buttonClass} disabled={busy} type="button" onClick={() => run("save")}>
          <MaterialIcon className="text-[18px]" name="save" />
          Lưu nháp
        </button>
        <button className={primaryClass} disabled={busy || errors.length > 0} type="button" onClick={() => run("publish")}>
          <MaterialIcon className="text-[18px]" name="published_with_changes" />
          Áp dụng phiên bản này
        </button>
        <button className={`${buttonClass} text-red-700`} disabled={busy} type="button" onClick={() => run("discard")}>
          <MaterialIcon className="text-[18px]" name="delete_sweep" />
          Hủy bản nháp
        </button>
      </div>
    </section>
  );
}

/** Mẫu báo cáo dùng chung (S82-TLĐ): xem phiên bản đang áp dụng, lịch sử; Quản trị viên soạn và áp dụng phiên bản mới. */
export function ReportTemplateManager({ template, canEdit, categories, today }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!template) {
    return <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Chưa có mẫu báo cáo trong hệ thống.</p>;
  }

  async function createDraft() {
    setBusy(true);
    setError(null);
    const res = await postTemplate({ action: "createDraft", templateId: template!.id });
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  const active = template.active;
  return (
    <div className="space-y-4">
      <section className="space-y-1 rounded-2xl border border-outline-variant bg-white p-4">
        <h2 className="text-base font-extrabold text-[#173A67]">{template.name}</h2>
        {template.description ? <p className="text-sm text-on-surface-variant">{template.description}</p> : null}
        <p className="text-xs text-on-surface-variant">
          Mẫu dùng chung cho mọi đơn vị trên hệ thống. Danh mục thu – chi gắn theo <b>mã chỉ tiêu</b> (VD 22, 25.01): khi công đoàn cấp
          trên sửa mẫu, chỉ cần soạn phiên bản mới và áp dụng – các danh mục giữ nguyên mã sẽ tự theo mẫu mới, báo cáo tổng hợp lập theo
          phiên bản đang áp dụng.
        </p>
      </section>

      {active ? (
        <section className="space-y-3 rounded-2xl border border-outline-variant bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-[#173A67]">
                Phiên bản {active.version} – {active.title}
              </h3>
              <p className="text-xs text-on-surface-variant">
                Đang áp dụng từ {formatDate(active.effective_from)}
                {active.note ? ` · ${active.note}` : ""}
              </p>
            </div>
            {canEdit && !template.draft ? (
              <button className={primaryClass} disabled={busy} type="button" onClick={createDraft}>
                <MaterialIcon className="text-[18px]" name="edit_note" />
                Tạo bản sửa đổi
              </button>
            ) : null}
          </div>
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</p> : null}
          <LinesTable categories={categories} lines={active.lines} />
        </section>
      ) : null}

      {template.draft ? (
        canEdit ? (
          <DraftEditor key={template.draft.id} categories={categories} draft={template.draft} today={today} />
        ) : (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Quản trị viên đang soạn phiên bản {template.draft.version} của mẫu này (chưa áp dụng).
          </p>
        )
      ) : null}

      <section className="space-y-2 rounded-2xl border border-outline-variant bg-white p-4">
        <h3 className="font-extrabold text-[#173A67]">Lịch sử phiên bản</h3>
        <ul className="divide-y divide-outline-variant/60 text-sm">
          {template.history.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>
                <b>Phiên bản {v.version}</b> – {v.title}
                {v.note ? <span className="block text-xs text-on-surface-variant">{v.note}</span> : null}
              </span>
              <span className="text-xs text-on-surface-variant">
                {VERSION_STATUS_LABEL[v.status]}
                {v.status !== "draft" ? ` · từ ${formatDate(v.effective_from)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}