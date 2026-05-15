"use client";

import type {
  InstalledAutomationDetail,
  ProjectKnowledgeItem,
  ProjectWebSearchResult,
  Stage15ProjectChatSummary,
} from "@lexframe/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Check,
  FileText,
  FolderOpen,
  Globe2,
  ImageIcon,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Search,
  SendHorizontal,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  useCreateStage15ProjectChat,
  useStage15ProjectAutomations,
  useStage15ProjectChats,
  useStage15ProjectSnapshot,
} from "@/hooks/domain/stage15";
import { cn } from "@/lib/utils";
import { useSessionBridge } from "@/providers/session-provider";

type ProjectWorkspaceTab = "chats" | "sources" | "automations";
type PlusMenuMode = "closed" | "menu" | "automations" | "webSearch";

interface LocalComposerFile {
  readonly id: string;
  readonly file: File;
  readonly kind: "image" | "file";
  readonly error?: string | null;
}

const emptyKnowledgeResponse = { items: [] } as const;

export function ProjectHome({ projectId }: { readonly projectId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { apiClient } = useSessionBridge();
  const snapshot = useStage15ProjectSnapshot(projectId);
  const projectChats = useStage15ProjectChats(projectId);
  const automations = useStage15ProjectAutomations(projectId);
  const createChat = useCreateStage15ProjectChat(projectId);
  const [activeTab, setActiveTab] = React.useState<ProjectWorkspaceTab>("chats");
  const [menuMode, setMenuMode] = React.useState<PlusMenuMode>("closed");
  const [prompt, setPrompt] = React.useState("");
  const [files, setFiles] = React.useState<readonly LocalComposerFile[]>([]);
  const [selectedAutomation, setSelectedAutomation] =
    React.useState<InstalledAutomationDetail | null>(null);
  const [webQuery, setWebQuery] = React.useState("");
  const [webResults, setWebResults] = React.useState<readonly ProjectWebSearchResult[]>([]);
  const [webSearchError, setWebSearchError] = React.useState<string | null>(null);
  const [webSearching, setWebSearching] = React.useState(false);
  const [composerError, setComposerError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [renamingProject, setRenamingProject] = React.useState(false);
  const [projectNameDraft, setProjectNameDraft] = React.useState("");
  const [projectRenameError, setProjectRenameError] = React.useState<string | null>(
    null,
  );
  const [projectRenameSaving, setProjectRenameSaving] = React.useState(false);
  const imageInputRef = React.useRef<HTMLInputElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const plusButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const submittingRef = React.useRef(false);
  const currentProjectIdRef = React.useRef(projectId);
  const previousProjectIdRef = React.useRef(projectId);
  const webSearchRequestIdRef = React.useRef(0);
  const projectRenameSavingRef = React.useRef(false);
  const projectRenameRequestIdRef = React.useRef(0);

  const project = snapshot.data?.project ?? {
    id: projectId,
    workspaceId: "",
    name: "LexFrame",
    description: "",
    icon: "L",
    color: "#3B82F6",
    status: "active" as const,
    ownerUserId: null,
    role: "owner" as const,
    counters: {
      chats: 0,
      automations: 0,
      documents: 0,
      activeRuns: 0,
      pendingApprovals: 0,
      recommendations: 0,
      missingConnections: 0,
    },
    lastActivityAt: new Date(0).toISOString(),
  };

  const knowledge = useQuery({
    queryKey: ["projectKnowledge", projectId],
    queryFn: () => apiClient.listProjectKnowledge(projectId),
    enabled: Boolean(projectId),
    initialData: emptyKnowledgeResponse,
    retry: false,
  });

  const chats = React.useMemo(
    () => [...(projectChats.data ?? [])].sort(sortChatsNewestFirst),
    [projectChats.data],
  );
  const sources = knowledge.data.items;
  const currentAutomations = automations.data ?? [];
  const validFiles = React.useMemo(
    () => files.filter((item) => !item.error),
    [files],
  );
  const canSend =
    Boolean(prompt.trim()) || validFiles.length > 0 || Boolean(selectedAutomation);

  const selectTab = React.useCallback(
    (tab: ProjectWorkspaceTab) => {
      const nextParams = new URLSearchParams(window.location.search);
      if (tab === "chats") {
        nextParams.delete("tab");
      } else {
        nextParams.set("tab", tab);
      }

      const query = nextParams.toString();
      const nextUrl = `/app/projects/${projectId}${query ? `?${query}` : ""}`;
      router.push(nextUrl, { scroll: false });
      setActiveTab(tab);
    },
    [projectId, router],
  );

  React.useLayoutEffect(() => {
    currentProjectIdRef.current = projectId;
  }, [projectId]);

  React.useEffect(() => {
    if (previousProjectIdRef.current === projectId) {
      return;
    }

    previousProjectIdRef.current = projectId;
    webSearchRequestIdRef.current += 1;
    projectRenameRequestIdRef.current += 1;
    submittingRef.current = false;
    projectRenameSavingRef.current = false;
    setMenuMode("closed");
    setPrompt("");
    setFiles([]);
    setSelectedAutomation(null);
    setWebQuery("");
    setWebResults([]);
    setWebSearchError(null);
    setWebSearching(false);
    setComposerError(null);
    setSubmitting(false);
    setRenamingProject(false);
    setProjectNameDraft("");
    setProjectRenameError(null);
    setProjectRenameSaving(false);
  }, [projectId]);

  React.useEffect(() => {
    const syncTabFromUrl = () => {
      setActiveTab(
        readProjectWorkspaceTab(new URLSearchParams(window.location.search).get("tab")) ??
          "chats",
      );
    };

    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);

    return () => {
      window.removeEventListener("popstate", syncTabFromUrl);
    };
  }, [projectId]);

  React.useEffect(() => {
    if (menuMode === "closed") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuMode("closed");
        window.requestAnimationFrame(() => plusButtonRef.current?.focus());
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuMode]);

  const handleFiles = React.useCallback(
    (incomingFiles: FileList | readonly File[], kind: LocalComposerFile["kind"]) => {
      const existingKeys = new Set(files.map((item) => fileKey(item.file)));
      const nextFiles: LocalComposerFile[] = [];

      Array.from(incomingFiles).forEach((file) => {
        const key = fileKey(file);
        if (existingKeys.has(key)) {
          nextFiles.push({
            id: crypto.randomUUID(),
            file,
            kind,
            error: "Файл уже прикреплён.",
          });
          return;
        }
        existingKeys.add(key);
        nextFiles.push({
          id: crypto.randomUUID(),
          file,
          kind,
          error: validateComposerFile(file, kind),
        });
      });

      setFiles((current) => [...current, ...nextFiles]);
      setComposerError(null);
      setMenuMode("closed");
    },
    [files],
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.dataTransfer.files.length > 0) {
        handleFiles(event.dataTransfer.files, "file");
      }
    },
    [handleFiles],
  );

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardFiles = Array.from(event.clipboardData.files);
      if (clipboardFiles.length > 0) {
        handleFiles(clipboardFiles, "file");
      }
    },
    [handleFiles],
  );

  async function handleSubmit() {
    if (!canSend || submittingRef.current) {
      return;
    }

    const messageText =
      prompt.trim() || selectedAutomation?.title || "Новый чат проекта";
    submittingRef.current = true;
    setSubmitting(true);
    setComposerError(null);

    try {
      const response = await createChat.mutateAsync({
        currentAutomationId: selectedAutomation?.id ?? null,
        selectedDocumentIds: [],
        source: "project_chat",
        title: messageText,
      });
      const chatId = response.chat.id;
      const attachmentIds = await uploadComposerFiles(chatId, validFiles);
      await apiClient.streamChatMessage(chatId, {
        text: messageText,
        attachmentIds,
        attachments: selectedAutomation
          ? [
              {
                mode: "reference_only",
                sourceId: selectedAutomation.id,
                sourceType: "automation_snapshot",
              },
            ]
          : [],
      });
      router.push(`/app/projects/${projectId}/chats/${chatId}`);
    } catch {
      setComposerError("Сообщение не отправлено. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function uploadComposerFiles(
    threadId: string,
    localFiles: readonly LocalComposerFile[],
  ): Promise<readonly string[]> {
    if (localFiles.length === 0) {
      return [];
    }

    const response = await apiClient.createChatAttachmentUploadIntents({
      threadId,
      files: localFiles.map((item) => ({
        clientAttachmentId: item.id,
        filename: item.file.name,
        mimeType: item.file.type || "application/octet-stream",
        sizeBytes: item.file.size,
      })),
    });
    const uploadedIds: string[] = [];

    await Promise.all(
      response.items.map(async (intent) => {
        const localFile = localFiles.find(
          (item) => item.id === intent.clientAttachmentId,
        );
        if (!localFile) {
          return;
        }

        await fetch(intent.uploadUrl, {
          method: intent.method,
          headers: intent.headers,
          body: localFile.file,
        });
        await apiClient.completeChatAttachmentUpload(intent.id, { threadId });
        uploadedIds.push(intent.id);
      }),
    );

    return uploadedIds;
  }

  async function handleWebSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = webQuery.trim();
    if (!query || webSearching) {
      return;
    }

    setWebSearching(true);
    setWebSearchError(null);
    const requestProjectId = projectId;
    const requestId = webSearchRequestIdRef.current + 1;
    webSearchRequestIdRef.current = requestId;
    try {
      const response = await apiClient.searchProjectWeb(projectId, {
        query,
        saveResults: true,
      });
      if (!isCurrentWebSearch(requestProjectId, requestId)) {
        return;
      }
      setWebResults(response.items);
      await queryClient.invalidateQueries({ queryKey: ["projectKnowledge", projectId] });
      if (!isCurrentWebSearch(requestProjectId, requestId)) {
        return;
      }
      if (response.status === "ok") {
        setMenuMode("closed");
      } else {
        setWebSearchError(response.error?.message ?? "Поиск временно недоступен.");
      }
    } catch {
      if (isCurrentWebSearch(requestProjectId, requestId)) {
        setWebSearchError("Поиск временно недоступен.");
      }
    } finally {
      if (isCurrentWebSearch(requestProjectId, requestId)) {
        setWebSearching(false);
      }
    }
  }

  async function saveProjectName() {
    const name = projectNameDraft.trim();
    if (!name || projectRenameSavingRef.current) {
      return;
    }

    const requestProjectId = projectId;
    const requestId = projectRenameRequestIdRef.current + 1;
    projectRenameRequestIdRef.current = requestId;
    projectRenameSavingRef.current = true;
    setProjectRenameSaving(true);
    setProjectRenameError(null);
    try {
      await apiClient.updateProject(requestProjectId, { name });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stage15-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["stage15-project-snapshot"] }),
        queryClient.invalidateQueries({ queryKey: ["stage15-project"] }),
      ]);
      if (isCurrentProjectRequest(requestProjectId, requestId)) {
        setRenamingProject(false);
      }
    } catch {
      if (isCurrentProjectRequest(requestProjectId, requestId)) {
        setProjectRenameError("Project name was not saved. Try again.");
      }
    } finally {
      if (projectRenameRequestIdRef.current === requestId) {
        projectRenameSavingRef.current = false;
      }
      if (isCurrentProjectRequest(requestProjectId, requestId)) {
        setProjectRenameSaving(false);
      }
    }
  }

  function isCurrentWebSearch(requestProjectId: string, requestId: number) {
    return (
      currentProjectIdRef.current === requestProjectId &&
      webSearchRequestIdRef.current === requestId
    );
  }

  function isCurrentProjectRequest(requestProjectId: string, requestId: number) {
    return (
      currentProjectIdRef.current === requestProjectId &&
      projectRenameRequestIdRef.current === requestId
    );
  }

  async function handleProjectRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveProjectName();
  }

  return (
    <section
      data-testid="project-workspace-shell"
      className="mx-auto flex min-h-[calc(100vh-112px)] w-full max-w-[960px] flex-col px-3 py-10 sm:px-6"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <header className="mb-10 flex items-center gap-3">
        <FolderOpen className="h-7 w-7 text-[color:var(--lf-text-secondary)]" />
        {renamingProject ? (
          <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={handleProjectRename}>
            <input
              aria-label="Название проекта"
              className="min-w-0 flex-1 rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] px-3 py-2 text-2xl font-semibold outline-none focus:border-[color:var(--lf-primary)]"
              autoFocus
              value={projectNameDraft}
              onChange={(event) => setProjectNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setProjectNameDraft(project.name);
                  setProjectRenameError(null);
                  setRenamingProject(false);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  void saveProjectName();
                }
              }}
            />
            <button
              type="submit"
              aria-label="Сохранить название проекта"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[color:var(--lf-primary)] hover:bg-[color:var(--lf-state-hover)]"
              disabled={projectRenameSaving || !projectNameDraft.trim()}
            >
              <Check className="h-5 w-5" />
            </button>
            {projectRenameError ? (
              <span className="text-sm text-[color:var(--danger)]">
                {projectRenameError}
              </span>
            ) : null}
          </form>
        ) : (
          <>
            <h1 className="truncate text-3xl font-semibold tracking-normal text-[color:var(--lf-text-primary)]">
              {project.name}
            </h1>
            <button
              type="button"
              aria-label={`Переименовать проект ${project.name}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--lf-text-muted)] transition hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]"
              onClick={() => {
                setProjectNameDraft(project.name);
                setProjectRenameError(null);
                setRenamingProject(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </button>
          </>
        )}
      </header>

      <div className="relative">
        <div className="rounded-[32px] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              ref={plusButtonRef}
              type="button"
              data-testid="project-plus-button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--lf-bg-card)] text-[color:var(--lf-text-primary)] transition hover:bg-[color:var(--lf-state-hover)]"
              aria-label="Добавить контекст"
              onClick={() => setMenuMode((mode) => (mode === "menu" ? "closed" : "menu"))}
            >
              <Plus className="h-5 w-5" />
            </button>
            <textarea
              data-testid="project-composer-input"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onPaste={handlePaste}
              placeholder={`Новый чат в ${project.name}`}
              rows={1}
              className="min-h-10 flex-1 resize-none bg-transparent py-2 text-base text-[color:var(--lf-text-primary)] outline-none placeholder:text-[color:var(--lf-text-muted)]"
            />
            <button
              type="button"
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-[color:var(--lf-text-muted)] transition hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)] sm:flex"
              aria-label="Голосовой ввод"
            >
              <Mic className="h-5 w-5" />
            </button>
            <button
              type="button"
              data-testid="project-composer-send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--lf-primary)] text-[color:var(--lf-primary-fg)] transition hover:bg-[color:var(--lf-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Отправить сообщение"
              disabled={!canSend || submitting}
              onClick={() => void handleSubmit()}
            >
              <SendHorizontal className="h-5 w-5" />
            </button>
          </div>

          {selectedAutomation || files.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 pl-1">
              {selectedAutomation ? (
                <AutomationChip
                  automation={selectedAutomation}
                  projectId={projectId}
                  onRemove={() => setSelectedAutomation(null)}
                />
              ) : null}
              {files.map((item) => (
                <FileChip
                  key={item.id}
                  item={item}
                  onRemove={() =>
                    setFiles((current) => current.filter((file) => file.id !== item.id))
                  }
                />
              ))}
            </div>
          ) : null}
          {composerError ? (
            <div className="mt-3 pl-1">
              <MutedLine text={composerError} />
            </div>
          ) : null}
        </div>

        {menuMode === "menu" ? (
          <PlusMenu
            onImages={() => imageInputRef.current?.click()}
            onFiles={() => fileInputRef.current?.click()}
            onAutomations={() => setMenuMode("automations")}
            onWebSearch={() => {
              selectTab("sources");
              setMenuMode("webSearch");
            }}
          />
        ) : null}

        {menuMode === "automations" ? (
          <AutomationPicker
            automations={currentAutomations}
            error={automations.isError}
            loading={automations.isLoading}
            onSelect={(automation) => {
              setSelectedAutomation(automation);
              setMenuMode("closed");
            }}
          />
        ) : null}

        {menuMode === "webSearch" ? (
          <WebSearchPanel
            error={webSearchError}
            query={webQuery}
            results={webResults}
            searching={webSearching}
            onClose={() => setMenuMode("closed")}
            onQueryChange={setWebQuery}
            onSubmit={handleWebSearch}
          />
        ) : null}
      </div>

      <input
        ref={imageInputRef}
        data-testid="project-image-input"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) {
            handleFiles(event.target.files, "image");
          }
          event.target.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        data-testid="project-file-input"
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) {
            handleFiles(event.target.files, "file");
          }
          event.target.value = "";
        }}
      />

      <div className="mt-9 flex items-center gap-2">
        <TabButton
          active={activeTab === "chats"}
          testId="project-tab-chats"
          onClick={() => selectTab("chats")}
        >
          Чаты
        </TabButton>
        <TabButton
          active={activeTab === "sources"}
          testId="project-tab-sources"
          onClick={() => selectTab("sources")}
        >
          Источники
        </TabButton>
        <TabButton
          active={activeTab === "automations"}
          testId="project-tab-automations"
          onClick={() => selectTab("automations")}
        >
          Автоматизации
        </TabButton>
      </div>

      <div className="mt-6 min-h-[360px]">
        {activeTab === "chats" ? (
          <ProjectChatList
            chats={chats}
            loading={projectChats.isLoading}
            projectId={projectId}
          />
        ) : null}
        {activeTab === "sources" ? (
          <ProjectSourceList
            error={knowledge.isError}
            loading={knowledge.isLoading}
            sources={sources}
            webResults={webResults}
          />
        ) : null}
        {activeTab === "automations" ? (
          <ProjectAutomationList
            automations={currentAutomations}
            error={automations.isError}
            loading={automations.isLoading}
            projectId={projectId}
          />
        ) : null}
      </div>
    </section>
  );
}

function PlusMenu({
  onAutomations,
  onFiles,
  onImages,
  onWebSearch,
}: {
  readonly onAutomations: () => void;
  readonly onFiles: () => void;
  readonly onImages: () => void;
  readonly onWebSearch: () => void;
}) {
  return (
    <div
      data-testid="project-plus-menu"
      className="absolute left-1 top-[64px] z-20 grid w-[322px] gap-1 rounded-[20px] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-2 shadow-[var(--lf-shadow-popover)]"
    >
      <MenuButton icon={<ImageIcon className="h-5 w-5" />} onClick={onImages}>
        Добавить фото
      </MenuButton>
      <MenuButton icon={<Paperclip className="h-5 w-5" />} onClick={onFiles}>
        Фото или файлы
      </MenuButton>
      <MenuButton icon={<Globe2 className="h-5 w-5" />} onClick={onWebSearch}>
        Поиск по сети
      </MenuButton>
      <MenuButton icon={<Workflow className="h-5 w-5" />} onClick={onAutomations}>
        Автоматизации
      </MenuButton>
    </div>
  );
}

function MenuButton({
  children,
  icon,
  onClick,
}: {
  readonly children: React.ReactNode;
  readonly icon: React.ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-left text-sm font-medium text-[color:var(--lf-text-primary)] transition hover:bg-[color:var(--lf-state-hover)]"
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}

function AutomationPicker({
  automations,
  error,
  loading,
  onSelect,
}: {
  readonly automations: readonly InstalledAutomationDetail[];
  readonly error: boolean;
  readonly loading: boolean;
  readonly onSelect: (automation: InstalledAutomationDetail) => void;
}) {
  return (
    <div
      data-testid="project-automation-picker"
      className="absolute left-1 top-[64px] z-20 grid w-[360px] gap-2 rounded-[20px] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-3 shadow-[var(--lf-shadow-popover)]"
    >
      <div className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--lf-text-muted)]">
        Автоматизации проекта
      </div>
      {loading ? <MutedLine text="Загружаю автоматизации..." /> : null}
      {!loading && error ? (
        <MutedLine text="Автоматизации временно недоступны. Попробуйте позже." />
      ) : null}
      {!loading && !error && automations.length === 0 ? (
        <MutedLine text="Автоматизаций пока нет." />
      ) : null}
      {automations.map((automation) => (
        <button
          key={automation.id}
          type="button"
          aria-label={`Прикрепить ${automation.title}`}
          className="grid rounded-[14px] px-3 py-2 text-left transition hover:bg-[color:var(--lf-state-hover)]"
          onClick={() => onSelect(automation)}
        >
          <span className="truncate text-sm font-semibold text-[color:var(--lf-text-primary)]">
            {automation.title}
          </span>
          <span className="mt-1 text-xs text-[color:var(--lf-text-muted)]">
            {automation.canRun ? "готова" : automation.nextGate}
          </span>
        </button>
      ))}
    </div>
  );
}

function WebSearchPanel({
  error,
  onClose,
  onQueryChange,
  onSubmit,
  query,
  results,
  searching,
}: {
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onQueryChange: (query: string) => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readonly query: string;
  readonly results: readonly ProjectWebSearchResult[];
  readonly searching: boolean;
}) {
  return (
    <form
      data-testid="project-web-search-panel"
      className="absolute left-1 top-[64px] z-20 grid w-[420px] max-w-[calc(100vw-48px)] gap-3 rounded-[20px] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-4 shadow-[var(--lf-shadow-popover)]"
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Search className="h-4 w-4" />
          Поиск по сети
        </div>
        <button
          type="button"
          aria-label="Закрыть поиск"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--lf-text-muted)] hover:bg-[color:var(--lf-state-hover)]"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Запрос для поиска по сети
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="h-10 rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-card)] px-3 text-sm outline-none focus:border-[color:var(--lf-primary)]"
          placeholder="Например, практика по договору поставки"
        />
      </label>
      <button
        type="submit"
        disabled={!query.trim() || searching}
        className="h-10 rounded-[var(--lf-radius-control)] bg-[color:var(--lf-primary)] px-4 text-sm font-semibold text-[color:var(--lf-primary-fg)] disabled:opacity-50"
      >
        Найти
      </button>
      {error ? <MutedLine text={error} /> : null}
      {results.length > 0 ? (
        <div className="grid gap-2">
          {results.map((result) => (
            <SourceRow key={result.id} source={result} />
          ))}
        </div>
      ) : null}
    </form>
  );
}

function TabButton({
  active,
  children,
  onClick,
  testId,
}: {
  readonly active: boolean;
  readonly children: React.ReactNode;
  readonly onClick: () => void;
  readonly testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      className={cn(
        "rounded-full px-5 py-3 text-sm font-semibold transition",
        active
          ? "bg-[color:var(--lf-state-active)] text-[color:var(--lf-text-primary)]"
          : "text-[color:var(--lf-text-muted)] hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ProjectChatList({
  chats,
  loading,
  projectId,
}: {
  readonly chats: readonly Stage15ProjectChatSummary[];
  readonly loading: boolean;
  readonly projectId: string;
}) {
  if (loading && chats.length === 0) {
    return <SkeletonRows />;
  }

  if (chats.length === 0) {
    return <EmptyState text="У этого проекта пока нет чатов." />;
  }

  return (
    <div className="grid min-w-0 gap-0">
      {chats.map((chat) => (
        <Link
          key={chat.id}
          href={`/app/projects/${projectId}/chats/${chat.id}`}
          className="grid min-w-0 border-b border-[color:var(--lf-border)] px-4 py-4 transition hover:bg-[color:var(--lf-state-hover)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[color:var(--lf-text-primary)]">
                {chat.title}
              </div>
              <div className="mt-1 truncate text-sm text-[color:var(--lf-text-secondary)]">
                {chat.lastMessagePreview ?? "Без сообщений"}
              </div>
            </div>
            <time className="shrink-0 text-sm text-[color:var(--lf-text-muted)]">
              {formatShortDate(chat.updatedAt)}
            </time>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ProjectSourceList({
  error,
  loading,
  sources,
  webResults,
}: {
  readonly error: boolean;
  readonly loading: boolean;
  readonly sources: readonly ProjectKnowledgeItem[];
  readonly webResults: readonly ProjectWebSearchResult[];
}) {
  const mergedSources = React.useMemo(() => {
    const seen = new Set(sources.flatMap(sourceIdentityKeys));
    const transientSources = webResults.filter((result) =>
      sourceIdentityKeys(result).every((key) => !seen.has(key)),
    );
    return { sources, transientSources };
  }, [sources, webResults]);

  if (loading && sources.length === 0) {
    return <SkeletonRows />;
  }

  if (error && sources.length === 0 && webResults.length === 0) {
    return <EmptyState text="Источники временно недоступны. Попробуйте позже." />;
  }

  if (sources.length === 0 && webResults.length === 0) {
    return <EmptyState text="Источников пока нет. Используйте плюс, чтобы добавить файлы или поиск по сети." />;
  }

  return (
    <div className="grid min-w-0 gap-0">
      {mergedSources.sources.map((source) => (
        <SourceRow key={source.id} source={source} />
      ))}
      {mergedSources.transientSources.map((source) => (
        <SourceRow key={source.id} source={source} />
      ))}
    </div>
  );
}

function ProjectAutomationList({
  automations,
  error,
  loading,
  projectId,
}: {
  readonly automations: readonly InstalledAutomationDetail[];
  readonly error: boolean;
  readonly loading: boolean;
  readonly projectId: string;
}) {
  if (loading && automations.length === 0) {
    return <SkeletonRows />;
  }

  if (error && automations.length === 0) {
    return <EmptyState text="Автоматизации временно недоступны. Попробуйте позже." />;
  }

  if (automations.length === 0) {
    return (
      <EmptyState text="Автоматизаций пока нет. Используйте плюс, чтобы прикрепить автоматизацию к новому чату." />
    );
  }

  return (
    <div className="grid min-w-0 gap-0">
      {automations.map((automation) => (
        <Link
          key={automation.id}
          href={`/app/projects/${projectId}/automations/${automation.id}/automation`}
          aria-label={automation.title}
          className="grid min-w-0 border-b border-[color:var(--lf-border)] px-4 py-4 transition hover:bg-[color:var(--lf-state-hover)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[color:var(--lf-text-primary)]">
                {automation.title}
              </div>
              <div className="mt-1 text-sm text-[color:var(--lf-text-secondary)]">
                {automation.canRun ? "готова к запуску" : automation.nextGate}
              </div>
            </div>
            <span className="shrink-0 text-sm text-[color:var(--lf-primary)]">
              Редактировать
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function AutomationChip({
  automation,
  onRemove,
  projectId,
}: {
  readonly automation: InstalledAutomationDetail;
  readonly onRemove: () => void;
  readonly projectId: string;
}) {
  return (
    <div
      data-testid="selected-automation-chip"
      className="flex max-w-full items-center gap-2 rounded-full border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-card)] px-3 py-1.5 text-sm"
    >
      <Workflow className="h-4 w-4 shrink-0 text-[color:var(--lf-primary)]" />
      <span className="max-w-[260px] truncate font-medium">{automation.title}</span>
      <Link
        href={`/app/projects/${projectId}/automations/${automation.id}/automation`}
        className="text-[color:var(--lf-primary)] hover:underline"
      >
        Редактировать
      </Link>
      <button
        type="button"
        className="flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--lf-text-muted)] hover:bg-[color:var(--lf-state-hover)]"
        aria-label="Убрать автоматизацию"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FileChip({
  item,
  onRemove,
}: {
  readonly item: LocalComposerFile;
  readonly onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
        item.error
          ? "border-[color:var(--lf-danger)]/40 bg-[color:var(--lf-danger)]/10"
          : "border-[color:var(--lf-border)] bg-[color:var(--lf-bg-card)]",
      )}
    >
      <Paperclip className="h-4 w-4 shrink-0" />
      <span className="max-w-[240px] truncate">{item.file.name}</span>
      {item.error ? (
        <span className="text-xs text-[color:var(--lf-danger)]">{item.error}</span>
      ) : null}
      <button
        type="button"
        className="flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--lf-text-muted)] hover:bg-[color:var(--lf-state-hover)]"
        aria-label="Убрать файл"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SourceRow({
  source,
}: {
  readonly source: ProjectKnowledgeItem | ProjectWebSearchResult;
}) {
  const title =
    "title" in source && source.title ? source.title : "Источник проекта";
  const summary =
    "summary" in source
      ? source.summary
      : "snippet" in source
        ? source.snippet
        : null;
  const url = "url" in source ? source.url : null;

  return (
    <div className="grid min-w-0 border-b border-[color:var(--lf-border)] px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[color:var(--lf-primary)] text-[color:var(--lf-primary-fg)]">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[color:var(--lf-text-primary)]">
            {title}
          </div>
          {summary ? (
            <div className="mt-1 line-clamp-2 text-sm text-[color:var(--lf-text-secondary)]">
              {summary}
            </div>
          ) : null}
          {url ? (
            <div className="mt-1 truncate text-xs text-[color:var(--lf-text-muted)]">
              {url}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function sourceIdentityKeys(
  source: ProjectKnowledgeItem | ProjectWebSearchResult,
): readonly string[] {
  const keys = new Set<string>();
  if ("url" in source && source.url) {
    keys.add(`url:${normalizeSourceUrl(source.url)}`);
  }
  if ("sourceId" in source && source.sourceId) {
    keys.add(`source:${source.sourceId}`);
  }
  if ("knowledgeItemId" in source && source.knowledgeItemId) {
    keys.add(`knowledge:${source.knowledgeItemId}`);
  }
  if (source.id) {
    keys.add(`id:${source.id}`);
  }

  return Array.from(keys);
}

function normalizeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

function SkeletonRows() {
  return (
    <div data-testid="project-skeleton-rows" className="grid gap-3 px-4 py-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-16 animate-pulse rounded-[var(--lf-radius-control)] bg-[color:var(--lf-bg-muted)]"
        />
      ))}
    </div>
  );
}

function EmptyState({ text }: { readonly text: string }) {
  return (
    <div className="rounded-[var(--lf-radius-control)] border border-dashed border-[color:var(--lf-border)] px-4 py-8 text-center text-sm text-[color:var(--lf-text-muted)]">
      <Bot className="mx-auto mb-3 h-6 w-6" />
      {text}
    </div>
  );
}

function MutedLine({ text }: { readonly text: string }) {
  return (
    <div className="rounded-[var(--lf-radius-control)] bg-[color:var(--lf-bg-muted)] px-3 py-2 text-sm text-[color:var(--lf-text-muted)]">
      {text}
    </div>
  );
}

function sortChatsNewestFirst(
  left: Stage15ProjectChatSummary,
  right: Stage15ProjectChatSummary,
) {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function validateComposerFile(file: File, kind: LocalComposerFile["kind"]) {
  if (file.size === 0) {
    return "Пустой файл.";
  }

  if (file.name.includes("/") || file.name.includes("\\")) {
    return "Некорректное имя файла.";
  }

  if (kind === "image" && !file.type.startsWith("image/")) {
    return "Нужен файл изображения.";
  }

  return null;
}

function readProjectWorkspaceTab(value: string | null): ProjectWorkspaceTab | null {
  if (value === "chats" || value === "sources" || value === "automations") {
    return value;
  }

  return null;
}
