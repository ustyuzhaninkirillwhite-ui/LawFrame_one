"use client";

import type { Stage15ProjectChatSummary } from "@lexframe/contracts";
import { panelRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
import {
  Clock3,
  FileText,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateStage15ProjectChat,
  useStage15ProjectSnapshot,
} from "@/hooks/domain/stage15";
import { formatStatus } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type WorkspaceContextItemType = "document" | "automation" | "topic";

interface ProjectWorkspaceContextItem {
  readonly id: string;
  readonly title: string;
  readonly type: WorkspaceContextItemType;
}

interface ProjectWorkspaceContext {
  readonly selectedDocumentIds: readonly string[];
  readonly selectedAutomationIds: readonly string[];
  readonly selectedQuickTopic: string | null;
}

const quickTopics = [
  "Проверить позицию по делу",
  "Подготовить претензию",
  "Найти судебную практику",
  "Собрать автоматизацию",
] as const;

export function ProjectHome({ projectId }: { readonly projectId: string }) {
  const router = useRouter();
  const snapshot = useStage15ProjectSnapshot(projectId);
  const createChat = useCreateStage15ProjectChat(projectId);
  const [context, setContext] = React.useState<ProjectWorkspaceContext>({
    selectedAutomationIds: [],
    selectedDocumentIds: [],
    selectedQuickTopic: null,
  });
  const [prompt, setPrompt] = React.useState("");
  const [localFiles, setLocalFiles] = React.useState<readonly string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const fallbackSnapshot = React.useMemo(
    () => ({
      snapshotVersion: 1501,
      generatedAt: "2026-04-23T09:00:00.000Z",
      project: {
        id: projectId,
        workspaceId: "ws_demo",
        name: "Досудебная претензия А40-101/2026",
        description: "Чат, источники и автоматизации проекта.",
        icon: "P",
        color: "#C7A46A",
        status: "active" as const,
        ownerUserId: null,
        role: "owner",
        counters: {
          chats: 2,
          automations: 1,
          documents: 2,
          activeRuns: 1,
          pendingApprovals: 1,
          recommendations: 2,
          missingConnections: 0,
        },
        lastActivityAt: "2026-04-23T09:00:00.000Z",
      },
      recentChats: [
        {
          id: "chat_project_claim_001",
          projectId,
          title: "Претензия к поставщику",
          status: "active" as const,
          lastMessagePreview: "Собрать позицию, документы и сценарий отправки.",
          selectedDocumentIds: ["doc_project_claim"],
          linkedAutomationId: "automation_claim_review",
          updatedAt: "2026-04-23T08:45:00.000Z",
        },
        {
          id: "chat_project_claim_002",
          projectId,
          title: "Проверка рисков",
          status: "active" as const,
          lastMessagePreview: "Отметить внешние действия и согласования.",
          selectedDocumentIds: [],
          linkedAutomationId: null,
          updatedAt: "2026-04-23T07:20:00.000Z",
        },
      ],
      projectAutomations: [
        {
          id: "automation_claim_review",
          title: "Претензия: анализ, генерация, согласование",
          canRun: true,
          nextGate: "ready_to_run",
        },
      ],
      projectDocuments: [
        {
          id: "doc_project_claim",
          title: "Договор поставки и переписка",
          status: "ready",
        },
        {
          id: "doc_project_evidence",
          title: "Акты, счета и подтверждение просрочки",
          status: "ready",
        },
      ],
      activeRuns: [
        {
          id: "run_project_claim",
          title: "Проверка комплекта документов",
          status: "waiting_approval",
          progressPercent: 68,
        },
      ],
      failedRuns: [],
      pendingApprovals: [],
      recentArtifacts: [],
      recommendations: [],
      unreadNotificationsCount: 0,
      systemStatus: null,
    }),
    [projectId],
  );
  const snapshotData = snapshot.data ?? fallbackSnapshot;

  const project = snapshotData.project;
  const documents = snapshotData.projectDocuments;
  const automations = snapshotData.projectAutomations;
  const recentChats = snapshotData.recentChats;
  const recentMaterials = [
    ...documents.slice(0, 3).map((document) => ({
      href: `/documents/${document.id}`,
      id: document.id,
      meta: formatStatus(document.status),
      title: document.title,
      type: "Документ",
    })),
    ...snapshotData.activeRuns.slice(0, 2).map((run) => ({
      href: `/app/runs/${run.id}`,
      id: run.id,
      meta: `${formatStatus(run.status)} / ${run.progressPercent}%`,
      title: run.title,
      type: "Запуск",
    })),
  ];
  const selectedContextItems: ProjectWorkspaceContextItem[] = [
    ...documents
      .filter((document) => context.selectedDocumentIds.includes(document.id))
      .map((document) => ({
        id: document.id,
        title: document.title,
        type: "document" as const,
      })),
    ...automations
      .filter((automation) => context.selectedAutomationIds.includes(automation.id))
      .map((automation) => ({
        id: automation.id,
        title: automation.title,
        type: "automation" as const,
      })),
    ...(context.selectedQuickTopic
      ? [
          {
            id: context.selectedQuickTopic,
            title: context.selectedQuickTopic,
            type: "topic" as const,
          },
        ]
      : []),
  ];

  async function createProjectChat() {
    const response = await createChat.mutateAsync({
      currentAutomationId: context.selectedAutomationIds[0] ?? null,
      selectedDocumentIds: context.selectedDocumentIds,
      source: "project_chat",
      title: context.selectedQuickTopic,
    });
    router.push(`/app/projects/${projectId}/chats/${response.chat.id}`);
  }

  async function submitPrompt() {
    if (!prompt.trim() && selectedContextItems.length === 0) {
      return;
    }

    await createProjectChat();
  }

  return (
    <section
      data-testid="project-workspace"
      className="grid min-h-[calc(100vh-96px)] gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]"
    >
      <aside className="grid content-start gap-4">
        <div className={cn(panelRecipe.muted, "p-4")}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 font-[family-name:var(--font-display)] text-xl text-[color:var(--accent-strong)]">
              {project.icon}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-[family-name:var(--font-display)] text-2xl leading-none">
                {project.name}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={project.status === "active" ? "success" : "muted"}>
                  {formatStatus(project.status)}
                </Badge>
                {project.counters.missingConnections > 0 ? (
                  <Badge variant="danger">connections</Badge>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <ContextSection
          action={
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-white/6 hover:text-[color:var(--foreground)]"
              onClick={() => {
                const firstDocument = documents[0];
                if (firstDocument) {
                  toggleDocument(firstDocument.id);
                }
              }}
              aria-label="Добавить источник"
            >
              <Plus className="h-4 w-4" />
            </button>
          }
          icon={<FileText className="h-4 w-4" />}
          title="Источники"
        >
          {documents.length === 0 ? (
            <EmptyLine text="Нет источников." />
          ) : (
            documents.slice(0, 5).map((document) => (
              <ContextToggle
                key={document.id}
                active={context.selectedDocumentIds.includes(document.id)}
                meta={formatStatus(document.status)}
                title={document.title}
                onClick={() => toggleDocument(document.id)}
              />
            ))
          )}
          <Button
            type="button"
            variant="ghost"
            className="mt-1 w-full justify-start"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Добавить источник
          </Button>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                setLocalFiles((current) => [...current, `${file.name} · pending`]);
              }
              event.target.value = "";
            }}
          />
          {localFiles.map((file) => (
            <div
              key={file}
              className="rounded-[16px] border border-dashed border-[color:var(--line)] px-3 py-2 text-xs text-[color:var(--muted)]"
            >
              {file}
            </div>
          ))}
        </ContextSection>

        <ContextSection icon={<Workflow className="h-4 w-4" />} title="Автоматизации">
          {automations.length === 0 ? (
            <EmptyLine text="Нет автоматизаций." />
          ) : (
            automations.slice(0, 5).map((automation) => (
              <ContextToggle
                key={automation.id}
                active={context.selectedAutomationIds.includes(automation.id)}
                meta={automation.canRun ? "готова" : formatStatus(automation.nextGate)}
                title={automation.title}
                onClick={() => toggleAutomation(automation.id)}
              />
            ))
          )}
          <Button asChild variant="ghost" className="mt-1 w-full justify-start">
            <Link href={`/app/projects/${projectId}/automations`}>
              <Plus className="h-4 w-4" />
              Прикрепить автоматизацию
            </Link>
          </Button>
        </ContextSection>
      </aside>

      <main className="flex min-h-[680px] flex-col rounded-[var(--lf-radius-panel)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-card)]">
        <div className="border-b border-[color:var(--lf-border)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {quickTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className={cn(
                    "rounded-[var(--lf-radius-control)] border px-3 py-1.5 text-sm transition-colors",
                    context.selectedQuickTopic === topic
                      ? "border-[color:var(--lf-primary)]/40 bg-[color:var(--lf-state-active)] text-[color:var(--lf-text-primary)]"
                      : "border-[color:var(--lf-border)] text-[color:var(--lf-text-muted)] hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]",
                  )}
                  onClick={() =>
                    setContext((current) => ({
                      ...current,
                      selectedQuickTopic: current.selectedQuickTopic === topic ? null : topic,
                    }))
                  }
                >
                  {topic}
                </button>
              ))}
            </div>
            <Button
              type="button"
              disabled={createChat.isPending}
              onClick={() => void createProjectChat()}
            >
              <MessageSquare className="h-4 w-4" />
              Новый чат
            </Button>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-end gap-5 p-5">
          <div className="mx-auto grid w-full max-w-3xl gap-4">
            <div className={cn(panelRecipe.muted, "p-4")}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-[color:var(--accent-strong)]" />
                Pravacontour
              </div>
              <div className="mt-3 text-sm leading-6 text-[color:var(--muted-strong)]">
                {project.description}
              </div>
            </div>

            {selectedContextItems.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedContextItems.map((item) => (
                  <button
                    key={`${item.type}_${item.id}`}
                    type="button"
                    className="flex max-w-[260px] items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/4 px-3 py-1.5 text-xs text-[color:var(--muted-strong)]"
                    onClick={() => removeContextItem(item)}
                  >
                    <span className="truncate">{item.title}</span>
                    <X className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="rounded-[var(--lf-radius-panel)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-2">
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border)] text-[color:var(--lf-text-muted)] hover:border-[color:var(--lf-primary)] hover:text-[color:var(--lf-primary-hover)]"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Прикрепить файл"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                <Textarea
                  data-testid="project-chat-input"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Спросите по проекту или попросите собрать автоматизацию"
                  rows={2}
                  className="min-h-[52px] resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0"
                />
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--lf-radius-control)] bg-[color:var(--lf-primary)] text-[color:var(--lf-primary-fg)] hover:bg-[color:var(--lf-primary-hover)]"
                  onClick={() => void submitPrompt()}
                  aria-label="Отправить"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <aside className="grid content-start gap-4">
        <ContextSection icon={<MessageSquare className="h-4 w-4" />} title="Чаты">
          {recentChats.length === 0 ? (
            <EmptyLine text="Нет чатов." />
          ) : (
            recentChats.slice(0, 5).map((chat) => (
              <ChatLink key={chat.id} chat={chat} projectId={projectId} />
            ))
          )}
        </ContextSection>

        <ContextSection icon={<Clock3 className="h-4 w-4" />} title="Последние материалы">
          {recentMaterials.length === 0 ? (
            <EmptyLine text="Нет материалов." />
          ) : (
            recentMaterials.map((item) => (
              <Link
                key={`${item.type}_${item.id}`}
                href={item.href}
                className="rounded-[16px] border border-[color:var(--line)] bg-black/16 px-3 py-3 transition hover:border-[color:var(--accent)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate text-sm font-medium">{item.title}</div>
                  <Badge variant="muted">{item.type}</Badge>
                </div>
                <div className="mt-2 text-xs text-[color:var(--muted)]">{item.meta}</div>
              </Link>
            ))
          )}
        </ContextSection>

        <div className={cn(panelRecipe.muted, "p-4")}>
          <div className="grid grid-cols-3 gap-3 text-center">
            <MiniMetric label="Чаты" value={project.counters.chats} />
            <MiniMetric label="Источники" value={project.counters.documents} />
            <MiniMetric label="Авто" value={project.counters.automations} />
          </div>
        </div>
      </aside>
    </section>
  );

  function toggleDocument(documentId: string) {
    setContext((current) => ({
      ...current,
      selectedDocumentIds: current.selectedDocumentIds.includes(documentId)
        ? current.selectedDocumentIds.filter((id) => id !== documentId)
        : [...current.selectedDocumentIds, documentId],
    }));
  }

  function toggleAutomation(automationId: string) {
    setContext((current) => ({
      ...current,
      selectedAutomationIds: current.selectedAutomationIds.includes(automationId)
        ? current.selectedAutomationIds.filter((id) => id !== automationId)
        : [...current.selectedAutomationIds, automationId],
    }));
  }

  function removeContextItem(item: ProjectWorkspaceContextItem) {
    if (item.type === "document") {
      toggleDocument(item.id);
      return;
    }

    if (item.type === "automation") {
      toggleAutomation(item.id);
      return;
    }

    setContext((current) => ({
      ...current,
      selectedQuickTopic: null,
    }));
  }
}

function ContextSection({
  action,
  children,
  icon,
  title,
}: {
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly icon: React.ReactNode;
  readonly title: string;
}) {
  return (
    <section className={cn(panelRecipe.muted, "grid gap-3 p-4")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-[color:var(--accent-strong)]">{icon}</span>
          {title}
        </div>
        {action}
      </div>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function ContextToggle({
  active,
  meta,
  onClick,
  title,
}: {
  readonly active: boolean;
  readonly meta: string;
  readonly onClick: () => void;
  readonly title: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-[var(--lf-radius-card)] border px-3 py-3 text-left transition-colors",
        active
          ? "border-[color:var(--lf-primary)]/40 bg-[color:var(--lf-state-active)]"
          : "border-[color:var(--lf-border)] bg-[color:var(--lf-bg-card)] hover:border-[color:var(--lf-primary)]",
      )}
      onClick={onClick}
    >
      <div className="truncate text-sm font-medium">{title}</div>
      <div className="mt-2 text-xs text-[color:var(--muted)]">{meta}</div>
    </button>
  );
}

function ChatLink({
  chat,
  projectId,
}: {
  readonly chat: Stage15ProjectChatSummary;
  readonly projectId: string;
}) {
  return (
    <Link
      href={`/app/projects/${projectId}/chats/${chat.id}`}
      className="rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-card)] px-3 py-3 transition-colors hover:border-[color:var(--lf-primary)]"
    >
      <div className="flex items-center gap-2">
        <Badge variant={chat.status === "active" ? "success" : "muted"}>
          {formatStatus(chat.status)}
        </Badge>
        {chat.linkedAutomationId ? <Badge variant="accent">workflow</Badge> : null}
      </div>
      <div className="mt-3 truncate text-sm font-medium">{chat.title}</div>
      <div className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--muted)]">
        {chat.lastMessagePreview}
      </div>
    </Link>
  );
}

function MiniMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div>
      <div className="font-[family-name:var(--font-display)] text-2xl">{value}</div>
      <div className="mt-1 text-[11px] text-[color:var(--muted)]">{label}</div>
    </div>
  );
}

function EmptyLine({ text }: { readonly text: string }) {
  return (
    <div className={cn(panelRecipe.empty, "px-3 py-3 text-sm text-[color:var(--lf-text-muted)]")}>
      {text}
    </div>
  );
}
