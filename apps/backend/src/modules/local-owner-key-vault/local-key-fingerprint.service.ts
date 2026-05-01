import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

@Injectable()
export class LocalKeyFingerprintService {
  fingerprint(apiKey: string) {
    return createHash('sha256')
      .update(apiKey, 'utf8')
      .digest('hex')
      .slice(0, 12);
  }
}
