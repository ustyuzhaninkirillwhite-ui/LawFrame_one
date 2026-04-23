import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { AiAccessGuard } from "./ai-access.guard";
import { AiPolicyService } from "./ai-policy.service";
import { AiProviderRegistry, CometApiAdapter, LocalMockAdapter, XAiAdapter } from "./ai-provider.adapters";
import { AiSecurityController } from "./ai-security.controller";
import { AiWorkspacePolicyGuard } from "./ai-workspace-policy.guard";
import { AIGatewayController } from "./ai-gateway.controller";
import { AIGatewayService } from "./ai-gateway.service";

@Module({
  imports: [IdentityModule, AuditModule],
  controllers: [AIGatewayController, AiSecurityController],
  providers: [
    AIGatewayService,
    AiPolicyService,
    AiAccessGuard,
    AiWorkspacePolicyGuard,
    LocalMockAdapter,
    XAiAdapter,
    CometApiAdapter,
    AiProviderRegistry,
  ],
  exports: [AIGatewayService, AiPolicyService, AiProviderRegistry],
})
export class AIGatewayModule {}
