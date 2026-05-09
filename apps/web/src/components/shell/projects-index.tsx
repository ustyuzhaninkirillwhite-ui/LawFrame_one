"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCreateStage15Project,
  useStage15Projects,
} from "@/hooks/domain/stage15";

const defaultProjectColor = "#3B82F6";

export function ProjectsIndex() {
  const router = useRouter();
  const projectsQuery = useStage15Projects();
  const createProject = useCreateStage15Project();
  const [name, setName] = React.useState("");
  const projects = projectsQuery.data?.items ?? [];

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();

    if (!nextName) {
      return;
    }

    const response = await createProject.mutateAsync({
      name: nextName,
      description: "",
      color: defaultProjectColor,
    });
    setName("");
    router.push(`/app/projects/${response.project.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--lf-text-muted)]">
            LexFrame
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--lf-text-primary)]">
            Проекты
          </h1>
        </div>
        <form
          className="flex w-full max-w-xl items-end gap-2 sm:w-auto"
          onSubmit={(event) => void handleCreateProject(event)}
        >
          <label className="grid min-w-0 flex-1 gap-1 text-sm font-medium text-[color:var(--lf-text-muted)]">
            Название проекта
            <input
              className="h-10 min-w-64 rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] px-3 text-sm text-[color:var(--lf-text-primary)] outline-none focus:border-[color:var(--lf-primary)]"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, новый спор"
            />
          </label>
          <Button
            type="submit"
            disabled={!name.trim() || createProject.isPending}
            className="h-10"
          >
            <Plus size={16} />
            Создать проект
          </Button>
        </form>
      </header>

      {projectsQuery.isLoading ? (
        <div className="rounded-[var(--lf-radius-panel)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-6 text-sm text-[color:var(--lf-text-muted)]">
          Загружаю список проектов...
        </div>
      ) : null}

      <section className="grid gap-3">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/app/projects/${project.id}`}
            className="grid gap-3 rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-5 transition hover:border-[color:var(--lf-primary)] hover:shadow-[var(--lf-shadow-popover)] md:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--lf-radius-control)] bg-[color:var(--lf-state-active)] text-[color:var(--lf-primary)]">
                  <FolderOpen size={18} />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-[color:var(--lf-text-primary)]">
                    {project.name}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-[color:var(--lf-text-muted)]">
                    {project.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--lf-text-muted)]">
              <span>{project.counters.chats} чатов</span>
              <span>{project.counters.automations} автоматизаций</span>
              <span>{project.counters.documents} документов</span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
