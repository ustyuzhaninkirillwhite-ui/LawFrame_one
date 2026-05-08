import { SettingsShell } from "@/features/settings";

export default function AppSettingsPage() {
  return (
    <div className="min-h-screen bg-[color:var(--lf-bg-app)] p-6">
      <SettingsShell mode="page" />
    </div>
  );
}
