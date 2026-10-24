"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";

export function RegulationPrintButton() {
  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-xl border border-[#173A67] bg-white px-3 py-1.5 text-xs font-bold text-[#173A67] transition hover:bg-[#ecf4ff] print:hidden"
      type="button"
      onClick={() => window.print()}
    >
      <MaterialIcon className="text-[18px]" name="print" />
      In quy chế
    </button>
  );
}
