import { Module } from '@nestjs/common';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AiSecretsModule } from '../ai-secrets/ai-secrets.module';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { AiSettingsService } from './ai-settings.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    IdentityModule,
    AIGatewayModule,
    AiSecretsModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService, AiSettingsService],
  exports: [SettingsService, AiSettingsService, AiSecretsModule],
})
export class SettingsModule {}
