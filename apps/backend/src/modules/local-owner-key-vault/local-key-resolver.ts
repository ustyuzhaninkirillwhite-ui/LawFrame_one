import type {
  KeyResolverResult,
  ResolveLocalKeyInput,
} from './local-owner-key-vault.types';
import { Injectable } from '@nestjs/common';
import { LocalOwnerKeyVaultService } from './local-owner-key-vault.service';

@Injectable()
export class LocalKeyResolver {
  constructor(private readonly vaultService: LocalOwnerKeyVaultService) {}

  resolveKey(input: ResolveLocalKeyInput): KeyResolverResult {
    return this.vaultService.resolveKey(input);
  }
}
