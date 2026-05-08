import type { AiSecretStatusDto } from "@lexframe/contracts";
import { Badge } from "@/components/ui/badge";

export function SecretStatusBadge({
  secret,
}: {
  readonly secret: AiSecretStatusDto;
}) {
  if (secret.hasSecret) {
    return <Badge variant="success">Ключ сохранён</Badge>;
  }

  if (secret.secretStatus === "backend_unavailable") {
    return <Badge variant="danger">Vault недоступен</Badge>;
  }

  return <Badge variant="muted">Ключ не задан</Badge>;
}
