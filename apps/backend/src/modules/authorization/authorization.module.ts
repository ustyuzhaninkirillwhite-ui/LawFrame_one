import { Module, forwardRef } from '@nestjs/common';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [forwardRef(() => IdentityModule)],
  controllers: [AuthorizationController],
  providers: [AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
