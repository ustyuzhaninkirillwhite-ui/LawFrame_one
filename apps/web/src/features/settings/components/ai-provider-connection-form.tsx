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
  routeGroup,
  testPending,
  testResult,
  onChange,
  onTest,
}: {
  readonly connection: AiProviderConnectionDto | null;
  readonly disabled?: boolean;
  readonly routeGroup: AiRouteGroup;
  readonly testPending?: boolean;
  readonly testResult?: AiConnectionTestResultDto | null;
  readonly onChange: (value: AiProviderConnectionFormValue) => void;
  readonly onTest: () => void;
}) {
  const [value, setValue] = React.useState<AiProviderConnectionFormValue>(() => ({
    providerCode: connection?.providerCode ?? "openai_compatible",
    baseUrl: connection?.baseUrl ?? "https://api.example.com/v1",
    modelId: connection?.modelId ?? "",
    apiKey: "",
    capabilities: {
      streaming: connection?.capabilities.streaming ?? true,
      jsonMode: connection?.capabilities.jsonMode ?? routeGroup === "automation_ai",
      structuredJsonSchema:
        connection?.capabilities.structuredJsonSchema ??
        routeGroup === "automation_ai",
      toolCalls: connection?.capabilities.toolCalls ?? true,
    },
  }));

  React.useEffect(() => {
    const next = {
      providerCode: connection?.providerCode ?? "openai_compatible",
      baseUrl: connection?.baseUrl ?? "https://api.example.com/v1",
      modelId: connection?.modelId ?? "",
      apiKey: "",
      capabilities: {
        streaming: connection?.capabilities.streaming ?? true,
        jsonMode:
          connection?.capabilities.jsonMode ?? routeGroup === "automation_ai",
        structuredJsonSchema:
          connection?.capabilities.structuredJsonSchema ??
          routeGroup === "automation_ai",
        toolCalls: connection?.capabilities.toolCalls ?? true,
      },
    };
    setValue(next);
    onChange(next);
  }, [connection, onChange, routeGroup]);

  const update = (patch: Partial<AiProviderConnectionFormValue>) => {
    setValue((current) => {
      const next = { ...current, ...patch };
      onChange(next);
      return next;
    });
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
        disabled={disabled || !connection}
        isPending={testPending}
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
