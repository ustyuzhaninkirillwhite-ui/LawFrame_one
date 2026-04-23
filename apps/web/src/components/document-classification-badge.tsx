"use client";

import type { DataClassification } from "@lexframe/contracts";
import type { BadgeProps } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";

const classificationMeta: Record<
  DataClassification,
  {
    readonly label: string;
    readonly variant: BadgeProps["variant"];
  }
> = {
  public: {
    label: "публично",
    variant: "success",
  },
  internal: {
    label: "внутренний контур",
    variant: "muted",
  },
  confidential: {
    label: "конфиденциально",
    variant: "danger",
  },
  legal_secret: {
    label: "адвокатская тайна",
    variant: "danger",
  },
  personal_data: {
    label: "персональные данные",
    variant: "danger",
  },
  client_material: {
    label: "материалы клиента",
    variant: "accent",
  },
  ai_forbidden_external: {
    label: "ИИ запрещён",
    variant: "danger",
  },
  anonymized: {
    label: "обезличено",
    variant: "success",
  },
};

interface DocumentClassificationBadgeProps {
  readonly classification: DataClassification;
  readonly className?: string;
}

export function DocumentClassificationBadge({
  classification,
  className,
}: DocumentClassificationBadgeProps) {
  const meta = classificationMeta[classification];

  return (
    <Badge className={className} variant={meta.variant}>
      {meta.label}
    </Badge>
  );
}
