export type TokenCategory =
  | "color"
  | "radius"
  | "border"
  | "shadow"
  | "spacing"
  | "typography"
  | "componentState"
  | "componentRecipe";

export type TokenSourceStatus =
  | "observed"
  | "derived"
  | "fallback"
  | "blocked";

export interface TokenValue {
  readonly name: string;
  readonly value: string;
  readonly source: TokenSourceStatus;
  readonly note?: string;
}

export interface TokenGroup {
  readonly category: TokenCategory;
  readonly tokens: readonly TokenValue[];
}

export interface ActivepiecesSourceInventory {
  readonly packageName: "activepieces";
  readonly version: string;
  readonly sourceRoot: string;
  readonly gitCommit: string | null;
  readonly gitStatus: string;
  readonly packageManager: string;
  readonly inspectedPaths: readonly string[];
  readonly licenseBoundary: string;
}

export interface ActivepiecesGeneratedInventory {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly source: ActivepiecesSourceInventory;
  readonly groups: readonly TokenGroup[];
}

export interface LexFrameTokenMapping {
  readonly lexFrameToken: string;
  readonly activepiecesBridgeToken: string;
  readonly category: TokenCategory;
  readonly usage: string;
  readonly acceptanceNote: string;
}
