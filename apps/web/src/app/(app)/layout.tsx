import type * as React from "react";
import { RequireAppSession } from "@/components/require-app-session";

export default function StageAppLayout({ children }: { children: React.ReactNode }) {
  return <RequireAppSession>{children}</RequireAppSession>;
}
