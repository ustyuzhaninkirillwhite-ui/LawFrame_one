"use client";

import { Mic, Plus, SendHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useStage15Projects } from "@/hooks/domain/stage15";
import { cn } from "@/lib/utils";
import { useSessionBridge } from "@/providers/session-provider";
import { useStage15ShellStore } from "@/stores/stage15-shell-store";

const fallbackProjectId = "project_claim_001";

export function FloatingAiComposer({ canvasMode }: { readonly canvasMode: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { apiClient, sessionContext } = useSessionBridge();
  const projectsQuery = useStage15Projects();
  const sidebarCollapsed = useStage15ShellStore((state) => state.sidebarCollapsed);
  const [text, setText] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const projectId =
    readProjectIdFromPath(pathname) ?? projectsQuery.data?.items[0]?.id ?? fallbackProjectId;
  const automationId = readAutomationIdFromPath(pathname);
  const canSend = sessionContext.permissions.includes("chat.create");
  const position = canvasMode ? "canvas-bottom" : "project-bottom";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = text.trim();

    if (!prompt || !canSend || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.createProjectChat(projectId, {
        title: prompt.slice(0, 80),
        source: "global_chat",
        currentAutomationId: automationId,
      });
      await apiClient.streamChatMessage(response.chat.id, { text: prompt });
      setText("");
      router.push(`/app/projects/${projectId}/chats/${response.chat.id}`);
    } catch {
      setError("Не удалось отправить запрос.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-0 z-[80] flex justify-center px-5 max-md:left-0",
        sidebarCollapsed ? "left-[88px]" : "left-[320px]",
        "bottom-6",
      )}
      data-testid="floating-ai-composer"
      data-position={position}
    >
      <form
        className="pointer-events-auto w-full max-w-[430px]"
        data-testid="floating-ai-composer-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="flex min-h-10 items-center gap-2 rounded-full border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] px-2 py-1 text-[color:var(--lf-text-primary)] shadow-[0_14px_40px_rgba(15,23,42,0.14)]">
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[color:var(--lf-text-muted)] transition hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]"
            aria-label="Добавить контекст"
          >
            <Plus size={16} />
          </button>
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--lf-text-primary)] outline-none"
            aria-label="Запрос к LexFrame AI"
            value={text}
            disabled={!canSend || isSubmitting}
            onChange={(event) => setText(event.target.value)}
          />
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[color:var(--lf-text-muted)] transition hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]"
            aria-label="Голосовой ввод"
          >
            <Mic size={15} />
          </button>
          <button
            type="submit"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--lf-primary)] text-[color:var(--lf-primary-fg)] transition hover:bg-[color:var(--lf-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!text.trim() || !canSend || isSubmitting}
            aria-label="Отправить запрос"
          >
            <SendHorizontal size={15} />
          </button>
        </div>
        {error ? (
          <div className="mx-auto mt-2 w-fit rounded-full bg-red-950/90 px-3 py-1 text-xs text-red-100">
            {error}
          </div>
        ) : null}
      </form>
    </div>
  );
}

function readProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/app\/projects\/([^/]+)/);
  return match?.[1] ?? null;
}

function readAutomationIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/app\/projects\/[^/]+\/automations\/([^/]+)/);
  return match?.[1] ?? null;
}
