import type {
  AiConnectionTestResultDto,
  AiEffectivePolicyResponse,
  AiProviderConnectionDto,
  AiSettingsResponse,
  AiRouteGroup,
  AiRouteGroupPreferenceDto,
  CreateAiProviderConnectionRequest,
  SettingsBootstrapResponse,
  UpdateAiProviderConnectionRequest,
  UpdateAiRouteGroupPreferenceRequest,
  UpdateOrganizationSettingsRequest,
  UpdateProfileSettingsRequest,
} from "@lexframe/contracts";
import { requestJson, withJsonBody, type FetchOptions } from "./core";

export interface SettingsApi {
  getSettingsBootstrap(): Promise<SettingsBootstrapResponse>;
  updateSettingsProfile(
    input: UpdateProfileSettingsRequest,
  ): Promise<SettingsBootstrapResponse["profile"]>;
  updateSettingsOrganization(
    input: UpdateOrganizationSettingsRequest,
  ): Promise<NonNullable<SettingsBootstrapResponse["organization"]>>;
  getAiSettings(): Promise<AiSettingsResponse>;
  createAiProviderConnection(
    input: CreateAiProviderConnectionRequest,
  ): Promise<AiProviderConnectionDto>;
  updateAiProviderConnection(
    connectionId: string,
    input: UpdateAiProviderConnectionRequest,
  ): Promise<AiProviderConnectionDto>;
  replaceAiProviderConnectionSecret(
    connectionId: string,
    input: { readonly apiKey: string },
  ): Promise<AiProviderConnectionDto>;
  testAiProviderConnection(
    connectionId: string,
  ): Promise<AiConnectionTestResultDto>;
  updateAiRouteGroupPreference(
    routeGroup: AiRouteGroup,
    input: UpdateAiRouteGroupPreferenceRequest,
  ): Promise<AiRouteGroupPreferenceDto>;
  getAiEffectivePolicy(): Promise<AiEffectivePolicyResponse>;
}

export function createSettingsClient(options: FetchOptions): SettingsApi {
  return {
    getSettingsBootstrap: () => requestJson(options, "/settings/bootstrap"),
    updateSettingsProfile: (input) =>
      requestJson(
        options,
        "/settings/profile",
        withJsonBody(input, { method: "PATCH" }),
      ),
    updateSettingsOrganization: (input) =>
      requestJson(
        options,
        "/settings/organization",
        withJsonBody(input, { method: "PATCH" }),
      ),
    getAiSettings: () => requestJson(options, "/settings/ai"),
    createAiProviderConnection: (input) =>
      requestJson(
        options,
        "/settings/ai/provider-connections",
        withJsonBody(input, { method: "POST" }),
      ),
    updateAiProviderConnection: (connectionId, input) =>
      requestJson(
        options,
        `/settings/ai/provider-connections/${connectionId}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    replaceAiProviderConnectionSecret: (connectionId, input) =>
      requestJson(
        options,
        `/settings/ai/provider-connections/${connectionId}/secret`,
        withJsonBody(input, { method: "POST" }),
      ),
    testAiProviderConnection: (connectionId) =>
      requestJson(options, `/settings/ai/provider-connections/${connectionId}/test`, {
        method: "POST",
      }),
    updateAiRouteGroupPreference: (routeGroup, input) =>
      requestJson(
        options,
        `/settings/ai/route-groups/${routeGroup}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    getAiEffectivePolicy: () =>
      requestJson(options, "/settings/ai/effective-policy"),
  };
}
