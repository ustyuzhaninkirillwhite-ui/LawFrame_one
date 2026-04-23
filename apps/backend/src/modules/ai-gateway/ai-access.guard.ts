import type { LexframeRequest } from "../../common/types/lexframe-request";
import { AppHttpException } from "../../common/errors/app-http.exception";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AiPolicyService } from "./ai-policy.service";

@Injectable()
export class AiAccessGuard implements CanActivate {
  constructor(private readonly aiPolicyService: AiPolicyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<LexframeRequest>();
    const workspaceId = request.lexframe?.access?.activeWorkspace?.id;

    if (!workspaceId) {
      throw new AppHttpException(
        "WORKSPACE_CONTEXT_REQUIRED",
        403,
        "Для операций ИИ требуется контекст рабочего пространства.",
      );
    }

    const policy = await this.aiPolicyService.getWorkspacePolicy(workspaceId);

    if (!policy.aiEnabled) {
      throw new AppHttpException(
        "AI_POLICY_BLOCKED",
        403,
        "ИИ-функции отключены для этого рабочего пространства.",
      );
    }

    request.lexframe = {
      ...(request.lexframe ?? {}),
      aiPolicy: policy,
    };

    return true;
  }
}
