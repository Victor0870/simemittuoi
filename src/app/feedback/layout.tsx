import type { ReactNode } from "react";
import { AccountShell } from "@/components/account/AccountShell";
import { BackToHubBar } from "@/components/admin/BackToHubBar";

export default function FeedbackLayout({ children }: { children: ReactNode }) {
  return (
    <AccountShell>
      <BackToHubBar />
      {children}
    </AccountShell>
  );
}
