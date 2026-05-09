"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { FolderOpen, MessageSquare, PlayCircle, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState } from "@/components/stage3-shared";
import {
  useCreateStage15ProjectChat,
  useStage15Projects,
} from "@/hooks/domain/stage15";
import { formatDateTime, formatStatus } from "@/lib/i18n";

export function WorkspaceHome() {
  const router = useRouter();
  const projectsQuery = useStage15Projects();
  const projects = projectsQuery.data?.items ?? [];
  const firstProjectId = projects[0]?.id ?? null;
  const createChat = useCreateStage15ProjectChat(firstProjectId);

  if (projectsQuery.isLoading) {
    return (
      <QueryState
        title="Загрузка проектов"
        description="Получаем Stage 15 project contracts для текущего workspace."
      />
    );
  }

  return (
    <section className="grid gap-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          <div className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--accent)]">
            Stage 15
          </div>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-5xl leading-[0.92]">
            Проекты LexFrame
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--muted)]">
            Project-first workspace объединяет чаты, документы, автоматизации, запуски и
            согласования в одном пользовательском контуре.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            if (!firstProjectId) {
              return;
            }

            void createChat.mutateAsync({ source: "project_chat" }).then((response) => {
              router.push(`/app/projects/${firstProjectId}/chats/${response.chat.id}`);
            });
          }}
          disabled={!firstProjectId || createChat.isPending}
        >
          <MessageSquare size={16} />
          Новый чат
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FolderOpen size={18} />} label="Проекты" value={projects.length} />
        <MetricCard
          icon={<MessageSquare size={18} />}
          label="Чаты"
          value={projects.reduce((sum, project) => sum + project.counters.chats, 0)}
        />
        <MetricCard
          icon={<Workflow size={18} />}
          label="Автоматизации"
          value={projects.reduce((sum, project) => sum + project.counters.automations, 0)}
        />
        <MetricCard
          icon={<PlayCircle size={18} />}
          label="Активные запуски"
          value={projects.reduce((sum, project) => sum + project.counters.activeRuns, 0)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={project.status === "active" ? "success" : "muted"}>
                    {formatStatus(project.status)}
                  </Badge>
                  <Badge variant="muted">{formatStatus(project.role)}</Badge>
                </div>
                <CardTitle className="mt-3">{project.name}</CardTitle>
                <CardDescription>{project.description}</CardDescription>
              </div>
              <Button asChild variant="ghost">
                <Link href={`/app/projects/${project.id}`}>Открыть</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <ProjectCounter label="Чаты" value={project.counters.chats} />
              <ProjectCounter label="Документы" value={project.counters.documents} />
              <ProjectCounter label="Запуски" value={project.counters.activeRuns} />
              <ProjectCounter label="Approvals" value={project.counters.pendingApprovals} />
              <ProjectCounter label="Рекомендации" value={project.counters.recommendations} />
              <ProjectCounter label="Connections" value={project.counters.missingConnections} />
              <div className="md:col-span-3 text-xs text-[color:var(--muted)]">
                Последняя активность: {formatDateTime(project.lastActivityAt)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-[color:var(--line)] bg-white/4 text-[color:var(--accent-strong)]">
          {icon}
        </div>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-[family-name:var(--font-display)] text-4xl">{value}</div>
      </CardContent>
    </Card>
  );
}

function ProjectCounter({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
        {label}
      </div>
      <div className="mt-2 font-[family-name:var(--font-display)] text-2xl">{value}</div>
    </div>
  );
}
