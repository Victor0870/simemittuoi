import type { ReactNode } from "react";
import { AccountShell } from "@/components/account/AccountShell";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
