"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { QueryState, badgeVariantForStatus, readParam } from "@/components/stage3-shared";
import {
  useLegalModule,
  useLegalModules,
  useModerationPublicationRequest,
  useModerationPublicationRequests,
  useReviewPublicationRequest,
} from "@/hooks/use-stage0-data";
import { formatDateTime, formatStatus } from "@/lib/i18n";

export function AdminModulesPanel() {
  const { data = [], isLoading } = useLegalModules();

  if (isLoading) {
    return (
      <QueryState
        title="Загрузка административных модулей"
        description="Загружаем реестр юридических модулей этапа 3 для административного просмотра."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {data.map((module) => (
        <Card key={module.code}>
          <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="accent">{formatStatus(module.category)}</Badge>
                <Badge variant={badgeVariantForStatus(module.status)}>{formatStatus(module.status)}</Badge>
                <Badge variant={badgeVariantForStatus(module.riskLevel)}>
                  {formatStatus(module.riskLevel)}
                </Badge>
              </div>
              <div>
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </div>
            </div>
            <Button asChild variant="ghost">
              <Link href={`/admin/modules/${module.code}`}>Проверить</Link>
            </Button>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function AdminModuleDetailPanel() {
  const params = useParams<{ code: string }>();
  const code = readParam(params.code);
  const moduleDetail = useLegalModule(code);

  if (moduleDetail.isLoading || !moduleDetail.data) {
    return (
      <QueryState
        title="Загрузка деталей административного модуля"
        description="Загружаем версии и требования этого юридического модуля."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {moduleDetail.data.versions.map((version) => (
        <Card key={version.id}>
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="accent">{version.version}</Badge>
              <Badge variant={badgeVariantForStatus(version.status)}>{formatStatus(version.status)}</Badge>
              <Badge variant={badgeVariantForStatus(version.validationStatus)}>
                {formatStatus(version.validationStatus)}
              </Badge>
            </div>
            <CardTitle>{moduleDetail.data.title}</CardTitle>
            <CardDescription>{moduleDetail.data.description}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-[color:var(--muted)]">
            создано {formatDateTime(version.createdAt)}
            {version.publishedAt ? `, опубликовано ${formatDateTime(version.publishedAt)}` : ""}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ModerationQueuePanel() {
  const { data = [], isLoading } = useModerationPublicationRequests();

  if (isLoading) {
    return (
      <QueryState
        title="Загрузка очереди модерации"
        description="Загружаем отправленные и рассмотренные заявки на публикацию."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {data.map((request) => (
        <Card key={request.id}>
          <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={badgeVariantForStatus(request.status)}>{formatStatus(request.status)}</Badge>
                <Badge variant="muted">{request.workspaceId}</Badge>
              </div>
              <div>
                <CardTitle>{request.id}</CardTitle>
                <CardDescription>
                  шаблон {request.templateId}, версия {request.templateVersionId}
                </CardDescription>
              </div>
            </div>
            <Button asChild variant="ghost">
              <Link href={`/admin/moderation/publications/${request.id}`}>Рассмотреть</Link>
            </Button>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function ModerationDetailPanel() {
  const params = useParams<{ id: string }>();
  const publicationId = readParam(params.id);
  const publication = useModerationPublicationRequest(publicationId);
  const reviewMutation = useReviewPublicationRequest(publicationId);
  const [note, setNote] = useState("");

  if (publication.isLoading || !publication.data) {
    return (
      <QueryState
        title="Загрузка заявки модерации"
        description="Загружаем детали заявки на публикацию для рассмотрения."
      />
    );
  }

  const actions: Array<{
    decision: "approve" | "reject" | "request_changes";
    label: string;
    variant?: "ghost";
  }> = [
    { decision: "approve", label: "Согласовать" },
    { decision: "request_changes", label: "Запросить правки", variant: "ghost" },
    { decision: "reject", label: "Отклонить", variant: "ghost" },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant={badgeVariantForStatus(publication.data.status)}>
              {formatStatus(publication.data.status)}
            </Badge>
            <Badge variant="muted">{publication.data.workspaceId}</Badge>
          </div>
          <CardTitle>{publication.data.id}</CardTitle>
          <CardDescription>
            Шаблон {publication.data.templateId}, версия {publication.data.templateVersionId}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-[color:var(--muted)]">
          <div>отправлено {formatDateTime(publication.data.submittedAt)}</div>
          {publication.data.reviewedAt ? <div>рассмотрено {formatDateTime(publication.data.reviewedAt)}</div> : null}
          {publication.data.publicTemplateId ? (
            <div>публичный шаблон {publication.data.publicTemplateId}</div>
          ) : null}
          {publication.data.reviewNote ? (
            <div className="text-[color:var(--muted-strong)]">{publication.data.reviewNote}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="accent">рассмотрение</Badge>
          <CardTitle>Решение модерации</CardTitle>
          <CardDescription>
            Согласование создаёт или обновляет публичную проекцию библиотеки,
            не изменяя payload черновика рабочего пространства.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Комментарий к решению"
          />
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <Button
                key={action.decision}
                variant={action.variant}
                onClick={() => {
                  void reviewMutation.mutateAsync({
                    decision: action.decision,
                    note,
                  });
                }}
                disabled={reviewMutation.isPending || note.trim().length === 0}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
