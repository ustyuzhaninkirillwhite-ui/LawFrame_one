import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";

interface PageShellProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly badge?: string;
  readonly children: React.ReactNode;
}

export function PageShell({ eyebrow, title, description, badge, children }: PageShellProps) {
  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--accent)]">{t(eyebrow)}</div>
          {badge ? <Badge variant="muted">{t(badge)}</Badge> : null}
        </div>
        <div className="max-w-4xl">
          <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[0.92]">{t(title)}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--muted)]">{t(description)}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
