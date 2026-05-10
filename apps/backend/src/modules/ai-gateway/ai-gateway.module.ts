import { Module } from '@nestjs/common';
import { AiSecretsModule } from '../ai-secrets/ai-secrets.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { LocalOwnerKeyVaultModule } from '../local-owner-key-vault/local-owner-key-vault.module';
import { RuntimeModule } from '../runtime/runtime.module';
import { AiAccessGuard } from './ai-access.guard';
import { AiPolicyService } from './ai-policy.service';
import {
  AiProviderRegistry,
  CometApiAdapter,
  LocalMockAdapter,
  XAiAdapter,
} from './ai-provider.adapters';
import { AiSecurityController } from './ai-security.controller';
import { AiGatewayRuntimeController } from './ai-gateway-runtime.controller';
import { AiWorkspacePolicyGuard } from './ai-workspace-policy.guard';
import { AIGatewayController } from './ai-gateway.controller';
import { AIGatewayService } from './ai-gateway.service';
import {
  AiModelRouteRegistryService,
  AiProviderConnectionRegistryService,
} from './ai-route-registry.service';
import { AiRouteResolverService } from './ai-route-resolver.service';
import { AiRouteGroupResolverService } from './ai-route-group-resolver.service';

@Module({
  imports: [
    IdentityModule,
    AuditModule,
    AiSecretsModule,
    LocalOwnerKeyVaultModule,
    RuntimeModule,
  ],
  controllers: [
    AIGatewayController,
    AiSecurityController,
    AiGatewayRuntimeController,
  ],
  providers: [
    AIGatewayService,
    AiPolicyService,
    AiAccessGuard,
    AiWorkspacePolicyGuard,
    LocalMockAdapter,
    XAiAdapter,
    CometApiAdapter,
    AiProviderRegistry,
    AiProviderConnectionRegistryService,
    AiModelRouteRegistryService,
    AiRouteResolverService,
    AiRouteGroupResolverService,
  ],
  exports: [
    AIGatewayService,
    AiPolicyService,
    AiProviderRegistry,
    AiProviderConnectionRegistryService,
    AiModelRouteRegistryService,
    AiRouteResolverService,
    AiRouteGroupResolverService,
  ],
})
export class AIGatewayModule {}
