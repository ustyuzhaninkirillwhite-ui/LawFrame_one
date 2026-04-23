export interface RuntimeDependencyStatus {
  readonly code: string;
  readonly status: "healthy" | "degraded" | "blocked";
  readonly summary: string;
  readonly checkedAt: string;
}

export interface RuntimeHealthSummary {
  readonly status: "ok" | "degraded" | "blocked";
  readonly service: string;
  readonly environment: string;
  readonly checkedAt: string;
  readonly uptimeSeconds: number;
  readonly dependencies: readonly RuntimeDependencyStatus[];
}

export interface ReleaseManifestImage {
  readonly service: string;
  readonly image: string;
  readonly digest: string | null;
}

export interface ReleaseManifest {
  readonly schemaVersion: "lexframe.release_manifest.v1";
  readonly generatedAt: string;
  readonly environment: "preview" | "staging" | "production";
  readonly commitSha: string;
  readonly contractsVersion: string;
  readonly images: readonly ReleaseManifestImage[];
  readonly migrations: readonly string[];
  readonly pieceVersions: readonly {
    readonly packageName: string;
    readonly version: string;
  }[];
  readonly aiAssets: {
    readonly promptVersions: readonly string[];
    readonly schemaVersions: readonly string[];
  };
  readonly build: {
    readonly backendArtifact: string | null;
    readonly frontendArtifact: string | null;
    readonly smokeReportPath: string | null;
  };
}
