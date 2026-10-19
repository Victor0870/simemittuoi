import type { ReactNode } from "react";
import { AccountShell } from "@/components/account/AccountShell";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
