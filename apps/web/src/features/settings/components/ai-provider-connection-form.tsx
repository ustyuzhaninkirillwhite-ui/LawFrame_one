"use client";

import type {
  AiConnectionTestResultDto,
  AiProviderCode,
  AiProviderConnectionCapabilities,
  AiProviderConnectionDto,
  AiRouteGroup,
} from "@lexframe/contracts";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AiKeyWriteOnlyField } from "./ai-key-write-only-field";
import { AiConnectionTestButton } from "./ai-connection-test-button";

const providers: readonly AiProviderCode[] = [
  "cometapi",
  "openai_compatible",
  "openai",
  "mock",
];

const DEFAULT_AI_PROVIDER: AiProviderCode = "cometapi";
const DEFAULT_AI_BASE_URL = "https://api.cometapi.com/v1";
const DEFAULT_AI_MODEL_ID = "grok-4-1-fast-non-reasoning";
const DEFAULT_AI_CAPABILITIES: AiProviderConnectionCapabilities = {
  streaming: true,
  jsonMode: true,
  structuredJsonSchema: true,
  toolCalls: true,
};

export interface AiProviderConnectionFormValue {
  readonly providerCode: AiProviderCode;
  readonly baseUrl: string;
  readonly modelId: string;
  readonly apiKey: string;
  readonly capabilities: AiProviderConnectionCapabilities;
}

export function AiProviderConnectionForm({
  connection,
  disabled,
  resetSensitiveInputVersion,
  routeGroup,
  testPending,
  testRequiresSave,
  testResult,
  onChange,
  onTest,
}: {
  readonly connection: AiProviderConnectionDto | null;
  readonly disabled?: boolean;
  readonly resetSensitiveInputVersion?: number;
  readonly routeGroup: AiRouteGroup;
  readonly testPending?: boolean;
  readonly testRequiresSave?: boolean;
  readonly testResult?: AiConnectionTestResultDto | null;
  readonly onChange: (value: AiProviderConnectionFormValue) => void;
  readonly onTest: () => void;
}) {
  const [value, setValue] = React.useState<AiProviderConnectionFormValue>(() => ({
    providerCode: connection?.providerCode ?? DEFAULT_AI_PROVIDER,
    baseUrl: connection?.baseUrl ?? DEFAULT_AI_BASE_URL,
    modelId: connection?.modelId ?? DEFAULT_AI_MODEL_ID,
    apiKey: "",
    capabilities: {
      streaming:
        connection?.capabilities.streaming ?? DEFAULT_AI_CAPABILITIES.streaming,
      jsonMode:
        connection?.capabilities.jsonMode ?? DEFAULT_AI_CAPABILITIES.jsonMode,
      structuredJsonSchema:
        connection?.capabilities.structuredJsonSchema ??
        DEFAULT_AI_CAPABILITIES.structuredJsonSchema,
      toolCalls:
        connection?.capabilities.toolCalls ?? DEFAULT_AI_CAPABILITIES.toolCalls,
    },
  }));

  React.useEffect(() => {
    const next = {
      providerCode: connection?.providerCode ?? DEFAULT_AI_PROVIDER,
      baseUrl: connection?.baseUrl ?? DEFAULT_AI_BASE_URL,
      modelId: connection?.modelId ?? DEFAULT_AI_MODEL_ID,
      apiKey: "",
      capabilities: {
        streaming:
          connection?.capabilities.streaming ??
          DEFAULT_AI_CAPABILITIES.streaming,
        jsonMode:
          connection?.capabilities.jsonMode ?? DEFAULT_AI_CAPABILITIES.jsonMode,
        structuredJsonSchema:
          connection?.capabilities.structuredJsonSchema ??
          DEFAULT_AI_CAPABILITIES.structuredJsonSchema,
        toolCalls:
          connection?.capabilities.toolCalls ??
          DEFAULT_AI_CAPABILITIES.toolCalls,
      },
    };
    setValue(next);
    onChange(next);
  }, [connection, onChange, routeGroup]);

  const previousResetVersion = React.useRef(resetSensitiveInputVersion);

  React.useEffect(() => {
    if (
      resetSensitiveInputVersion === undefined ||
      previousResetVersion.current === resetSensitiveInputVersion
    ) {
      return;
    }

    previousResetVersion.current = resetSensitiveInputVersion;

    if (value.apiKey) {
      const next = { ...value, apiKey: "" };
      setValue(next);
      onChange(next);
    }
  }, [onChange, resetSensitiveInputVersion, value]);

  const update = (patch: Partial<AiProviderConnectionFormValue>) => {
    const next = { ...value, ...patch };
    setValue(next);
    onChange(next);
  };

  const updateCapability = (
    key: keyof AiProviderConnectionCapabilities,
    checked: boolean,
  ) => {
    update({
      capabilities: {
        ...value.capabilities,
        [key]: checked,
      },
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          <span>Provider</span>
          <Select
            value={value.providerCode}
            disabled={disabled}
            onChange={(event) =>
              update({ providerCode: event.target.value as AiProviderCode })
            }
          >
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-medium md:col-span-2">
          <span>Base URL</span>
          <Input
            value={value.baseUrl}
            disabled={disabled}
            onChange={(event) => update({ baseUrl: event.target.value })}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium md:col-span-3">
          <span>Model id</span>
          <Input
            value={value.modelId}
            disabled={disabled}
            onChange={(event) => update({ modelId: event.target.value })}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Capability
          label="JSON/schema"
          checked={Boolean(value.capabilities.structuredJsonSchema)}
          disabled={disabled}
          onChange={(checked) => updateCapability("structuredJsonSchema", checked)}
        />
        <Capability
          label="JSON mode"
          checked={Boolean(value.capabilities.jsonMode)}
          disabled={disabled}
          onChange={(checked) => updateCapability("jsonMode", checked)}
        />
        <Capability
          label="Tool calls"
          checked={Boolean(value.capabilities.toolCalls)}
          disabled={disabled}
          onChange={(checked) => updateCapability("toolCalls", checked)}
        />
        <Capability
          label="Streaming"
          checked={Boolean(value.capabilities.streaming)}
          disabled={disabled}
          onChange={(checked) => updateCapability("streaming", checked)}
        />
      </div>

      <AiKeyWriteOnlyField
        value={value.apiKey}
        disabled={disabled}
        secret={
          connection?.secret ?? {
            hasSecret: false,
            secretStatus: "missing",
            fingerprint: null,
            lastUpdatedAt: null,
            backend: null,
          }
        }
        onChange={(apiKey) => update({ apiKey })}
      />

      <AiConnectionTestButton
        disabled={disabled || (!connection && !value.apiKey.trim())}
        isPending={testPending}
        requiresSave={testRequiresSave}
        result={testResult}
        onTest={onTest}
      />
    </div>
  );
}

function Capability({
  checked,
  disabled,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
