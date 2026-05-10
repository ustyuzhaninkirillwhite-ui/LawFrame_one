#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const DEFAULT_API_BASE = 'http://127.0.0.1:3100/api';
const DEFAULT_OWNER_EMAIL = 'stage16.owner@lexframe.test';
const SEEDED_DEV_USER_IDS = {
  'stage16.owner@lexframe.test': '16000000-0000-4000-8000-000000000001',
  'stage16.admin@lexframe.test': '16000000-0000-4000-8000-000000000002',
  'stage16.lawyer@lexframe.test': '16000000-0000-4000-8000-000000000003',
  'stage16.viewer@lexframe.test': '16000000-0000-4000-8000-000000000004',
  'stage16.security@lexframe.test': '16000000-0000-4000-8000-000000000005',
  'stage16.owner-b@lexframe.test': '16000000-0000-4000-8000-000000000006',
};
const PROVIDER_CODE = 'cometapi';
const BASE_URL = 'https://api.cometapi.com/v1';
const MODEL_ID = 'deepseek-v4-pro';
const CAPABILITIES = {
  structuredJsonSchema: true,
  jsonMode: true,
  toolCalls: true,
  streaming: true,
};
const ROUTE_GROUPS = ['chat_ai'];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiBase = normalizeApiBase(args.apiBase ?? DEFAULT_API_BASE);
  const apiKey = await loadApiKey(args);
  const token = createDevAccessToken(args.email ?? DEFAULT_OWNER_EMAIL);

  const client = createClient({
    apiBase,
    token,
  });
  const session = await client.request('/session/context');
  let workspaceId = session.activeWorkspace?.id ?? session.workspaces?.[0]?.id ?? null;

  if (!workspaceId) {
    const workspace = await client.request('/workspaces', {
      method: 'POST',
      body: {
        name: 'Stage 21 AI Smoke Workspace',
        slug: `stage21-ai-smoke-${Date.now()}`,
      },
    });
    workspaceId = workspace.id;
  }

  if (!workspaceId) {
    throw new Error('No workspace is available for the AI settings smoke test.');
  }

  client.setWorkspaceId(workspaceId);

  const settings = await client.request('/settings/ai');
  const preferredConnectionId =
    settings.routeGroups?.find(
      (preference) =>
        preference.routeGroup === 'chat_ai' && preference.providerConnectionId,
    )?.providerConnectionId ?? null;
  const existingConnection =
    settings.providerConnections?.find(
      (connection) => connection.id === preferredConnectionId,
    ) ??
    settings.providerConnections?.find(
      (connection) =>
        connection.providerCode === PROVIDER_CODE &&
        connection.baseUrl === BASE_URL &&
        connection.modelId === MODEL_ID,
    ) ??
    null;

  const connection = existingConnection
    ? await updateConnectionWithSecret(client, existingConnection.id, apiKey)
    : await createConnectionWithSecret(client, apiKey);

  const routeGroups = [];
  for (const routeGroup of ROUTE_GROUPS) {
    const preference = await client.request(`/settings/ai/route-groups/${routeGroup}`, {
      method: 'PATCH',
      body: {
        format: 'manual_form',
        scopeType: 'workspace',
        providerConnectionId: connection.id,
        modelId: MODEL_ID,
        enabled: true,
        capabilitiesConfirmed: CAPABILITIES,
      },
    });
    routeGroups.push({
      routeGroup,
      providerConnectionId: preference.providerConnectionId,
      modelId: preference.modelId,
      enabled: preference.enabled,
    });
  }

  const testResult = await client.request(
    `/settings/ai/provider-connections/${connection.id}/test`,
    { method: 'POST' },
  );

  const summary = {
    status: 'ok',
    apiBase,
    workspaceId,
    connectionId: connection.id,
    provider: connection.providerCode,
    baseUrl: connection.baseUrl,
    modelId: connection.modelId,
    routeGroups,
    secret: {
      hasSecret: Boolean(connection.secret?.hasSecret),
      backend: connection.secret?.backend ?? null,
      fingerprintPrefix: prefixFingerprint(connection.secret?.fingerprint),
      status: connection.secret?.secretStatus ?? null,
    },
    test: {
      status: testResult.status,
      errorCode: testResult.errorCode ?? null,
      message: testResult.message,
      testedAt: testResult.testedAt,
    },
    runtimeSmoke:
      process.env.AI_PROVIDER_MODE === 'controlled-real'
        ? 'skipped: use --runtime-smoke after confirming the target chat endpoint'
        : 'skipped: AI_PROVIDER_MODE is not controlled-real',
    automationAi:
      'controlled-limitation: automation_ai is not configured by this chat smoke until JSON/schema capability is verified separately',
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

async function createConnectionWithSecret(client, apiKey) {
  return client.request('/settings/ai/provider-connections', {
    method: 'POST',
    body: {
      format: 'manual_form',
      routeGroup: 'chat_ai',
      ownerScope: 'workspace',
      providerCode: PROVIDER_CODE,
      baseUrl: BASE_URL,
      modelId: MODEL_ID,
      apiKey,
      capabilities: CAPABILITIES,
    },
  });
}

async function updateConnectionWithSecret(client, connectionId, apiKey) {
  await client.request(`/settings/ai/provider-connections/${connectionId}`, {
    method: 'PATCH',
    body: {
      format: 'manual_form',
      providerCode: PROVIDER_CODE,
      baseUrl: BASE_URL,
      modelId: MODEL_ID,
      capabilities: CAPABILITIES,
      enabled: true,
    },
  });

  return client.request(`/settings/ai/provider-connections/${connectionId}/secret`, {
    method: 'POST',
    body: { apiKey },
  });
}

function createClient({ apiBase, token }) {
  let workspaceId = null;

  return {
    setWorkspaceId(value) {
      workspaceId = value;
    },
    async request(path, init = {}) {
      const headers = {
        authorization: `Bearer ${token}`,
      };

      if (workspaceId) {
        headers['x-workspace-id'] = workspaceId;
      }

      if (init.body !== undefined) {
        headers['content-type'] = 'application/json';
      }

      const response = await fetch(`${apiBase}${path}`, {
        method: init.method ?? 'GET',
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const text = await response.text();
      const payload = text ? safeJson(text) : null;

      if (!response.ok) {
        const code = payload?.error?.code ?? 'HTTP_ERROR';
        const message = payload?.error?.message ?? response.statusText;
        throw new Error(`HTTP ${response.status} ${code}: ${message}`);
      }

      return payload;
    },
  };
}

async function loadApiKey(args) {
  if (args.keyFile) {
    return extractApiKey(await readFile(args.keyFile, 'utf8'));
  }

  if (process.env.LEXFRAME_LIVE_AI_API_KEY) {
    return process.env.LEXFRAME_LIVE_AI_API_KEY.trim();
  }

  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    return extractApiKey(Buffer.concat(chunks).toString('utf8'));
  }

  throw new Error(
    'Provide an API key with --key-file, LEXFRAME_LIVE_AI_API_KEY, or stdin.',
  );
}

function extractApiKey(value) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const keyed = lines
    .map((line) => {
      const match = line.match(/^(?:COMETAPI_)?(?:API_)?KEY\s*[:=]\s*(.+)$/i);
      return match?.[1]?.trim() ?? null;
    })
    .find(Boolean);

  const candidate =
    keyed ??
    lines.find(
      (line) =>
        line.length >= 20 &&
        !line.includes('://') &&
        !/grok|cometapi|provider|base url|model/i.test(line),
    );

  if (!candidate) {
    throw new Error('No API key candidate was found in the provided input.');
  }

  return candidate.replace(/^['"]|['"]$/g, '').trim();
}

function createDevAccessToken(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = {
    id: SEEDED_DEV_USER_IDS[normalizedEmail] ?? SEEDED_DEV_USER_IDS[DEFAULT_OWNER_EMAIL],
    email: normalizedEmail,
    fullName: normalizedEmail.split('@')[0] || 'LexFrame User',
    emailConfirmedAt: new Date().toISOString(),
    assuranceLevel: 'aal1',
  };

  return `dev.${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
}

function parseArgs(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--key-file' && next) {
      result.keyFile = next;
      index += 1;
    } else if (arg === '--api-base' && next) {
      result.apiBase = next;
      index += 1;
    } else if (arg === '--email' && next) {
      result.email = next;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return result;
}

function normalizeApiBase(value) {
  return value.replace(/\/+$/, '');
}

function prefixFingerprint(value) {
  return typeof value === 'string' ? value.slice(0, 20) : null;
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function printHelp() {
  process.stdout.write(`Usage:
  node scripts/stage21/live-ai-settings-smoke.mjs --key-file "C:\\path\\Api.txt"
  LEXFRAME_LIVE_AI_API_KEY=... node scripts/stage21/live-ai-settings-smoke.mjs
  type Api.txt | node scripts/stage21/live-ai-settings-smoke.mjs

Options:
  --api-base <url>  Backend API base. Default: ${DEFAULT_API_BASE}
  --email <email>   Dev user email. Default: ${DEFAULT_OWNER_EMAIL}
`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
