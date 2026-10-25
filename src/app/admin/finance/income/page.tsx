import { FinanceSummaryView } from "@/components/finance/FinanceSummaryView";
import {
  prepareFinanceSummaryPage,
  type SummaryPageSearchParams,
} from "@/lib/finance/summary-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<SummaryPageSearchParams>;
};

export default async function AdminFinanceIncomePage({ searchParams }: PageProps) {
  const { canWrite, dataset, initialFilter, today } = await prepareFinanceSummaryPage(
    "income",
    searchParams,
  );

  return (
    <FinanceSummaryView
      canWrite={canWrite}
      categories={dataset.categories}
      entries={dataset.entries}
      entryNotes={dataset.entryNotes}
      funds={dataset.funds}
      initialFilter={initialFilter}
      initialOpeningBalances={dataset.openingBalances}
      kind="income"
      today={today}
    />
  );
}
