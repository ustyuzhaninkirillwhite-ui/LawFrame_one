import type {
  AiModelRoute,
  AiProviderCode,
  AiProviderConnection,
  AiRouteCode,
  AiRouteValve,
} from '@lexframe/contracts';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';

const NOW_PLACEHOLDER = '1970-01-01T00:00:00.000Z';
const DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_PROVIDER_CONNECTION_ID = 'owner_default_ai';

@Injectable()
export class AiProviderConnectionRegistryService {
  private readonly env = loadServerEnv();

  listConnections(): readonly AiProviderConnection[] {
    return [this.getDefaultConnection()];
  }

  getDefaultConnection(): AiProviderConnection {
    return {
      id:
        this.env.LEXFRAME_COMETAPI_API_KEY_REF ||
        DEFAULT_PROVIDER_CONNECTION_ID,
      workspaceId: null,
      providerCode: 'cometapi',
      displayName: 'CometAPI DeepSeek V4 Flash',
      baseUrl: this.env.LEXFRAME_COMETAPI_BASE_URL,
      apiKeyRef:
        this.env.LEXFRAME_COMETAPI_API_KEY_REF ||
        DEFAULT_PROVIDER_CONNECTION_ID,
      enabled: true,
      modelDiscoveryMode: 'manual_allowlist',
      allowedModels: [this.env.LEXFRAME_AI_DEFAULT_MODEL || DEFAULT_MODEL],
      defaultModel: this.env.LEXFRAME_AI_DEFAULT_MODEL || DEFAULT_MODEL,
      createdAt: NOW_PLACEHOLDER,
      updatedAt: NOW_PLACEHOLDER,
    };
  }
}

@Injectable()
export class AiModelRouteRegistryService {
  private readonly env = loadServerEnv();

  getDefaultRoute(): AiModelRoute {
    return this.getRoute('default_chat');
  }

  getRoute(routeCode: AiRouteCode): AiModelRoute {
    return this.listRoutes().find((route) => route.routeCode === routeCode)!;
  }

  listRoutes(): readonly AiModelRoute[] {
    const providerConnectionId =
      this.env.LEXFRAME_COMETAPI_API_KEY_REF || DEFAULT_PROVIDER_CONNECTION_ID;
    const defaultModel = this.env.LEXFRAME_AI_DEFAULT_MODEL || DEFAULT_MODEL;
    const providerCode: AiProviderCode = 'cometapi';

    return [
      {
        routeCode: 'default_chat',
        providerConnectionId,
        providerCode,
        model: defaultModel,
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: true,
        maxContextTokens: 1_000_000,
        visibleToUser: false,
        adminVisible: true,
        enabled: true,
      },
      {
        routeCode: 'agent_general',
        providerConnectionId,
        providerCode,
        model: defaultModel,
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: true,
        maxContextTokens: 1_000_000,
        visibleToUser: false,
        adminVisible: true,
        enabled: true,
      },
      {
        routeCode: 'rag_legal_summary',
        providerConnectionId,
        providerCode,
        model: defaultModel,
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: false,
        maxContextTokens: 1_000_000,
        visibleToUser: false,
        adminVisible: true,
        enabled: true,
      },
      {
        routeCode: 'automation_planner_high',
        providerConnectionId: 'stage20_reserved_owner_route',
        providerCode: 'openai',
        model: 'gpt-5.5',
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: true,
        visibleToUser: false,
        adminVisible: true,
        enabled: true,
      },
    ];
  }

  listEnabledRoutes(): readonly AiModelRoute[] {
    return this.listRoutes().filter((route) => route.enabled);
  }

  listValves(routeCode?: AiRouteCode): readonly AiRouteValve[] {
    const routes = routeCode
      ? [routeCode]
      : this.listRoutes().map((route) => route.routeCode);
    return routes.flatMap((route) => defaultValves(route));
  }
}

export function defaultValves(routeCode: AiRouteCode): readonly AiRouteValve[] {
  return [
    valve(routeCode, 'temperature', 'number', 0.2, 'Sampling temperature.'),
    valve(
      routeCode,
      'max_output_tokens',
      'number',
      4096,
      'Maximum provider output tokens.',
    ),
    valve(
      routeCode,
      'json_mode_enabled',
      'boolean',
      true,
      'Whether JSON output mode is requested.',
    ),
    valve(
      routeCode,
      'tool_calling_enabled',
      'boolean',
      routeCode !== 'rag_legal_summary',
      'Whether tool calling is allowed for this route.',
    ),
    valve(
      routeCode,
      'context_budget_tokens',
      'number',
      120_000,
      'Prompt context budget.',
    ),
    valve(
      routeCode,
      'redaction_required',
      'boolean',
      routeCode !== 'default_chat',
      'Require redaction/reference substitution before provider calls.',
    ),
    valve(
      routeCode,
      'allow_external_provider_for_client_material',
      'boolean',
      false,
      'Allow external provider for client material after policy checks.',
    ),
    valve(
      routeCode,
      'timeout_ms',
      'number',
      90_000,
      'Provider request timeout.',
    ),
    valve(
      routeCode,
      'retry_count',
      'number',
      1,
      'Transient provider retry count.',
    ),
  ];
}

function valve(
  routeCode: AiRouteCode,
  key: string,
  type: AiRouteValve['type'],
  defaultValue: unknown,
  description: string,
): AiRouteValve {
  return {
    routeCode,
    key,
    type,
    defaultValue,
    required: true,
    adminOnly: true,
    secret: false,
    description,
  };
}
