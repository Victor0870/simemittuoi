"use client";

import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  GIFT_MAX_AGE_LIMIT,
  formatIsoDateVi,
  type GiftChildItem,
} from "@/lib/gifts/children-gifts";

type Props = {
  items: GiftChildItem[];
  refDate: string;
  maxAge: number;
};

const UNION_NAME = "CÔNG ĐOÀN CƠ SỞ CDILV";
const NO_DEPARTMENT = "(Chưa có bộ phận)";

const inputClass =
  "rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

const GENDER_LABEL = { male: "Nam", female: "Nữ" } as const;

function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function departmentsOf(item: GiftChildItem): string[] {
  return [...new Set(item.parents.map((p) => p.department?.trim() || NO_DEPARTMENT))];
}

function mergedNote(item: GiftChildItem): string {
  if (!item.merged) return "";
  return item.parents.length > 1 ? "Bố & mẹ cùng khai – tính 1 suất" : "Khai trùng – tính 1 suất";
}

export function ChildrenGiftList({ items, refDate, maxAge }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [dateInput, setDateInput] = useState(refDate);
  const [ageInput, setAgeInput] = useState(String(maxAge));
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [exporting, setExporting] = useState(false);

  const departments = useMemo(
    () => [...new Set(items.flatMap(departmentsOf))].sort((a, b) => a.localeCompare(b, "vi")),
    [items],
  );

  const filtered = useMemo(() => {
    const q = removeVietnameseTones(search.trim());
    return items.filter((item) => {
      if (dept !== "all" && !departmentsOf(item).includes(dept)) return false;
      if (q) {
        const hay = removeVietnameseTones(
          [item.fullName, ...item.parents.flatMap((p) => [p.fullName, p.employeeCode ?? "", p.department ?? ""])].join(
            " ",
          ),
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, dept]);

  const stats = useMemo(() => {
    const byDept = new Map<string, number>();
    const byAge = new Map<number, number>();
    let male = 0;
    let female = 0;
    let merged = 0;
    for (const item of filtered) {
      const d = item.parents[0]?.department?.trim() || NO_DEPARTMENT;
      byDept.set(d, (byDept.get(d) ?? 0) + 1);
      byAge.set(item.ageAtRef, (byAge.get(item.ageAtRef) ?? 0) + 1);
      if (item.gender === "male") male += 1;
      if (item.gender === "female") female += 1;
      if (item.merged) merged += 1;
    }
    return {
      total: filtered.length,
      male,
      female,
      merged,
      families: new Set(filtered.flatMap((i) => i.parents.map((p) => p.memberId))).size,
      byDept: [...byDept.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi")),
      byAge: [...byAge.entries()].sort((a, b) => a[0] - b[0]),
    };
  }, [filtered]);

  const mergedInList = items.filter((i) => i.merged).length;
  const dirty = dateInput !== refDate || ageInput !== String(maxAge);

  function applyFilter(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (dateInput) params.set("date", dateInput);
    if (ageInput) params.set("age", ageInput);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const title = `DANH SÁCH CON ĐOÀN VIÊN DƯỚI ${maxAge} TUỔI NHẬN QUÀ`;
  const subtitle = `Tính tuổi tròn tại ngày ${formatIsoDateVi(refDate)}${
    dept !== "all" ? ` – Bộ phận: ${dept}` : ""
  }`;

  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const header = [
        "STT",
        "Họ tên cháu",
        "Ngày sinh",
        "Tuổi",
        "Giới tính",
        "Họ tên bố/mẹ (đoàn viên)",
        "Mã NV",
        "Bộ phận",
        "Ghi chú",
        "Ký nhận",
      ];
      const rows = filtered.map((item, idx) => [
        idx + 1,
        item.fullName,
        formatIsoDateVi(item.dateOfBirth),
        item.ageAtRef,
        item.gender ? GENDER_LABEL[item.gender] : "",
        item.parents.map((p) => p.fullName).join(" / "),
        item.parents.map((p) => p.employeeCode ?? "").join(" / "),
        departmentsOf(item).join(" / "),
        mergedNote(item),
        "",
      ]);
      const sheet = XLSX.utils.aoa_to_sheet([
        [UNION_NAME],
        [title],
        [`${subtitle} – Tổng số: ${filtered.length} cháu`],
        [],
        header,
        ...rows,
      ]);
      const lastCol = header.length - 1;
      sheet["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: lastCol } }));
      sheet["!cols"] = [6, 28, 12, 6, 9, 30, 12, 22, 28, 16].map((wch) => ({ wch }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Qua thieu nhi");
      XLSX.writeFile(book, `danh_sach_qua_thieu_nhi_${refDate}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4 print:space-y-0">
      <style>{"@media print { @page { size: A4 portrait; margin: 12mm 10mm; } }"}</style>

      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 print:hidden"
        onSubmit={applyFilter}
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
          Mốc tính tuổi
          <input
            className={inputClass}
            required
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
          Dưới (tuổi)
          <input
            className={`${inputClass} w-24`}
            max={GIFT_MAX_AGE_LIMIT}
            min={1}
            required
            type="number"
            value={ageInput}
            onChange={(e) => setAgeInput(e.target.value)}
          />
        </label>
        <button
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white shadow-xs transition hover:bg-[#1E4A7D] disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          <MaterialIcon className="text-[18px]" name={pending ? "progress_activity" : "filter_alt"} />
          {pending ? "Đang lọc..." : "Lọc"}
        </button>
        {dirty && !pending ? (
          <span className="text-xs font-semibold text-amber-700">Bấm “Lọc” để áp dụng mốc mới</span>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-[#173A67] transition hover:border-[#173A67] disabled:opacity-50"
            disabled={filtered.length === 0}
            type="button"
            onClick={() => window.print()}
          >
            <MaterialIcon className="text-[18px]" name="print" />
            In danh sách
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-[#173A67] transition hover:border-[#173A67] disabled:opacity-50"
            disabled={filtered.length === 0 || exporting}
            type="button"
            onClick={exportExcel}
          >
            <MaterialIcon className="text-[18px]" name="download" />
            {exporting ? "Đang xuất..." : "Xuất Excel"}
          </button>
        </div>
      </form>

      {mergedInList > 0 ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
          <MaterialIcon className="text-[20px]" name="warning" />
          <p>
            Có <b>{mergedInList}</b> cháu được khai ở nhiều tài khoản (trùng họ tên và ngày sinh, thường là cả bố và mẹ
            cùng là đoàn viên). Hệ thống đã gộp lại, mỗi cháu chỉ tính 1 suất — các dòng này được đánh dấu bên dưới.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
        {[
          { label: "Tổng số cháu", value: stats.total, hint: `${stats.families} đoàn viên có con` },
          { label: "Bé trai", value: stats.male },
          { label: "Bé gái", value: stats.female },
          { label: "Gộp trùng", value: stats.merged, hint: "Đã tính 1 suất" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <p className="text-xs text-on-surface-variant">{s.label}</p>
            <p className="text-headline-sm font-bold text-[#173A67]">{s.value}</p>
            {s.hint ? <p className="text-[11px] text-on-surface-variant">{s.hint}</p> : null}
          </div>
        ))}
      </div>

      {stats.total > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 print:hidden">
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <p className="mb-2 text-xs font-bold text-on-surface-variant">Theo bộ phận</p>
            <div className="flex flex-wrap gap-1.5">
              {stats.byDept.map(([d, n]) => (
                <span key={d} className="rounded-full bg-[#D9F2EC] px-2.5 py-1 text-xs font-semibold text-[#173A67]">
                  {d}: {n}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <p className="mb-2 text-xs font-bold text-on-surface-variant">Theo độ tuổi (tại mốc)</p>
            <div className="flex flex-wrap gap-1.5">
              {stats.byAge.map(([age, n]) => (
                <span key={age} className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-[#173A67]">
                  {age} tuổi: {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative min-w-[220px] flex-1">
          <MaterialIcon
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-on-surface-variant/60"
            name="search"
          />
          <input
            className={`${inputClass} w-full pl-9`}
            placeholder="Tìm theo tên cháu, tên bố/mẹ, mã NV..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={inputClass} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">Mọi bộ phận</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <span className="text-xs font-semibold text-on-surface-variant">
          {filtered.length} / {items.length} cháu
        </span>
      </div>

      <div className="hidden text-center text-black print:mb-4 print:block">
        <p className="text-left text-[12px] font-bold">{UNION_NAME}</p>
        <p className="mt-3 text-[15px] font-bold">{title}</p>
        <p className="text-[12px] italic">{subtitle}</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest print:overflow-visible print:rounded-none print:border-0 print:bg-white">
        <table className="min-w-full text-left text-sm print:text-[11px] print:text-black">
          <thead className="bg-[#D9F2EC] text-[#173A67] print:bg-white print:text-black">
            <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:font-bold print:[&>th]:border print:[&>th]:border-black print:[&>th]:px-1.5 print:[&>th]:py-1">
              <th className="text-center">STT</th>
              <th>Họ tên cháu</th>
              <th className="whitespace-nowrap">Ngày sinh</th>
              <th className="text-center">Tuổi</th>
              <th className="whitespace-nowrap">Giới tính</th>
              <th>Bố/mẹ (đoàn viên)</th>
              <th className="whitespace-nowrap">Mã NV</th>
              <th>Bộ phận</th>
              <th className="hidden w-28 text-center print:table-cell">Ký nhận</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-on-surface-variant" colSpan={9}>
                  {items.length === 0
                    ? `Không có cháu nào dưới ${maxAge} tuổi tại ngày ${formatIsoDateVi(refDate)}.`
                    : "Không có cháu phù hợp bộ lọc."}
                </td>
              </tr>
            ) : null}
            {filtered.map((item, idx) => (
              <tr
                key={item.key}
                className={`border-t border-outline-variant break-inside-avoid [&>td]:px-3 [&>td]:py-2 print:[&>td]:border print:[&>td]:border-black print:[&>td]:px-1.5 print:[&>td]:py-1 ${
                  item.merged ? "bg-amber-50/60 print:bg-white" : ""
                }`}
              >
                <td className="text-center">{idx + 1}</td>
                <td className="font-semibold text-[#173A67] print:text-black">
                  {item.fullName}
                  {item.merged ? (
                    <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 print:hidden">
                      {item.parents.length > 1 ? "Bố & mẹ cùng khai" : "Khai trùng"}
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap">{formatIsoDateVi(item.dateOfBirth)}</td>
                <td className="text-center">{item.ageAtRef}</td>
                <td>{item.gender ? GENDER_LABEL[item.gender] : "—"}</td>
                <td>
                  {item.parents.map((p) => (
                    <div key={p.memberId}>{p.fullName}</div>
                  ))}
                </td>
                <td className="whitespace-nowrap">
                  {item.parents.map((p) => (
                    <div key={p.memberId}>{p.employeeCode ?? "—"}</div>
                  ))}
                </td>
                <td className="text-on-surface-variant print:text-black">{departmentsOf(item).join(" / ")}</td>
                <td className="hidden print:table-cell" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="hidden text-[12px] text-black print:mt-3 print:block">
        <p>
          Tổng cộng: <b>{filtered.length}</b> cháu.
        </p>
        <div className="mt-6 grid grid-cols-2 text-center break-inside-avoid">
          <div>
            <p className="font-bold">Người lập biểu</p>
            <p className="italic">(Ký, ghi rõ họ tên)</p>
          </div>
          <div>
            <p className="italic">Ngày ..... tháng ..... năm ........</p>
            <p className="font-bold">TM. BAN CHẤP HÀNH</p>
            <p className="italic">(Ký, ghi rõ họ tên)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
