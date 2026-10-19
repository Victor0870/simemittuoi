import type { ReactNode } from "react";
import { AccountShell } from "@/components/account/AccountShell";

export default function FeedbackLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
