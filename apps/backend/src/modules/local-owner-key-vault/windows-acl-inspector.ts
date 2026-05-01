import type { AclInspectionResult } from './local-owner-key-vault.types';
import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const BROAD_ACL_IDENTITY =
  /(^|\s)(Everyone|BUILTIN\\Users|Users|Authenticated Users):/i;
const BROAD_ACL_RIGHTS = /\((?:[^)]*(?:F|M|RX|R|GR|GE|GA)[^)]*)\)/i;

@Injectable()
export class WindowsAclInspector {
  async inspect(path: string): Promise<AclInspectionResult> {
    if (process.platform !== 'win32') {
      return {
        ok: true,
        warnings: [],
      };
    }

    const output = await execFileAsync('icacls', [path], {
      windowsHide: true,
    }).catch(() => null);

    if (!output) {
      return {
        ok: false,
        warnings: [{ code: 'LOCAL_KEYS_FILE_UNREADABLE', path: '$file.acl' }],
      };
    }

    const hasBroadRead = output.stdout
      .split(/\r?\n/)
      .some((line) => lineGrantsBroadRead(line));

    return {
      ok: !hasBroadRead,
      warnings: hasBroadRead
        ? [{ code: 'LOCAL_KEYS_ACL_TOO_BROAD', path: '$file.acl' }]
        : [],
    };
  }
}

function lineGrantsBroadRead(line: string) {
  return BROAD_ACL_IDENTITY.test(line) && BROAD_ACL_RIGHTS.test(line);
}
