import Link from "next/link";
import { RegulationContent } from "@/components/finance/RegulationContent";
import { RegulationPrintButton } from "@/components/finance/RegulationPrintButton";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatRegulationDate, regulationOutline, type SpendingRegulation } from "@/lib/finance/regulation";

type Props = {
  regulation: SpendingRegulation;
  updatedAt: string | null;
  unionName: string;
  canEdit: boolean;
};

/** Trang đọc Quy chế chi tiêu của đoàn viên: mục lục, nội dung, nút in (bản in A4 chỉ còn văn bản). */
export function RegulationDocument({ regulation, updatedAt, unionName, canEdit }: Props) {
  const outline = regulationOutline(regulation.content).filter((h) => h.level <= 2);
  const meta = [
    regulation.regulationNo ? `Số: ${regulation.regulationNo}` : null,
    regulation.effectiveDate ? `Hiệu lực từ ngày ${formatRegulationDate(regulation.effectiveDate)}` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10 print:max-w-none print:space-y-3 print:pb-0">
      <style>{"@media print { @page { size: A4 portrait; margin: 18mm 15mm; } }"}</style>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:text-dusty-dark"
          href="/"
        >
          <MaterialIcon className="text-[16px]" name="arrow_back" />
          Về trang chủ
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Link
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1E4A7D]"
              href="/admin/finance/regulations"
            >
              <MaterialIcon className="text-[18px]" name="edit" />
              Sửa quy chế
            </Link>
          ) : null}
          {regulation.content ? <RegulationPrintButton /> : null}
        </div>
      </div>

      <article className="rounded-2xl border border-dusty-border/70 bg-white p-5 shadow-xs sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-dusty-border/70 pb-4 text-center print:pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant print:text-black">
            {unionName || "Công đoàn cơ sở"}
          </p>
          <h1 className="mt-1 text-xl font-extrabold uppercase text-[#173A67] sm:text-2xl print:text-[16pt] print:text-black">
            {regulation.title}
          </h1>
          {meta.length > 0 ? (
            <p className="mt-1 text-sm text-on-surface-variant print:text-black">{meta.join(" · ")}</p>
          ) : null}
        </header>

        {regulation.content ? (
          <>
            {outline.length > 1 ? (
              <nav
                aria-label="Mục lục quy chế"
                className="mt-4 rounded-xl border border-dusty-border/60 bg-surface-container-low/60 p-3 text-sm print:hidden"
              >
                <p className="mb-1.5 flex items-center gap-1.5 font-bold text-[#173A67]">
                  <MaterialIcon className="text-[18px]" name="toc" />
                  Mục lục
                </p>
                <ul className="space-y-0.5">
                  {outline.map((h) => (
                    <li key={h.anchor} className={h.level === 1 ? "font-semibold" : "pl-4"}>
                      <a className="text-[#27496D] hover:text-primary hover:underline" href={`#${h.anchor}`}>
                        {h.text.replace(/\*\*/g, "")}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            <RegulationContent className="mt-5" content={regulation.content} />
          </>
        ) : (
          <div className="py-12 text-center print:hidden">
            <MaterialIcon className="mx-auto mb-2 text-[44px] text-on-surface-variant/40" name="gavel" />
            <p className="text-title-md font-bold text-[#173A67]">Chưa có nội dung</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Ban Chấp hành Công đoàn đang soạn Quy chế chi tiêu và sẽ cập nhật tại đây.
            </p>
          </div>
        )}

        {regulation.content && updatedAt ? (
          <p className="mt-6 border-t border-dusty-border/60 pt-3 text-right text-xs italic text-on-surface-variant print:hidden">
            Cập nhật lần cuối: {new Date(updatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
          </p>
        ) : null}
      </article>
    </div>
  );
}
