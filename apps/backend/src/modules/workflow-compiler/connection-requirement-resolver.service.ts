import type {
  LexFrameWorkflowV2,
  RuntimeConnectionRequirement,
  WorkflowNode,
} from '@lexframe/contracts';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface RuntimeConnectionRow {
  readonly id: string;
  readonly code: string;
  readonly provider: string;
  readonly status: 'connected' | 'missing' | 'error' | 'revoked';
  readonly external_connection_name: string | null;
}

@Injectable()
export class ConnectionRequirementResolver {
  private readonly env = loadServerEnv();

  constructor(private readonly databaseService: DatabaseService) {}

  async resolve(
    workspaceId: string,
    workflow: LexFrameWorkflowV2,
  ): Promise<readonly RuntimeConnectionRequirement[]> {
    const configured = await this.databaseService.query<RuntimeConnectionRow>(
      `
        select id, code, provider, status, external_connection_name
        from app.runtime_connections
        where workspace_id = $1
      `,
      [workspaceId],
    );
    const byCode = new Map(configured.rows.map((row) => [row.code, row]));
    const requirements = new Map<string, RuntimeConnectionRequirement>();

    for (const node of workflow.nodes) {
      for (const requirement of collectNodeRequirements(node)) {
        const row = byCode.get(requirement.connectionType);
        const localIntegratedConnection =
          row === undefined
            ? this.resolveLocalIntegratedConnection(requirement.connectionType)
            : null;
        const status =
          row?.status === 'connected'
            ? 'available'
            : row?.status === 'revoked'
              ? 'expired'
              : row?.status === 'error'
                ? 'forbidden'
                : (localIntegratedConnection?.status ?? 'missing');
        const key = `${node.id}:${requirement.connectionType}`;
        requirements.set(key, {
          requirement_id: key,
          source_node_id: node.id,
          connection_type: requirement.connectionType,
          required: requirement.required,
          status,
          connection_external_id:
            row?.external_connection_name ??
            localIntegratedConnection?.externalConnectionName ??
            null,
          setup_url: null,
        });
      }
    }

    return [...requirements.values()].sort((left, right) =>
      left.requirement_id.localeCompare(right.requirement_id),
    );
  }

  private resolveLocalIntegratedConnection(
    connectionType: RuntimeConnectionRequirement['connection_type'],
  ): {
    readonly status: RuntimeConnectionRequirement['status'];
    readonly externalConnectionName: string;
  } | null {
    if (
      connectionType !== 'email_provider' ||
      this.env.LEXFRAME_READINESS_PROFILE !== 'local-integrated' ||
      this.env.LEXFRAME_DELIVERY_TRANSPORT !== 'webhook' ||
      this.env.LEXFRAME_DELIVERY_WEBHOOK_URL.trim().length === 0 ||
      this.env.LEXFRAME_DELIVERY_FROM_EMAIL.trim().length === 0
    ) {
      return null;
    }

    return {
      status: 'available',
      externalConnectionName: 'local-integrated-delivery-webhook',
    };
  }
}

function collectNodeRequirements(node: WorkflowNode): readonly {
  readonly connectionType: RuntimeConnectionRequirement['connection_type'];
  readonly required: boolean;
}[] {
  const requirements: {
    connectionType: RuntimeConnectionRequirement['connection_type'];
    required: boolean;
  }[] = [];
  const runtimeMapping = node.runtime_mapping as Record<string, unknown>;
  const connectionType =
    typeof runtimeMapping.required_connection_type === 'string'
      ? runtimeMapping.required_connection_type
      : typeof runtimeMapping.connection_type === 'string'
        ? runtimeMapping.connection_type
        : null;
  if (connectionType) {
    requirements.push({
      connectionType: normalizeConnectionType(connectionType),
      required: true,
    });
  }

  for (const binding of node.input_bindings ?? []) {
    const source = binding.source as unknown as Record<string, unknown>;
    if (source?.type === 'connection') {
      const connectionType =
        readString(source.connection_type) ??
        readString(source.provider) ??
        readString(source.connection_id) ??
        'unknown';
      requirements.push({
        connectionType: normalizeConnectionType(connectionType),
        required: true,
      });
    }
  }

  if (node.type === 'delivery') {
    requirements.push({ connectionType: 'email_provider', required: true });
  }

  return requirements;
}

function normalizeConnectionType(
  value: string,
): RuntimeConnectionRequirement['connection_type'] {
  if (value.includes('telegram')) {
    return 'telegram_bot';
  }
  if (value.includes('email') || value.includes('smtp')) {
    return 'email_provider';
  }
  if (value.includes('ai')) {
    return 'ai_gateway';
  }
  if (value.includes('document')) {
    return 'document_storage';
  }
  if (value.includes('search')) {
    return 'search_service';
  }
  if (value.includes('lexframe') || value.includes('internal')) {
    return 'lexframe_internal_api';
  }
  return 'unknown';
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
