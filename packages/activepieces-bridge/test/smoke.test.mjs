import assert from 'node:assert/strict';
import test from 'node:test';

import bridgeModule from '../dist/index.js';

const { createActivepiecesBridge, redactBridgeBody } = bridgeModule;

test('creates Activepieces projects through the configured transport', async () => {
  const calls = [];
  const bridge = createActivepiecesBridge({
    baseUrl: 'https://activepieces.example/',
    apiKey: 'test-api-key',
    serviceToken: 'service-token',
    fetchImpl: async (input, init) => {
      calls.push({ input, init });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ id: 'project_1' }),
      };
    },
  });

  const result = await bridge.createProject({
    displayName: 'Smoke Workspace',
    externalId: 'workspace_1',
  });

  assert.deepEqual(result, { id: 'project_1' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, 'https://activepieces.example/v1/projects');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-api-key');
  assert.equal(calls[0].init.headers['X-LexFrame-Service-Token'], 'service-token');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    displayName: 'Smoke Workspace',
    externalId: 'workspace_1',
  });
});

test('redacts nested bridge secrets before logging', () => {
  assert.deepEqual(
    redactBridgeBody({
      apiKey: 'visible-only-to-runtime',
      nested: {
        refreshToken: 'refresh',
        password: 'password',
        keep: 'safe',
      },
    }),
    {
      apiKey: '[redacted-by-lexframe-bridge]',
      nested: {
        refreshToken: '[redacted-by-lexframe-bridge]',
        password: '[redacted-by-lexframe-bridge]',
        keep: 'safe',
      },
    },
  );
});
