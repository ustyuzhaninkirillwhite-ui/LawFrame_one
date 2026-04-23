import type { LexframeRequest } from "../../common/types/lexframe-request";
import { AppHttpException } from "../../common/errors/app-http.exception";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AiPolicyService } from "./ai-policy.service";

@Injectable()
export class AiWorkspacePolicyGuard implements CanActivate {
  constructor(private readonly aiPolicyService: AiPolicyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<LexframeRequest>();
    const workspaceId = request.lexframe?.access?.activeWorkspace?.id;

    if (!workspaceId) {
      throw new AppHttpException(
        "WORKSPACE_CONTEXT_REQUIRED",
        403,
        "Для проверки ИИ-политики требуется контекст рабочего пространства.",
      );
    }

    const policy =
      request.lexframe?.aiPolicy ??
      (await this.aiPolicyService.getWorkspacePolicy(workspaceId));

    request.lexframe = {
      ...(request.lexframe ?? {}),
      aiPolicy: policy,
    };

    const classification =
      typeof (request.body as { classification?: unknown } | undefined)?.classification ===
      "string"
        ? (request.body as { classification: string }).classification
        : null;

    if (classification === "C_CONFIDENTIAL_CLIENT" && !policy.allowConfidential) {
      throw new AppHttpException(
        "AI_POLICY_BLOCKED",
        403,
        "Обработка конфиденциальных данных через ИИ отключена для этого рабочего пространства.",
      );
    }

    if (classification === "C_LEGAL_SECRET" && !policy.allowLegalSecret) {
      throw new AppHttpException(
        "AI_POLICY_BLOCKED",
        403,
        "Обработка адвокатской тайны через ИИ отключена для этого рабочего пространства.",
      );
    }

    return true;
  }
}
