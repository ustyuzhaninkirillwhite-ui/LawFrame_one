"use client";

import type {
  AiChatSessionSummary,
  AiChatSource,
  AiChatResponse,
  AiClarificationQuestion,
  WorkflowDraftDetail,
  WorkflowDraftSummary,
} from "@lexframe/contracts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { FileText, GitBranch, LockKeyhole, MessageSquare, Send, ShieldAlert, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageShell } from "@/components/page-shell";
import { useAiChatStore } from "@/hooks/use-ai-chat-store";
import {
  useAiChatMessages,
  useAiChatSessions,
  useAiRedactionPreview,
  useAiRequest,
  useAiRequestEvents,
  useCreateWorkflowDraft,
  useSendAiChatMessage,
  useWorkflowDraft,
  useWorkflowDrafts,
  useUpdateWorkflowDraftInputs,
} from "@/hooks/domain/ai";
import {
  useInstalledAutomations,
  useLibraryTemplates,
} from "@/hooks/domain/automations";
import { useDocuments } from "@/hooks/domain/documents";
import {
  useSessionContext,
  useWorkspaceMembers,
} from "@/hooks/domain/session";
import { formatDateTime, formatStatus, t } from "@/lib/i18n";

export function AiChatWorkspace({
  initialSource,
  projectId,
}: {
  readonly initialSource?: AiChatSource;
  readonly projectId?: string;
} = {}) {
  const searchParams = useSearchParams();
  const store = useAiChatStore({
    source: initialSource ?? normalizeSource(searchParams.get("source")),
    mode: searchParams.get("automationId") ? "modify_workflow" : "create_workflow",
    currentAutomationId: searchParams.get("automationId"),
    selectedDocumentIds: searchParams.get("documentId")
      ? [searchParams.get("documentId")!]
      : [],
    selectedTemplateIds: searchParams.get("templateId")
      ? [searchParams.get("templateId")!]
      : [],
    activeSessionId: searchParams.get("sessionId"),
    activeDraftId: searchParams.get("draftId"),
  });
  const sessionContext = useSessionContext();
  const sessionsQuery = useAiChatSessions();
  const draftsQuery = useWorkflowDrafts();
  const messagesQuery = useAiChatMessages(store.state.activeSessionId);
  const activeDraftQuery = useWorkflowDraft(store.state.activeDraftId);
  const requestQuery = useAiRequest(store.state.activeRequestId);
  const requestEventsQuery = useAiRequestEvents(store.state.activeRequestId);
  const documentsQuery = useDocuments();
  const templatesQuery = useLibraryTemplates();
  const automationsQuery = useInstalledAutomations();
  const membersQuery = useWorkspaceMembers();
  const sendMessageMutation = useSendAiChatMessage();
  const saveDraftMutation = useCreateWorkflowDraft();
  const redactionPreviewMutation = useAiRedactionPreview();
  const updateDraftInputsMutation = useUpdateWorkflowDraftInputs(
    store.state.activeDraftId,
  );
  const [clarificationAnswers, setClarificationAnswers] = React.useState<Record<string, string>>({});

  const sessions = sessionsQuery.data ?? [];
  const drafts = draftsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const activeDraft = activeDraftQuery.data ?? null;
  const currentRequest = requestQuery.data ?? null;
  const currentRequestEvents = requestEventsQuery.data ?? [];
  const documents = documentsQuery.data?.items ?? [];
  const templates = templatesQuery.data ?? [];
  const automations = automationsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const activeDataClass =
    activeDraft?.policyReport.dataClass ?? "B_INTERNAL_WORKSPACE";

  React.useEffect(() => {
    const firstSession = sessionsQuery.data?.[0];
    if (!store.state.activeSessionId && firstSession) {
      store.updateState({
        activeSessionId: firstSession.id,
        source: firstSession.source,
        mode: firstSession.mode,
        currentAutomationId: firstSession.currentAutomationId,
        selectedDocumentIds: firstSession.selectedDocumentIds,
        selectedTemplateIds: firstSession.selectedTemplateIds,
        selectedProfileId: firstSession.selectedProfileId,
      });

      const linkedDraft = (draftsQuery.data ?? []).find(
        (draft) => draft.linkedSessionId === firstSession.id,
      );
      if (linkedDraft) {
        store.selectDraft(linkedDraft.id);
      }
    }
  }, [sessionsQuery.data, draftsQuery.data, store, store.state.activeSessionId]);

  React.useEffect(() => {
    const firstDraft = draftsQuery.data?.[0];
    if (!store.state.activeDraftId && firstDraft) {
      store.selectDraft(firstDraft.id);
    }
  }, [draftsQuery.data, store.state.activeDraftId, store]);

  React.useEffect(() => {
    const latestRequestId = activeDraft?.versions[0]?.aiRequestId ?? null;
    if (latestRequestId && latestRequestId !== store.state.activeRequestId) {
      store.selectRequest(latestRequestId);
    }
  }, [activeDraft, store]);

  const handleSendMessage = async () => {
    if (store.state.message.trim().length === 0) {
      return;
    }

    const response = await sendMessageMutation.mutateAsync({
      sessionId: store.state.activeSessionId,
      mode: store.state.mode,
      message: store.state.message,
      selectedDocumentIds: store.state.selectedDocumentIds,
      selectedTemplateIds: store.state.selectedTemplateIds,
      selectedProfileId: store.state.selectedProfileId,
      currentAutomationId: store.state.currentAutomationId,
    });

    syncResponse(response);
    store.resetComposer();
  };

  const handleSaveSnapshot = async () => {
    if (!activeDraft) {
      return;
    }

    const saved = await saveDraftMutation.mutateAsync({
      title: `${activeDraft.title} копия`,
      workflow: activeDraft.workflow,
      source: "manual",
      linkedSessionId: activeDraft.linkedSessionId,
    });

    store.selectDraft(saved.id);
  };

  const handleClarificationSubmit = async (
    questions: readonly AiClarificationQuestion[],
  ) => {
    const payload = Object.fromEntries(
      questions.map((question) => [question.field, clarificationAnswers[question.field] ?? ""]),
    );
    const draft = await updateDraftInputsMutation.mutateAsync({
      answers: payload,
    });
    setClarificationAnswers({});
    store.selectDraft(draft.id);
  };

  const handleRedactionPreview = async () => {
    if (store.deferredMessage.trim().length === 0) {
      return;
    }

    await redactionPreviewMutation.mutateAsync({
      text: store.deferredMessage,
      classification: activeDataClass,
      redactionPolicy: "balanced",
    });
  };

  function handleSelectSession(session: (typeof sessions)[number]) {
    store.updateState({
      activeSessionId: session.id,
      source: session.source,
      mode: session.mode,
      currentAutomationId: session.currentAutomationId,
      selectedDocumentIds: session.selectedDocumentIds,
      selectedTemplateIds: session.selectedTemplateIds,
      selectedProfileId: session.selectedProfileId,
    });

    const linkedDraft = drafts.find((draft) => draft.linkedSessionId === session.id);
    if (linkedDraft) {
      store.selectDraft(linkedDraft.id);
    }
  }

  function syncResponse(response: AiChatResponse) {
    if ("sessionId" in response && response.sessionId) {
      store.selectSession(response.sessionId);
    }

    if ("draftId" in response && response.draftId) {
      store.selectDraft(response.draftId);
    }

    if (response.status === "queued") {
      store.selectRequest(response.requestId);
    }
  }

  return (
    <PageShell
      eyebrow="этап 5 / ИИ-шлюз"
      title="Планирование процессов через чат остаётся явным, проверяемым и ограниченным политиками."
      description="Планировщик создаёт черновики и правки процессов, сохраняет каждый запрос на backend и показывает проверку, runtime-пробелы и контуры согласования до передачи в автоматизацию."
      badge={sessionContext.data.featureFlags.includes("stage5.ai-chat") ? "enabled" : "beta"}
    >
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <SessionColumn
            sessions={sessions}
            drafts={drafts}
            activeSessionId={store.state.activeSessionId}
            activeDraftId={store.state.activeDraftId}
            onSelectSession={handleSelectSession}
            onSelectDraft={store.selectDraft}
          />
          <PolicyCard
            aiAllowed={sessionContext.data.dataPolicy.aiAllowed}
            hasConfidentialPermission={sessionContext.data.permissions.includes("ai.use_confidential")}
            hasLegalSecretPermission={sessionContext.data.permissions.includes("ai.use_legal_secret")}
            activeDataClass={activeDataClass}
          />
        </div>

        <div className="space-y-6">
          <ComposerCard
            message={store.state.message}
            deferredMessage={store.deferredMessage}
            isPending={store.isPending || sendMessageMutation.isPending}
            mode={store.state.mode}
            source={store.state.source}
            selectedDocumentIds={store.state.selectedDocumentIds}
            selectedTemplateIds={store.state.selectedTemplateIds}
            selectedProfileId={store.state.selectedProfileId}
            currentAutomationId={store.state.currentAutomationId}
            documents={documents.map((document) => ({
              id: document.id,
              title: document.title,
              classification: document.classification,
            }))}
            templates={templates.map((template) => ({
              id: template.id,
              title: template.title,
            }))}
            automations={automations.map((automation) => ({
              id: automation.id,
              title: automation.title,
            }))}
            members={members.map((member) => ({
              id: member.userId,
              title: member.fullName ?? member.email,
            }))}
            onMessageChange={store.setMessage}
            onModeChange={(mode) => store.updateState({ mode })}
            onSourceChange={(source) => store.updateState({ source })}
            onToggleDocument={store.toggleDocument}
            onToggleTemplate={store.toggleTemplate}
            onProfileChange={(selectedProfileId) =>
              store.updateState({ selectedProfileId })
            }
            onAutomationChange={(currentAutomationId) =>
              store.updateState({
                currentAutomationId,
                mode: currentAutomationId ? "modify_workflow" : store.state.mode,
                source: currentAutomationId ? "automation_chat" : store.state.source,
              })
            }
            onSubmit={handleSendMessage}
          />

          <MessagesCard messages={messages} />

          {activeDraft?.clarificationQuestions.length ? (
            <ClarificationCard
              questions={activeDraft.clarificationQuestions}
              answers={clarificationAnswers}
              isPending={updateDraftInputsMutation.isPending}
              onChange={(field, value) =>
                setClarificationAnswers((current) => ({
                  ...current,
                  [field]: value,
                }))
              }
              onSubmit={() =>
                handleClarificationSubmit(activeDraft.clarificationQuestions)
              }
            />
          ) : null}
        </div>

        <div className="space-y-6">
          <RequestTimelineCard request={currentRequest} events={currentRequestEvents} />
          <WorkflowPreviewCard
            draft={activeDraft}
            projectId={projectId}
            onSaveSnapshot={handleSaveSnapshot}
          />
          <ValidationCard draft={activeDraft} />
          <RedactionCard
            text={store.deferredMessage}
            isPending={redactionPreviewMutation.isPending}
            preview={redactionPreviewMutation.data ?? null}
            onPreview={handleRedactionPreview}
          />
        </div>
      </div>
    </PageShell>
  );
}

function SessionColumn(props: {
  readonly sessions: readonly AiChatSessionSummary[];
  readonly drafts: readonly WorkflowDraftSummary[];
  readonly activeSessionId: string | null;
  readonly activeDraftId: string | null;
  readonly onSelectSession: (session: AiChatSessionSummary) => void;
  readonly onSelectDraft: (draftId: string | null) => void;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <Badge variant="accent">сессии</Badge>
          <CardTitle>Точки входа в чат</CardTitle>
          <CardDescription>
            Выберите общую, документную или привязанную к автоматизации сессию.
            Backend по умолчанию хранит только предварительные фрагменты.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {props.sessions.length === 0 ? (
            <EmptyState icon={MessageSquare} label="Сессий ИИ пока нет." />
          ) : (
            props.sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => props.onSelectSession(session)}
                className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${
                  props.activeSessionId === session.id
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/8"
                    : "border-[color:var(--line)] bg-white/4 hover:border-[color:var(--accent)]/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-[color:var(--foreground)]">
                    {session.title}
                  </div>
                  <Badge variant="muted">{formatStatus(session.source)}</Badge>
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  {formatStatus(session.mode)}
                </div>
                <div className="mt-2 text-sm text-[color:var(--muted)]">
                  {session.lastMessageAt
                    ? formatDateTime(session.lastMessageAt)
                    : "Сообщений пока нет"}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="muted">черновики</Badge>
          <CardTitle>Сохранённые черновики процессов</CardTitle>
          <CardDescription>
            Каждый результат планировщика остаётся версией черновика с данными
            проверки и политик.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {props.drafts.length === 0 ? (
            <EmptyState icon={FileText} label="Сохранённых черновиков пока нет." />
          ) : (
            props.drafts.map((draft) => (
              <button
                key={draft.id}
                type="button"
                onClick={() => props.onSelectDraft(draft.id)}
                className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${
                  props.activeDraftId === draft.id
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/8"
                    : "border-[color:var(--line)] bg-white/4 hover:border-[color:var(--accent)]/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-[color:var(--foreground)]">
                    {draft.title}
                  </div>
                  <Badge variant={draft.status === "validation_failed" ? "danger" : "muted"}>
                    {formatStatus(draft.status)}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-[color:var(--muted)]">
                  {formatDateTime(draft.updatedAt)}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ComposerCard(props: {
  readonly message: string;
  readonly deferredMessage: string;
  readonly isPending: boolean;
  readonly mode: "create_workflow" | "modify_workflow" | "explain_workflow" | "extract_fields";
  readonly source: AiChatSource;
  readonly selectedDocumentIds: readonly string[];
  readonly selectedTemplateIds: readonly string[];
  readonly selectedProfileId: string | null;
  readonly currentAutomationId: string | null;
  readonly documents: readonly { readonly id: string; readonly title: string; readonly classification: string }[];
  readonly templates: readonly { readonly id: string; readonly title: string }[];
  readonly automations: readonly { readonly id: string; readonly title: string }[];
  readonly members: readonly { readonly id: string; readonly title: string }[];
  readonly onMessageChange: (message: string) => void;
  readonly onModeChange: (mode: typeof props.mode) => void;
  readonly onSourceChange: (source: typeof props.source) => void;
  readonly onToggleDocument: (documentId: string) => void;
  readonly onToggleTemplate: (templateId: string) => void;
  readonly onProfileChange: (profileId: string | null) => void;
  readonly onAutomationChange: (automationId: string | null) => void;
  readonly onSubmit: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[color:var(--line)]/70 bg-[radial-gradient(circle_at_top_left,rgba(199,164,106,0.14),transparent_48%)]">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="accent">планировщик</Badge>
          <Badge variant="muted">{formatStatus(props.source)}</Badge>
          <Badge variant="muted">{formatStatus(props.mode)}</Badge>
        </div>
        <CardTitle>Чат управляет тем, что попадёт в черновик, а не тем, что будет исполнено.</CardTitle>
        <CardDescription>
          Шлюз сохраняет запрос, выбирает маршрут провайдера, создаёт черновик
          или правку и показывает проверку, политики и runtime-пробелы до любых
          действий автоматизации.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <LabelledSelect
            label="Точка входа"
            value={props.source}
            options={[
              { value: "global_chat", label: "Общий чат" },
              { value: "document_chat", label: "Документ" },
              { value: "automation_chat", label: "Автоматизация" },
            ]}
            onChange={(value) => props.onSourceChange(value as typeof props.source)}
          />
          <LabelledSelect
            label="Режим"
            value={props.mode}
            options={[
              { value: "create_workflow", label: "Создать процесс" },
              { value: "modify_workflow", label: "Изменить процесс" },
              { value: "explain_workflow", label: "Объяснить процесс" },
              { value: "extract_fields", label: "Извлечь поля" },
            ]}
            onChange={(value) => props.onModeChange(value as typeof props.mode)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <LabelledSelect
            label="Контекст автоматизации"
            value={props.currentAutomationId ?? ""}
            options={[
              { value: "", label: "Не выбрано" },
              ...props.automations.map((automation) => ({
                value: automation.id,
                label: automation.title,
              })),
            ]}
            onChange={(value) => props.onAutomationChange(value || null)}
          />
          <LabelledSelect
            label="Ответственный профиль"
            value={props.selectedProfileId ?? ""}
            options={[
              { value: "", label: "Не выбрано" },
              ...props.members.map((member) => ({
                value: member.id,
                label: member.title,
              })),
            ]}
            onChange={(value) => props.onProfileChange(value || null)}
          />
        </div>

        <SelectionMatrix
          label="Документы"
          items={props.documents}
          selectedIds={props.selectedDocumentIds}
          onToggle={props.onToggleDocument}
        />
        <SelectionMatrix
          label="Шаблоны"
          items={props.templates}
          selectedIds={props.selectedTemplateIds}
          onToggle={props.onToggleTemplate}
        />

        <div className="space-y-2">
          <div className="text-sm font-medium text-[color:var(--foreground)]">
            Запрос планировщика
          </div>
          <Textarea
            value={props.message}
            onChange={(event) => props.onMessageChange(event.target.value)}
            placeholder="Опишите процесс или правку, которую нужно подготовить."
          />
          <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
            <span>{props.deferredMessage.length} символов</span>
            <span>только структурированный ответ</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="lg"
            onClick={props.onSubmit}
            disabled={props.isPending || props.message.trim().length === 0}
          >
            <Send className="size-4" />
            Сформировать черновик
          </Button>
          <div className="text-sm text-[color:var(--muted)]">
            Отправка и runtime-шаги остаются заблокированными, пока не пройдена
            проверка и не закрыты отсутствующие привязки.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MessagesCard(props: {
  readonly messages: readonly {
    readonly id: string;
    readonly role: string;
    readonly contentPreview: string;
    readonly responseType: string | null;
    readonly createdAt: string;
  }[];
}) {
  return (
      <Card>
        <CardHeader>
        <Badge variant="muted">история сессии</Badge>
        <CardTitle>Лента сообщений</CardTitle>
        <CardDescription>
          Предпросмотр остаётся видимым даже при отключённом хранении открытого текста.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.messages.length === 0 ? (
          <EmptyState icon={MessageSquare} label="Сообщения пока не записаны." />
        ) : (
          props.messages.map((message) => (
            <div
              key={message.id}
              className="rounded-[22px] border border-[color:var(--line)] bg-white/4 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  {formatStatus(message.role)}
                </div>
                {message.responseType ? <Badge variant="muted">{formatStatus(message.responseType)}</Badge> : null}
              </div>
              <div className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                {message.contentPreview}
              </div>
              <div className="mt-2 text-xs text-[color:var(--muted)]">
                {formatDateTime(message.createdAt)}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ClarificationCard(props: {
  readonly questions: readonly AiClarificationQuestion[];
  readonly answers: Record<string, string>;
  readonly isPending: boolean;
  readonly onChange: (field: string, value: string) => void;
  readonly onSubmit: () => void;
}) {
  return (
      <Card>
        <CardHeader>
        <Badge variant="danger">нужно уточнение</Badge>
        <CardTitle>Недостающие данные нужно заполнить до продвижения черновика.</CardTitle>
        <CardDescription>
          Backend сохраняет черновик, помечает его заблокированным из-за
          отсутствующих полей и пересоздаёт версию после ответа.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {props.questions.map((question) => (
          <div key={question.field} className="space-y-2">
            <div className="text-sm font-medium text-[color:var(--foreground)]">
              {question.label}
            </div>
            <Input
              value={props.answers[question.field] ?? ""}
              onChange={(event) =>
                props.onChange(question.field, event.target.value)
              }
              placeholder={question.helpText ?? "Ответ"}
            />
          </div>
        ))}
        <Button type="button" onClick={props.onSubmit} disabled={props.isPending}>
          Сохранить уточнение
        </Button>
      </CardContent>
    </Card>
  );
}

function RequestTimelineCard(props: {
  readonly request: {
    readonly status: string;
    readonly routeReason: string;
    readonly dataClass: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly latencyMs: number | null;
    readonly costUsd: number;
  } | null;
  readonly events: readonly {
    readonly id: string;
    readonly type: string;
    readonly createdAt: string;
  }[];
}) {
  return (
      <Card>
        <CardHeader>
        <Badge variant="accent">лента запроса</Badge>
        <CardTitle>Маршрут провайдера, задержка и аудит остаются видимыми.</CardTitle>
        <CardDescription>
          Шлюз фиксирует выбор провайдера, события запроса и счётчики стоимости
          даже при fallback на локальный структурированный ответ.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {props.request ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Статус" value={props.request.status} icon={Waypoints} />
              <MetricCard label="Маршрут" value={props.request.routeReason} icon={GitBranch} />
              <MetricCard label="Класс данных" value={props.request.dataClass} icon={LockKeyhole} />
            </div>
            <div className="rounded-[22px] border border-[color:var(--line)] bg-white/4 p-4 text-sm text-[color:var(--muted)]">
              {props.request.latencyMs ? `${props.request.latencyMs} мс • ` : ""}
              {props.request.inputTokens + props.request.outputTokens} токенов • $
              {props.request.costUsd.toFixed(6)}
            </div>
          </>
        ) : (
          <EmptyState icon={Waypoints} label="Активный запрос не выбран." />
        )}

        <div className="space-y-2">
          {props.events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between rounded-[18px] border border-[color:var(--line)] bg-black/10 px-4 py-3 text-sm"
            >
              <div className="text-[color:var(--foreground)]">{formatStatus(event.type)}</div>
              <div className="text-[color:var(--muted)]">
                {new Date(event.createdAt).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowPreviewCard(props: {
  readonly draft: WorkflowDraftDetail | null;
  readonly projectId?: string;
  readonly onSaveSnapshot: () => void;
}) {
  if (!props.draft) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="muted">предпросмотр</Badge>
          <CardTitle>Черновик не выбран.</CardTitle>
          <CardDescription>
            Панель предпросмотра покажет шаги процесса, runtime-контуры и
            последующие действия после возврата черновика планировщиком.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="accent">предпросмотр процесса</Badge>
          <Badge variant={props.draft.status === "validation_failed" ? "danger" : "muted"}>
            {formatStatus(props.draft.status)}
          </Badge>
        </div>
        <CardTitle>{props.draft.title}</CardTitle>
        <CardDescription>
          Чат создаёт черновик процесса и явно показывает порядок графа,
          контуры согласования и runtime-привязки.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {props.draft.workflow.steps.map((step, index) => (
            <div
              key={step.stepId}
              className="rounded-[22px] border border-[color:var(--line)] bg-white/4 px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Шаг {index + 1} • {formatStatus(step.kind)}
                  </div>
                  <div className="mt-1 text-base font-medium text-[color:var(--foreground)]">
                    {step.title}
                  </div>
                </div>
                {step.requiresApproval ? <Badge variant="danger">согласование</Badge> : <Badge variant="success">автопроверка</Badge>}
              </div>
              <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {step.description}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="muted">{step.moduleCode}</Badge>
                {step.runtime.requiredConnection ? (
                  <Badge variant="muted">{step.runtime.requiredConnection}</Badge>
                ) : null}
                {step.runtime.requiredPiece ? (
                  <Badge variant="muted">{step.runtime.requiredPiece}</Badge>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="ghost" onClick={props.onSaveSnapshot}>
            Сохранить снимок
          </Button>
          {props.draft.linkedAutomationId ? (
            <>
              <Button asChild type="button" variant="ghost">
                <Link
                  href={automationHref(
                    props.projectId,
                    props.draft.linkedAutomationId,
                  )}
                >
                  Автоматизация
                </Link>
              </Button>
              <Button asChild type="button" variant="ghost">
                <Link
                  href={automationHref(
                    props.projectId,
                    props.draft.linkedAutomationId,
                    "runs",
                  )}
                >
                  Настроить пробный запуск
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function automationHref(
  projectId: string | undefined,
  automationId: string,
  tab?: "runs",
) {
  if (!projectId) {
    return `/automations/${automationId}${tab === "runs" ? "" : "/builder"}`;
  }

  const route = `/app/projects/${projectId}/automations/${automationId}/automation`;
  return tab ? `${route}?tab=${tab}` : route;
}

function ValidationCard(props: { readonly draft: WorkflowDraftDetail | null }) {
  if (!props.draft) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="muted">проверка</Badge>
          <CardTitle>Данные проверки пока отсутствуют.</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const blockingIssues = props.draft.validationReport.blockingErrors;
  const warnings = [
    ...props.draft.validationReport.warnings.map((issue) => issue.message),
    ...props.draft.policyReport.warnings,
    ...props.draft.runtimePlanPreview.missingRuntimeBindings.map((item) => item.reason),
  ];

  return (
    <Card>
      <CardHeader>
        <Badge variant="muted">контур доверия</Badge>
        <CardTitle>Проверка, политика и состояние runtime</CardTitle>
        <CardDescription>
          ИИ-чат только готовит черновик. Он не выполняет юридическое действие
          и не отправляет внешние сообщения.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Проверка"
            value={props.draft.validationReport.valid ? "valid" : "blocked"}
            icon={ShieldAlert}
          />
          <MetricCard
            label="Маршрут политики"
            value={props.draft.policyReport.providerRoute}
            icon={GitBranch}
          />
          <MetricCard
            label="Готовность к запуску"
            value={props.draft.runtimePlanPreview.runnable ? "yes" : "missing bindings"}
            icon={Waypoints}
          />
        </div>

        {blockingIssues.length ? (
          <div className="space-y-2">
            {blockingIssues.map((issue) => (
              <IssueRow key={`${issue.code}-${issue.path}`} tone="danger" text={issue.message} />
            ))}
          </div>
        ) : null}

        {warnings.length ? (
          <div className="space-y-2">
            {warnings.map((warning) => (
              <IssueRow key={warning} tone="muted" text={warning} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RedactionCard(props: {
  readonly text: string;
  readonly isPending: boolean;
  readonly preview: {
    readonly redactedText: string;
    readonly entities: readonly { readonly placeholder: string; readonly type: string }[];
  } | null;
  readonly onPreview: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <Badge variant="muted">предпросмотр обезличивания</Badge>
        <CardTitle>Проверка минимизации до маршрутизации провайдера.</CardTitle>
        <CardDescription>
          Инструмент вызывает endpoint предпросмотра обезличивания и хранит на
          backend только хэши и placeholders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-[22px] border border-[color:var(--line)] bg-white/4 p-4 text-sm leading-6 text-[color:var(--muted)]">
          {props.text.trim().length > 0
            ? props.text
            : "Составьте сообщение выше и используйте его как пример для предпросмотра обезличивания."}
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={props.onPreview}
          disabled={props.isPending || props.text.trim().length === 0}
        >
          Предпросмотр обезличивания
        </Button>
        {props.preview ? (
          <div className="space-y-3 rounded-[22px] border border-[color:var(--line)] bg-black/10 p-4">
            <div className="text-sm leading-6 text-[color:var(--foreground)]">
              {props.preview.redactedText}
            </div>
            <div className="flex flex-wrap gap-2">
              {props.preview.entities.map((entity) => (
                <Badge key={entity.placeholder} variant="muted">
                  {entity.placeholder} • {entity.type}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PolicyCard(props: {
  readonly aiAllowed: boolean;
  readonly hasConfidentialPermission: boolean;
  readonly hasLegalSecretPermission: boolean;
  readonly activeDataClass: string;
}) {
  return (
    <Card>
      <CardHeader>
        <Badge variant="muted">политика</Badge>
        <CardTitle>Права ИИ в рабочем пространстве</CardTitle>
        <CardDescription>
          Конфиденциальные маршруты и маршруты адвокатской тайны доступны только
          после явных проверок политики и прав.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <IssueRow tone={props.aiAllowed ? "success" : "danger"} text={`ИИ включён: ${props.aiAllowed ? "да" : "нет"}`} />
        <IssueRow tone={props.hasConfidentialPermission ? "success" : "muted"} text={`Доступ к конфиденциальным данным: ${props.hasConfidentialPermission ? "разрешён" : "не разрешён"}`} />
        <IssueRow tone={props.hasLegalSecretPermission ? "success" : "muted"} text={`Доступ к адвокатской тайне: ${props.hasLegalSecretPermission ? "разрешён" : "не разрешён"}`} />
        <IssueRow tone="muted" text={`Класс данных активного черновика: ${formatStatus(props.activeDataClass)}`} />
      </CardContent>
    </Card>
  );
}

function LabelledSelect(props: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <div className="text-sm font-medium text-[color:var(--foreground)]">
        {t(props.label)}
      </div>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-11 w-full rounded-full border border-[color:var(--line)] bg-white/4 px-4 text-sm text-[color:var(--foreground)]"
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.label)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectionMatrix(props: {
  readonly label: string;
  readonly items: readonly { readonly id: string; readonly title: string; readonly classification?: string }[];
  readonly selectedIds: readonly string[];
  readonly onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-[color:var(--foreground)]">
        {t(props.label)}
      </div>
      <div className="flex flex-wrap gap-2">
        {props.items.length === 0 ? (
          <div className="rounded-full border border-dashed border-[color:var(--line)] px-4 py-2 text-sm text-[color:var(--muted)]">
            Нет доступных вариантов
          </div>
        ) : (
          props.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => props.onToggle(item.id)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                props.selectedIds.includes(item.id)
                  ? "border-[color:var(--accent)] bg-[color:var(--accent)]/12 text-[color:var(--accent-strong)]"
                  : "border-[color:var(--line)] bg-white/4 text-[color:var(--muted)] hover:border-[color:var(--accent)]/40"
              }`}
            >
              {item.title}
              {item.classification ? ` • ${formatStatus(item.classification)}` : ""}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function MetricCard(props: {
  readonly label: string;
  readonly value: string;
  readonly icon: React.ComponentType<{ className?: string }>;
}) {
  const Icon = props.icon;

  return (
    <div className="rounded-[22px] border border-[color:var(--line)] bg-white/4 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
        <Icon className="size-4" />
        {t(props.label)}
      </div>
      <div className="mt-3 text-sm font-medium text-[color:var(--foreground)]">
        {formatStatus(props.value)}
      </div>
    </div>
  );
}

function IssueRow(props: { readonly tone: "danger" | "success" | "muted"; readonly text: string }) {
  const variant =
    props.tone === "danger" ? "danger" : props.tone === "success" ? "success" : "muted";

  return (
    <div className="flex items-start gap-3 rounded-[18px] border border-[color:var(--line)] bg-white/4 px-4 py-3">
      <Badge variant={variant}>{props.tone}</Badge>
      <div className="text-sm leading-6 text-[color:var(--foreground)]">{t(props.text)}</div>
    </div>
  );
}

function EmptyState(props: {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly label: string;
}) {
  const Icon = props.icon;

  return (
    <div className="rounded-[22px] border border-dashed border-[color:var(--line)] px-4 py-8 text-center">
      <Icon className="mx-auto size-6 text-[color:var(--muted)]" />
      <div className="mt-3 text-sm text-[color:var(--muted)]">{t(props.label)}</div>
    </div>
  );
}

function normalizeSource(value: string | null): AiChatSource {
  if (value === "automation_chat" || value === "document_chat" || value === "project_chat" || value === "global_chat") {
    return value;
  }

  return "global_chat";
}
