import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { LocalKeyFingerprintService } from './local-key-fingerprint.service';
import { LocalKeyResolver } from './local-key-resolver';
import { LocalKeysFileReader } from './local-keys-file-reader';
import { LocalKeysPathResolver } from './local-keys-path-resolver';
import { LocalKeysSchemaValidator } from './local-keys-schema-validator';
import { LocalKeysStatusController } from './local-keys-status.controller';
import { LocalOwnerKeyVaultService } from './local-owner-key-vault.service';
import { WindowsAclInspector } from './windows-acl-inspector';

@Module({
  imports: [AuditModule, DatabaseModule, IdentityModule],
  controllers: [LocalKeysStatusController],
  providers: [
    LocalOwnerKeyVaultService,
    LocalKeyResolver,
    LocalKeysPathResolver,
    LocalKeysFileReader,
    LocalKeysSchemaValidator,
    LocalKeyFingerprintService,
    WindowsAclInspector,
  ],
  exports: [LocalOwnerKeyVaultService, LocalKeyResolver],
})
export class LocalOwnerKeyVaultModule {}
