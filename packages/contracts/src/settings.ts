import type {
  AiProviderCode,
  AiRouteCode,
} from "./ai";
import type {
  PermissionCode,
  RoleCode,
} from "./permissions/permission-codes";
import type { WorkspaceStatus } from "./domain";

export type SettingsTab = "profile" | "organization" | "ai" | "diagnostics";

export type SettingsFormatCode = "manual_form" | "future_user_format";

export type AiRouteGroup = "chat_ai" | "automation_ai";

export type AiPreferenceScopeType = "user" | "workspace" | "system";

export type AiSecretBackend =
  | "supabase_vault"
  | "local_owner_vault"
  | "env_secret"
  | "dev_mock";

export type AiSecretStatus =
  | "missing"
  | "active"
  | "rotated"
  | "revoked"
  | "backend_unavailable";

export type AiConnectionTestStatus =
  | "not_tested"
  | "pending"
  | "success"
  | "failed"
  | "blocked";

export interface SettingsProfileDto {
  readonly userId: string;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly displayName: string | null;
  readonly fullName: string | null;
  readonly locale: string;
  readonly timezone: string;
}

export interface SettingsOrganizationDto {
  readonly workspaceId: string;
  readonly workspaceSlug: string;
  readonly workspaceName: string;
  readonly organizationDisplayName: string | null;
  readonly organizationLegalName: string | null;
  readonly status: WorkspaceStatus;
  readonly role: RoleCode;
  readonly canEditDisplayFields: boolean;
}

export interface SettingsBootstrapResponse {
  readonly profile: SettingsProfileDto;
  readonly organization: SettingsOrganizationDto | null;
  readonly permissions: readonly PermissionCode[];
  readonly tabs: readonly SettingsTab[];
}

export interface UpdateProfileSettingsRequest {
  readonly format?: SettingsFormatCode;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly displayName?: string | null;
  readonly locale?: string | null;
  readonly timezone?: string | null;
}

export interface UpdateOrganizationSettingsRequest {
  readonly format?: SettingsFormatCode;
  readonly organizationDisplayName?: string | null;
  readonly organizationLegalName?: string | null;
}

export interface AiSecretStatusDto {
  readonly hasSecret: boolean;
  readonly secretStatus: AiSecretStatus;
  readonly fingerprint: string | null;
  readonly lastUpdatedAt: string | null;
  readonly backend: AiSecretBackend | null;
}

export interface AiProviderConnectionCapabilities {
  readonly streaming?: boolean;
  readonly jsonMode?: boolean;
  readonly structuredJsonSchema?: boolean;
  readonly toolCalls?: boolean;
}

export interface AiProviderConnectionDto {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly ownerScope: AiPreferenceScopeType;
  readonly ownerUserId: string | null;
  readonly providerCode: AiProviderCode;
  readonly uiLabel: string;
  readonly baseUrl: string;
  readonly modelId: string;
  readonly enabled: boolean;
  readonly secret: AiSecretStatusDto;
  readonly capabilities: AiProviderConnectionCapabilities;
  readonly lastTestStatus: AiConnectionTestStatus;
  readonly lastTestedAt: string | null;
  readonly lastUsedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAiProviderConnectionRequest {
  readonly format?: SettingsFormatCode;
  readonly routeGroup: AiRouteGroup;
  readonly ownerScope?: Extract<AiPreferenceScopeType, "user" | "workspace">;
  readonly providerCode: AiProviderCode;
  readonly uiLabel?: string | null;
  readonly baseUrl: string;
  readonly modelId: string;
  readonly apiKey?: string | null;
  readonly capabilities?: AiProviderConnectionCapabilities;
}

export interface UpdateAiProviderConnectionRequest {
  readonly format?: SettingsFormatCode;
  readonly providerCode?: AiProviderCode;
  readonly uiLabel?: string | null;
  readonly baseUrl?: string;
  readonly modelId?: string;
  readonly enabled?: boolean;
  readonly capabilities?: AiProviderConnectionCapabilities;
}

export interface ReplaceAiProviderConnectionSecretRequest {
  readonly format?: SettingsFormatCode;
  readonly apiKey: string;
}

export interface AiRouteGroupPreferenceDto {
  readonly routeGroup: AiRouteGroup;
  readonly scopeType: AiPreferenceScopeType;
  readonly workspaceId: string | null;
  readonly userId: string | null;
  readonly providerConnectionId: string | null;
  readonly providerCode: AiProviderCode | null;
  readonly modelId: string | null;
  readonly enabled: boolean;
  readonly capabilitiesConfirmed: AiProviderConnectionCapabilities;
  readonly updatedAt: string | null;
}

export interface UpdateAiRouteGroupPreferenceRequest {
  readonly format?: SettingsFormatCode;
  readonly scopeType: Extract<AiPreferenceScopeType, "user" | "workspace">;
  readonly providerConnectionId: string;
  readonly modelId?: string | null;
  readonly enabled?: boolean;
  readonly capabilitiesConfirmed?: AiProviderConnectionCapabilities;
}

export interface AiEffectivePolicyDto {
  readonly routeGroup: AiRouteGroup;
  readonly routeCode: AiRouteCode;
  readonly source:
    | "user_preference"
    | "workspace_preference"
    | "system_default"
    | "stage18_default_route";
  readonly providerConnectionId: string;
  readonly providerCode: AiProviderCode;
  readonly modelId: string;
  readonly baseUrl: string | null;
  readonly hasSecret: boolean;
  readonly secretStatus: AiSecretStatus;
  readonly fingerprint: string | null;
  readonly supportsStreaming: boolean;
  readonly supportsJson: boolean;
  readonly supportsToolCalls: boolean;
  readonly policyDecisionId: string;
  readonly resolvedAt: string;
}

export interface AiConnectionTestResultDto {
  readonly providerConnectionId: string;
  readonly status: AiConnectionTestStatus;
  readonly latencyMs: number | null;
  readonly testedAt: string;
  readonly errorCode: string | null;
  readonly message: string;
  readonly redacted: true;
}

export interface AiSettingsResponse {
  readonly providerConnections: readonly AiProviderConnectionDto[];
  readonly routeGroups: readonly AiRouteGroupPreferenceDto[];
  readonly effectivePolicies: readonly AiEffectivePolicyDto[];
}

export interface AiEffectivePolicyResponse {
  readonly policies: readonly AiEffectivePolicyDto[];
}
