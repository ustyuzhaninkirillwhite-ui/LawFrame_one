const LOCAL_INTEGRATED_OPTIONAL_COMPONENTS = new Set([
  "ai",
  "search",
  "realtime",
]);

export function evaluateSystemStatusReadiness(
  payload,
  readinessProfile = "local-integrated",
) {
  if (!payload || typeof payload !== "object") {
    return {
      ready: false,
      blockerCode: "RUNTIME_STATUS_INVALID_PAYLOAD",
    };
  }

  if (payload.overall !== "healthy") {
    return {
      ready: false,
      blockerCode: "RUNTIME_OVERALL_NOT_HEALTHY",
    };
  }

  if (!Array.isArray(payload.components)) {
    return {
      ready: false,
      blockerCode: "RUNTIME_COMPONENTS_MISSING",
    };
  }

  for (const component of payload.components) {
    if (!component || typeof component !== "object") {
      return {
        ready: false,
        blockerCode: "RUNTIME_COMPONENT_INVALID",
      };
    }

    const code = String(component.code ?? "");
    const status = String(component.status ?? "");
    if (status === "healthy") {
      continue;
    }

    if (
      status === "degraded" &&
      readinessProfile === "local-integrated" &&
      LOCAL_INTEGRATED_OPTIONAL_COMPONENTS.has(code)
    ) {
      continue;
    }

    return {
      ready: false,
      blockerCode:
        status === "blocked"
          ? "RUNTIME_REQUIRED_COMPONENT_BLOCKED"
          : "RUNTIME_REQUIRED_COMPONENT_NOT_HEALTHY",
    };
  }

  return {
    ready: true,
    blockerCode: null,
  };
}

export function describeSystemStatus(payload) {
  const components = Array.isArray(payload?.components)
    ? payload.components
        .map((component) =>
          typeof component === "object" && component !== null
            ? `${String(component.code)}=${String(component.status)}`
            : "invalid-component",
        )
        .join(", ")
    : "no-components";
  return `overall=${String(payload?.overall ?? "missing")} ${components}`;
}

export function buildControlledRuntimeStopArgs(composeProfiles, services) {
  return [...composeProfiles, "stop", ...services];
}
