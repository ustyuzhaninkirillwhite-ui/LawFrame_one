"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useStage15Projects } from "@/hooks/domain/stage15";

export function AppEntryRedirect() {
  const router = useRouter();
  const projectsQuery = useStage15Projects();
  const firstProjectId = projectsQuery.data?.items[0]?.id ?? null;

  React.useEffect(() => {
    if (firstProjectId) {
      router.replace(`/app/projects/${firstProjectId}/chats`);
      return;
    }

    if (!projectsQuery.isLoading) {
      router.replace("/app/projects");
    }
  }, [firstProjectId, projectsQuery.isLoading, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--lf-text-muted)]">
      Открываю новый чат...
    </div>
  );
}
