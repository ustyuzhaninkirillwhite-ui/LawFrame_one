import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AiSecretService } from '../settings/ai-secret.service';

@Module({
  imports: [DatabaseModule],
  providers: [AiSecretService],
  exports: [AiSecretService],
})
export class AiSecretsModule {}
