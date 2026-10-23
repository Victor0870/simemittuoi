import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCategories, loadEntries, loadFunds } from "@/lib/finance/server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { loadReportTemplate } from "@/lib/report-templates/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import type { VisitStatus } from "@/lib/visits/registry";
import {
  availableYears,
  buildFinanceReport,
  buildPaymentReport,
  buildVisitReport,
  type FinanceReport,
  type Granularity,
  type PaymentInfo,
  type PaymentReport,
  type VisitInfo,
  type VisitReport,
} from "./build";

export type ReportBundle = {
  year: number;
  granularity: Granularity;
  years: number[];
  finance: FinanceReport;
  visits: VisitReport;
  payments: PaymentReport;
  generatedOn: string;
  /** "Mẫu S82-TLĐ – phiên bản 1" (mẫu dùng cho bảng tổng hợp), null nếu chưa có mẫu. */
  templateName: string | null;
};

export function parseReportParams(params: { year?: string; period?: string }, currentYear: number) {
  const year = Number(params.year);
  return {
    year: Number.isInteger(year) && year >= 2000 && year <= currentYear ? year : currentYear,
    granularity: (params.period === "month" ? "month" : "quarter") as Granularity,
  };
}

export async function loadReportBundle(db: SupabaseClient, year: number, granularity: Granularity): Promise<ReportBundle> {
  const today = todayInVietnam();
  const [funds, categories, entries, template, visitsRes, paymentsRes] = await Promise.all([
    loadFunds(db),
    loadCategories(db),
    loadEntries(db),
    loadReportTemplate(db),
    db.from(CDILV_TABLE.visitRequests).select("event_type, amount, status, created_at").limit(10000),
    db.from(CDILV_TABLE.paymentRequests).select("request_date, status, total_amount").limit(10000),
  ]);
  if (visitsRes.error) throw new Error(`Không tải được đề nghị thăm hỏi: ${visitsRes.error.message}`);
  if (paymentsRes.error) throw new Error(`Không tải được đề nghị thanh toán: ${paymentsRes.error.message}`);

  const visits: VisitInfo[] = (visitsRes.data ?? []).map((v) => ({
    event_type: v.event_type as string | null,
    amount: Number(v.amount),
    status: v.status as VisitStatus,
    created_date: todayInVietnam(new Date(v.created_at as string)),
  }));
  const payments: PaymentInfo[] = (paymentsRes.data ?? []).map((p) => ({
    request_date: p.request_date as string,
    status: p.status as VisitStatus,
    total_amount: Number(p.total_amount),
  }));

  const currentYear = Number(today.slice(0, 4));
  return {
    year,
    granularity,
    years: availableYears(currentYear, [
      ...entries.map((e) => e.entry_date),
      ...visits.map((v) => v.created_date),
      ...payments.map((p) => p.request_date),
    ]),
    finance: buildFinanceReport(year, granularity, funds, categories, entries, today, template?.active?.lines ?? []),
    visits: buildVisitReport(year, granularity, visits),
    payments: buildPaymentReport(year, granularity, payments),
    generatedOn: today,
    templateName: template?.active ? `${template.active.title} – phiên bản ${template.active.version}` : null,
  };
}
