export const aiReleaseGuards = {
  requireRedactionCoverage: true,
  requireProviderFailureFallback: true,
  requireSchemaCompatibility: true,
  requireClassCRouteBlock: true,
} as const;

export const aiCanaryPolicy = {
  rolloutPercentage: 5,
  allowSensitiveTraffic: false,
} as const;
