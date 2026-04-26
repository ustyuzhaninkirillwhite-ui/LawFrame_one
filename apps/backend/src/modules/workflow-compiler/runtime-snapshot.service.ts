import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { stableStringify } from '../canvas/canvas-canonical';
import { ActivepiecesRuntimeClient } from './activepieces-runtime-client.service';

@Injectable()
export class RuntimeSnapshotService {
  private readonly env = loadServerEnv();

  constructor(private readonly activepieces: ActivepiecesRuntimeClient) {}

  normalizeSnapshot(snapshot: unknown): unknown {
    return normalizeValue(snapshot);
  }

  computeRuntimeHash(snapshot: unknown): string {
    return createHash('sha256')
      .update(stableStringify(this.normalizeSnapshot(snapshot)))
      .digest('hex');
  }

  async pullActivepiecesFlowSnapshot(input: {
    readonly projectId: string;
    readonly flowId: string;
  }): Promise<{
    readonly snapshot: unknown;
    readonly normalizedSnapshot: unknown;
    readonly snapshotHash: string;
    readonly flowVersionId: string | null;
  }> {
    const snapshot = await this.fetchFlow(input.projectId, input.flowId);
    const normalizedSnapshot = this.normalizeSnapshot(snapshot);
    return {
      snapshot,
      normalizedSnapshot,
      snapshotHash: this.computeRuntimeHash(snapshot),
      flowVersionId: extractFlowVersionId(snapshot),
    };
  }

  private async fetchFlow(projectId: string, flowId: string) {
    if (this.env.ACTIVEPIECES_SIMULATE_RUNS === '1') {
      throw new Error(
        'Activepieces runtime snapshot requires ACTIVEPIECES_SIMULATE_RUNS=0.',
      );
    }
    return (
      await this.activepieces.getFlow({
        projectId,
        flowId,
      })
    ).raw;
  }
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (!isRecord(value)) {
    return value;
  }
  const volatileKeys = new Set([
    'createdAt',
    'updatedAt',
    'created_at',
    'updated_at',
    'ownerId',
    'owner_id',
    'sampleData',
    'sample_data',
    'temp',
    'temporary',
    'lastRunId',
    'last_run_id',
    'logs',
  ]);
  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (volatileKeys.has(key)) {
      continue;
    }
    normalized[key] = normalizeValue(child);
  }
  return normalized;
}

function extractFlowVersionId(snapshot: unknown) {
  if (!isRecord(snapshot)) {
    return null;
  }
  const candidate =
    snapshot.versionId ??
    snapshot.version_id ??
    snapshot.publishedVersionId ??
    snapshot.published_version_id ??
    (isRecord(snapshot.version) ? snapshot.version.id : null);
  return typeof candidate === 'string' ? candidate : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
