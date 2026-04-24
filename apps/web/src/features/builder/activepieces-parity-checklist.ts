export interface ActivepiecesCanvasParityItem {
  readonly feature: string;
  readonly sourcePath: string;
  readonly targetMode:
    | 'embedded'
    | 'fork_adapt'
    | 'native_lexframe'
    | 'external_advanced_step';
  readonly acceptance: string;
}

export const activepiecesCanvasParityChecklist: readonly ActivepiecesCanvasParityItem[] = [
  {
    feature: 'Piece trigger setup',
    sourcePath: 'packages/web/src/app/builder/step-settings/**',
    targetMode: 'native_lexframe',
    acceptance: 'Manual, webhook, schedule, and piece triggers compile to AP flow schema v20.',
  },
  {
    feature: 'Piece action dynamic props',
    sourcePath: 'packages/web/src/app/builder/piece-properties/**',
    targetMode: 'fork_adapt',
    acceptance: 'Dynamic properties load through LexFrame backend without frontend AP API keys.',
  },
  {
    feature: 'Router branches',
    sourcePath: 'packages/web/src/app/builder/flow-canvas/**',
    targetMode: 'native_lexframe',
    acceptance: 'Execute-first and execute-all routers preserve branch conditions and fallback.',
  },
  {
    feature: 'Loop on items',
    sourcePath: 'packages/shared/src/lib/automation/flows/actions/action.ts',
    targetMode: 'native_lexframe',
    acceptance: 'Loop body round-trips through compiler and reverse sync.',
  },
  {
    feature: 'Code step',
    sourcePath: 'packages/server/engine/src/lib/handler/**',
    targetMode: 'external_advanced_step',
    acceptance: 'Advanced code steps stay editable in embedded AP and are projected losslessly.',
  },
  {
    feature: 'Test step and sample data',
    sourcePath: 'packages/web/src/app/builder/test-step/**',
    targetMode: 'embedded',
    acceptance: 'Native run center links to AP test results and stores redacted sample data.',
  },
  {
    feature: 'Flow publish and version history',
    sourcePath: 'packages/web/src/app/builder/flow-versions/**',
    targetMode: 'native_lexframe',
    acceptance: 'LexFrame automation versions remain canonical and AP versions are runtime mappings.',
  },
  {
    feature: 'Import/export',
    sourcePath: 'packages/shared/src/lib/automation/flows/operations/**',
    targetMode: 'native_lexframe',
    acceptance: 'AP JSON import creates a LexFrame runtime projection with external_advanced_step fallback.',
  },
];
