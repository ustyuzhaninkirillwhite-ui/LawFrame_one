import { Module } from '@nestjs/common';
import { RuntimeScopedTokenService } from './runtime-scoped-token.service';

@Module({
  providers: [RuntimeScopedTokenService],
  exports: [RuntimeScopedTokenService],
})
export class RuntimeModule {}
