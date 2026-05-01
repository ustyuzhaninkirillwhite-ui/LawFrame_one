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
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium uppercase tracking-normal text-[color:var(--lf-primary)]">{t(eyebrow)}</div>
          {badge ? <Badge variant="muted">{t(badge)}</Badge> : null}
        </div>
        <div className="max-w-4xl">
          <h1 className="text-3xl font-semibold leading-tight tracking-normal md:text-4xl">{t(title)}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--lf-text-muted)]">{t(description)}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
