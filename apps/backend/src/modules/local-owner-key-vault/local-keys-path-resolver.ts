import type { PathResolutionResult } from './local-owner-key-vault.types';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { realpath } from 'node:fs/promises';

@Injectable()
export class LocalKeysPathResolver {
  private readonly env = loadServerEnv();
  private readonly repoRoot = findRepoRoot(process.cwd());

  async resolve(): Promise<PathResolutionResult> {
    if (this.env.LEXFRAME_LOCAL_KEYS_DISABLED === 'true') {
      return {
        disabled: true,
        source: null,
        configuredPath: null,
        canonicalPath: null,
        pathHint: null,
      };
    }

    const configuredPath = (this.env.LEXFRAME_LOCAL_KEYS_FILE ?? '').trim();
    const source = configuredPath.length > 0 ? 'env_override' : 'default_path';
    const candidate =
      configuredPath.length > 0
        ? configuredPath
        : path.join(
            process.env.USERPROFILE ?? homedir(),
            '.lexframe',
            'secrets',
            'lexframe.keys.local.json',
          );
    const resolved = path.resolve(candidate);
    const canonicalPath = await realpath(resolved).catch(() => resolved);
    const pathHint =
      source === 'default_path'
        ? '%USERPROFILE%\\.lexframe\\secrets\\lexframe.keys.local.json'
        : canonicalPath;

    if (isInside(canonicalPath, this.repoRoot)) {
      return errorResult(
        source,
        candidate,
        canonicalPath,
        pathHint,
        'LOCAL_KEYS_PATH_INSIDE_REPO',
        '$file.path',
      );
    }

    const activepiecesSourceDir = (
      this.env.ACTIVEPIECES_SOURCE_DIR ?? ''
    ).trim();
    if (activepiecesSourceDir.length > 0) {
      const activepiecesRoot = path.resolve(activepiecesSourceDir);
      if (isInside(canonicalPath, activepiecesRoot)) {
        return errorResult(
          source,
          candidate,
          canonicalPath,
          pathHint,
          'LOCAL_KEYS_PATH_INSIDE_ACTIVEPIECES',
          '$file.path',
        );
      }
    }

    return {
      disabled: false,
      source,
      configuredPath: candidate,
      canonicalPath,
      pathHint,
    };
  }
}

function errorResult(
  source: PathResolutionResult['source'],
  configuredPath: string,
  canonicalPath: string,
  pathHint: string,
  code: NonNullable<PathResolutionResult['error']>['code'],
  errorPath: string,
): PathResolutionResult {
  return {
    disabled: false,
    source,
    configuredPath,
    canonicalPath,
    pathHint,
    error: {
      code,
      path: errorPath,
    },
  };
}

function findRepoRoot(start: string) {
  let current = path.resolve(start);

  while (true) {
    if (
      existsSync(path.join(current, 'pnpm-workspace.yaml')) ||
      existsSync(path.join(current, '.git'))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(start);
    }
    current = parent;
  }
}

function isInside(candidate: string, root: string) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relative.length === 0 ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}
