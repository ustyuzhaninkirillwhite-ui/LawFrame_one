import type {
  AiProviderConnectionDto,
  AiRouteGroup,
} from "./settings";
import { permissionCodes, roleCodes } from "./permissions/permission-codes";

test("RBAC contract publishes required workspace roles and high-risk settings permissions", () => {
  for (const role of ["owner", "admin", "lawyer", "assistant", "viewer"]) {
    assertOk(roleCodes.includes(role as never), `missing role ${role}`);
  }

  for (const permission of [
    "settings.organization.update",
    "settings.ai.manage_workspace",
    "settings.ai.secret.create_workspace",
    "settings.ai.secret.rotate_workspace",
    "settings.ai.connection.test",
    "workspace.member.update_role",
    "automation.run",
    "activepieces.open_builder",
  ]) {
    assertOk(
      permissionCodes.includes(permission as never),
      `missing permission ${permission}`,
    );
  }
});

test("AI route group contract keeps chat and automation preferences isolated", () => {
  const routeGroups = ["chat_ai", "automation_ai"] as const satisfies readonly AiRouteGroup[];

  assertDeepEqual(routeGroups, ["chat_ai", "automation_ai"]);
  assertNotEqual(routeGroups[0], routeGroups[1]);
});

test("browser-facing AI provider connection DTO exposes secret metadata only", () => {
  const dto = {
    id: "conn_001",
    workspaceId: "workspace_001",
    ownerScope: "workspace",
    ownerUserId: null,
    providerCode: "cometapi",
    uiLabel: "CometAPI",
    baseUrl: "https://api.cometapi.com/v1",
    modelId: "grok-4-1-fast-non-reasoning",
    enabled: true,
    secret: {
      hasSecret: true,
      secretStatus: "active",
      fingerprint: "sha256:fingerprint",
      lastUpdatedAt: "2026-05-13T00:00:00.000Z",
      backend: "supabase_vault",
    },
    capabilities: {
      streaming: true,
      jsonMode: true,
      structuredJsonSchema: true,
      toolCalls: false,
    },
    lastTestStatus: "success",
    lastTestedAt: "2026-05-13T00:00:00.000Z",
    lastUsedAt: null,
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
  } satisfies AiProviderConnectionDto;
  const serialized = JSON.stringify(dto);

  assertEqual(dto.secret.hasSecret, true);
  assertEqual(serialized.includes("apiKey"), false);
  assertEqual(serialized.includes("sk-"), false);
  assertEqual(Object.hasOwn(dto, "key"), false);
});

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function assertOk(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertNotEqual(actual: unknown, expected: unknown): void {
  if (actual === expected) {
    throw new Error(`Expected values to differ: ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}
