import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SecretsModule } from '../secrets/secrets.module';
import { SecurityOperationsModule } from '../security-operations/security-operations.module';
import { AdminConsoleController } from './admin-console.controller';
import { AdminConsoleService } from './admin-console.service';

@Module({
  imports: [IdentityModule, SecretsModule, SecurityOperationsModule],
  controllers: [AdminConsoleController],
  providers: [AdminConsoleService],
})
export class AdminConsoleModule {}
