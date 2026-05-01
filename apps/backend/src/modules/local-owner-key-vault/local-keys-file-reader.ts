import { Injectable } from '@nestjs/common';
import { lstat, readFile, stat } from 'node:fs/promises';

export const LOCAL_KEYS_MAX_BYTES = 64 * 1024;

@Injectable()
export class LocalKeysFileReader {
  async inspect(path: string) {
    const fileStat = await stat(path).catch((error: unknown) => {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    });

    if (!fileStat) {
      return { exists: false as const };
    }

    const linkStat = await lstat(path);

    return {
      exists: true as const,
      isFile: fileStat.isFile(),
      isSymlink: linkStat.isSymbolicLink(),
      size: fileStat.size,
    };
  }

  async readUtf8(path: string) {
    return readFile(path, 'utf8');
  }
}

function isNotFound(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
