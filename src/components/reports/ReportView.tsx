import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatDateVi } from "@/lib/members/profile-shared";
import {
  FUND_AMOUNT_KEYS,
  UNCLASSIFIED_KEY,
  periodLabels,
  splitFundTotals,
  sumFunds,
  type CategoryGroup,
  type SummaryRow,
} from "@/lib/reports/build";
import type { ReportBundle } from "@/lib/reports/server";
import { formatVnd } from "@/lib/visits/registry";

const num = (n: number) => (n ? new Intl.NumberFormat("vi-VN").format(n) : "–");

const thClass = "[&>th]:px-2.5 [&>th]:py-2 [&>th]:font-bold [&>th]:whitespace-nowrap";
const tdClass = "[&>td]:px-2.5 [&>td]:py-1.5";

function Section({ title, icon, children, note }: { title: string; icon: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-title-md font-bold text-[#173A67]">
        <MaterialIcon className="text-[22px]" name={icon} />
        {title}
      </h2>
      {note ? <p className="text-xs text-on-surface-variant">{note}</p> : null}
      {children}
    </section>
  );
}

function CategoryRows({ group, label, tone }: { group: CategoryGroup; label: string; tone: string }) {
  return (
    <>
      <tr className={`border-t border-outline-variant bg-surface-container-low font-bold ${tone} ${tdClass}`}>
        <td className="sticky left-0 bg-surface-container-low">{label}</td>
        {group.totals.map((v, i) => (
          <td key={i} className="text-right whitespace-nowrap">
            {num(v)}
          </td>
        ))}
        <td className="text-right whitespace-nowrap">{num(group.total)}</td>
        <td className="text-right whitespace-nowrap text-on-surface-variant">{num(group.previousYear)}</td>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.id} className={`border-t border-outline-variant ${tdClass}`}>
          <td className="sticky left-0 min-w-[220px] bg-surface-container-lowest">
            {r.code ? <span className="mr-1 text-on-surface-variant">{r.code}</span> : null}
            {r.name}
          </td>
          {r.values.map((v, i) => (
            <td key={i} className="text-right whitespace-nowrap">
              {num(v)}
            </td>
          ))}
          <td className="text-right font-semibold whitespace-nowrap">{num(r.total)}</td>
          <td className="text-right whitespace-nowrap text-on-surface-variant">{num(r.previousYear)}</td>
        </tr>
      ))}
    </>
  );
}

function SummaryRows({ rows, group, label, tone }: { rows: SummaryRow[]; group: CategoryGroup; label: string; tone: string }) {
  return (
    <>
      <tr className={`border-t border-outline-variant bg-surface-container-low font-bold ${tone} ${tdClass}`}>
        <td className="sticky left-0 bg-surface-container-low">{label}</td>
        {group.totals.map((v, i) => (
          <td key={i} className="text-right whitespace-nowrap">
            {num(v)}
          </td>
        ))}
        <td className="text-right whitespace-nowrap">{num(group.total)}</td>
        <td className="text-right whitespace-nowrap text-on-surface-variant">{num(group.previousYear)}</td>
      </tr>
      {rows.map((r) => (
        <tr
          key={r.key}
          className={`border-t border-outline-variant ${tdClass} ${r.lineType === "group" ? "font-semibold" : ""} ${
            r.lineType === "subtotal" ? "bg-[#173A67]/5 font-bold text-[#173A67]" : ""
          } ${r.key === UNCLASSIFIED_KEY ? "text-amber-800" : ""}`}
        >
          <td
            className="sticky left-0 min-w-[280px] bg-surface-container-lowest"
            style={{ paddingLeft: `${0.625 + r.level * 1.25}rem` }}
          >
            {r.level ? <i>{r.title}</i> : r.title}
          </td>
          {r.values.map((v, i) => (
            <td key={i} className="text-right whitespace-nowrap">
              {num(v)}
            </td>
          ))}
          <td className="text-right font-semibold whitespace-nowrap">{num(r.total)}</td>
          <td className="text-right whitespace-nowrap text-on-surface-variant">{num(r.previousYear)}</td>
        </tr>
      ))}
    </>
  );
}

export function ReportView({ report }: { report: ReportBundle }) {
  const { year, granularity: g, finance: f, visits: v, payments: p } = report;
  const labels = periodLabels(g);
  const href = (patch: { year?: number; period?: string }) =>
    `/admin/finance/reports?year=${patch.year ?? year}&period=${patch.period ?? g}`;
  const maxBar = Math.max(1, ...f.income.totals, ...f.expense.totals);
  const fundTotals = sumFunds(f.funds);
  const fundSplit = splitFundTotals(f.funds);
  const fundTotalRows = [
    ...(fundSplit
      ? [
          { label: "Tiền chi được (tiền mặt + tài khoản thanh toán)", values: fundSplit.spendable, strong: false },
          { label: "Tiền gửi tiết kiệm", values: fundSplit.savings, strong: false },
        ]
      : []),
    { label: "Tổng cộng", values: fundTotals, strong: true },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3">
        <span className="text-xs font-bold text-on-surface-variant">Năm:</span>
        {report.years.map((y) => (
          <Link
            prefetch={false}
            key={y}
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              y === year ? "bg-[#173A67] text-white" : "border border-outline-variant bg-white text-on-surface-variant hover:border-[#173A67]"
            }`}
            href={href({ year: y })}
          >
            {y}
          </Link>
        ))}
        <span className="ml-3 text-xs font-bold text-on-surface-variant">Xem theo:</span>
        {(["quarter", "month"] as const).map((k) => (
          <Link
            prefetch={false}
            key={k}
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              k === g ? "bg-[#173A67] text-white" : "border border-outline-variant bg-white text-on-surface-variant hover:border-[#173A67]"
            }`}
            href={href({ period: k })}
          >
            {k === "quarter" ? "Quý" : "Tháng"}
          </Link>
        ))}
        <a
          className="ml-auto inline-flex items-center gap-1 rounded-xl bg-[#173A67] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#1E4A7D]"
          href={`/api/reports/export?year=${year}&period=${g}`}
        >
          <MaterialIcon className="text-[18px]" name="download" />
          Tải báo cáo Excel
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: `Tổng thu ${year}`, value: f.income.total, tone: "text-emerald-700" },
          { label: `Tổng chi ${year}`, value: f.expense.total, tone: "text-rose-700" },
          { label: "Chênh lệch thu – chi", value: f.income.total - f.expense.total, tone: "text-[#173A67]" },
          {
            label: `Số dư các quỹ (${formatDateVi(f.closingDate)})`,
            value: fundTotals.closing,
            tone: "text-[#173A67]",
            hint: fundSplit
              ? `Chi được ${formatVnd(fundSplit.spendable.closing)} · Tiết kiệm ${formatVnd(fundSplit.savings.closing)}`
              : undefined,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-outline-variant bg-white p-3">
            <p className="text-xs font-semibold text-on-surface-variant">{s.label}</p>
            <p className={`text-lg font-extrabold ${s.tone}`}>{formatVnd(s.value)}</p>
            {"hint" in s && s.hint ? <p className="text-[11px] text-on-surface-variant">{s.hint}</p> : null}
          </div>
        ))}
      </div>

      <Section icon="bar_chart" title={`Thu – chi ${g === "quarter" ? "theo quý" : "theo tháng"}`}>
        <div className="space-y-1.5">
          {labels.map((label, i) => (
            <div key={label} className="grid grid-cols-[56px_1fr_110px] items-center gap-2 text-xs">
              <span className="font-bold text-on-surface-variant">{label}</span>
              <div className="space-y-0.5">
                <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${(f.income.totals[i] / maxBar) * 100}%` }} />
                <div className="h-2.5 rounded-full bg-rose-500" style={{ width: `${(f.expense.totals[i] / maxBar) * 100}%` }} />
              </div>
              <span className={`text-right font-semibold ${f.net[i] < 0 ? "text-rose-700" : "text-[#173A67]"}`}>
                {f.net[i] ? formatVnd(f.net[i]) : "–"}
              </span>
            </div>
          ))}
          <p className="flex gap-4 pt-1 text-[11px] text-on-surface-variant">
            <span>
              <span className="mr-1 inline-block h-2 w-3 rounded bg-emerald-500" />
              Thu
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-3 rounded bg-rose-500" />
              Chi
            </span>
            <span>Cột phải: chênh lệch thu – chi</span>
          </p>
        </div>
      </Section>

      <Section
        icon="summarize"
        note={
          report.templateName
            ? `Theo ${report.templateName}. Cộng số liệu các danh mục theo “Phân loại theo báo cáo tổng hợp” đã chọn trong Quản lý danh mục.`
            : "Chưa có mẫu báo cáo đang áp dụng – mọi số liệu nằm ở dòng “Chưa phân loại”."
        }
        title="Tổng hợp thu – chi theo phân loại báo cáo"
      >
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#D9F2EC] text-[#173A67]">
              <tr className={thClass}>
                <th className="sticky left-0 bg-[#D9F2EC]">Chỉ tiêu</th>
                {labels.map((l) => (
                  <th key={l} className="text-right">
                    {l}
                  </th>
                ))}
                <th className="text-right">Cả năm {year}</th>
                <th className="text-right">Năm {year - 1}</th>
              </tr>
            </thead>
            <tbody>
              <SummaryRows group={f.income} label="I. THU" rows={f.summary.income} tone="text-emerald-800" />
              <SummaryRows group={f.expense} label="II. CHI" rows={f.summary.expense} tone="text-rose-800" />
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        icon="table_chart"
        note="Theo ngày ghi sổ, chỉ tính bút toán chưa hủy. Chuyển tiền giữa các quỹ không tính vào thu / chi."
        title="Thu – chi theo danh mục"
      >
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#D9F2EC] text-[#173A67]">
              <tr className={thClass}>
                <th className="sticky left-0 bg-[#D9F2EC]">Danh mục</th>
                {labels.map((l) => (
                  <th key={l} className="text-right">
                    {l}
                  </th>
                ))}
                <th className="text-right">Cả năm {year}</th>
                <th className="text-right">Năm {year - 1}</th>
              </tr>
            </thead>
            <tbody>
              <CategoryRows group={f.income} label="I. THU" tone="text-emerald-800" />
              <CategoryRows group={f.expense} label="II. CHI" tone="text-rose-800" />
            </tbody>
            <tfoot>
              <tr className={`border-t-2 border-[#173A67]/30 font-bold text-[#173A67] ${tdClass}`}>
                <td className="sticky left-0 bg-surface-container-lowest">Chênh lệch thu – chi</td>
                {f.net.map((n, i) => (
                  <td key={i} className={`text-right whitespace-nowrap ${n < 0 ? "text-rose-700" : ""}`}>
                    {num(n)}
                  </td>
                ))}
                <td className="text-right whitespace-nowrap">{num(f.income.total - f.expense.total)}</td>
                <td className="text-right whitespace-nowrap">{num(f.income.previousYear - f.expense.previousYear)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      <Section
        icon="account_balance_wallet"
        note={`Từ 01/01/${year} đến ${formatDateVi(f.closingDate)}.`}
        title="Tình hình các quỹ"
      >
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#D9F2EC] text-[#173A67]">
              <tr className={thClass}>
                <th>Quỹ</th>
                <th className="text-right">Đầu năm</th>
                <th className="text-right">Thu</th>
                <th className="text-right">Chi</th>
                <th className="text-right">Chuyển đến</th>
                <th className="text-right">Chuyển đi</th>
                <th className="text-right">Cuối kỳ</th>
              </tr>
            </thead>
            <tbody>
              {f.funds.map((r) => (
                <tr key={r.id} className={`border-t border-outline-variant ${tdClass}`}>
                  <td className="font-semibold">
                    {r.name}
                    {r.kind === "savings" ? <span className="ml-1.5 text-[11px] font-normal text-on-surface-variant">(tiết kiệm)</span> : null}
                  </td>
                  <td className="text-right">{num(r.opening)}</td>
                  <td className="text-right text-emerald-700">{num(r.income)}</td>
                  <td className="text-right text-rose-700">{num(r.expense)}</td>
                  <td className="text-right">{num(r.transferIn)}</td>
                  <td className="text-right">{num(r.transferOut)}</td>
                  <td className="text-right font-bold text-[#173A67]">{num(r.closing)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {fundTotalRows.map((t) => (
                <tr
                  key={t.label}
                  className={`${t.strong ? "border-t-2 border-[#173A67]/30 font-bold" : "border-t border-outline-variant font-semibold"} text-[#173A67] ${tdClass}`}
                >
                  <td>{t.label}</td>
                  {FUND_AMOUNT_KEYS.map((k) => (
                    <td key={k} className="text-right">
                      {num(t.values[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      </Section>

      <Section
        icon="volunteer_activism"
        note="Phiếu đã duyệt hoặc đã chi, theo ngày lập phiếu. Ô ghi: số lượt · số tiền."
        title="Thăm hỏi đoàn viên"
      >
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#D9F2EC] text-[#173A67]">
              <tr className={thClass}>
                <th className="sticky left-0 bg-[#D9F2EC]">Loại sự việc</th>
                {labels.map((l) => (
                  <th key={l} className="text-right">
                    {l}
                  </th>
                ))}
                <th className="text-right">Cả năm</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-center text-on-surface-variant" colSpan={labels.length + 2}>
                    Chưa có phiếu thăm hỏi được duyệt trong năm {year}.
                  </td>
                </tr>
              ) : null}
              {v.rows.map((r) => (
                <tr key={r.key} className={`border-t border-outline-variant ${tdClass}`}>
                  <td className="sticky left-0 min-w-[180px] bg-surface-container-lowest">{r.label}</td>
                  {r.counts.map((c, i) => (
                    <td key={i} className="text-right whitespace-nowrap">
                      {c ? (
                        <>
                          <span className="text-on-surface-variant">{c} · </span>
                          {num(r.amounts[i])}
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                  ))}
                  <td className="text-right font-semibold whitespace-nowrap">
                    <span className="text-on-surface-variant">{r.count} · </span>
                    {num(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            {v.rows.length ? (
              <tfoot>
                <tr className={`border-t-2 border-[#173A67]/30 font-bold text-[#173A67] ${tdClass}`}>
                  <td className="sticky left-0 bg-surface-container-lowest">Tổng cộng</td>
                  {v.totalCounts.map((c, i) => (
                    <td key={i} className="text-right whitespace-nowrap">
                      {c ? `${c} · ${num(v.totalAmounts[i])}` : "–"}
                    </td>
                  ))}
                  <td className="text-right whitespace-nowrap">
                    {v.count} · {num(v.amount)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          {v.byStatus.map((s) => (
            <span key={s.status} className="rounded-full border border-outline-variant bg-white px-3 py-1 text-xs">
              <b>{s.label}</b>: {s.count} phiếu{s.count ? ` · ${formatVnd(s.amount)}` : ""}
            </span>
          ))}
        </div>
      </Section>

      <Section icon="request_quote" note="Theo ngày đề nghị." title="Đề nghị thanh toán">
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#D9F2EC] text-[#173A67]">
              <tr className={thClass}>
                <th>Chỉ tiêu</th>
                {labels.map((l) => (
                  <th key={l} className="text-right">
                    {l}
                  </th>
                ))}
                <th className="text-right">Cả năm</th>
              </tr>
            </thead>
            <tbody>
              <tr className={`border-t border-outline-variant ${tdClass}`}>
                <td className="whitespace-nowrap">Số đề nghị đã chi</td>
                {p.paidCounts.map((c, i) => (
                  <td key={i} className="text-right">
                    {c || "–"}
                  </td>
                ))}
                <td className="text-right font-semibold">{p.paidCounts.reduce((s, c) => s + c, 0)}</td>
              </tr>
              <tr className={`border-t border-outline-variant font-semibold ${tdClass}`}>
                <td className="whitespace-nowrap">Số tiền đã chi</td>
                {p.paidAmounts.map((a, i) => (
                  <td key={i} className="text-right whitespace-nowrap">
                    {num(a)}
                  </td>
                ))}
                <td className="text-right whitespace-nowrap text-[#173A67]">{num(p.paidAmounts.reduce((s, a) => s + a, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.byStatus.map((s) => (
            <span key={s.status} className="rounded-full border border-outline-variant bg-white px-3 py-1 text-xs">
              <b>{s.label}</b>: {s.count} đề nghị{s.count ? ` · ${formatVnd(s.amount)}` : ""}
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}
