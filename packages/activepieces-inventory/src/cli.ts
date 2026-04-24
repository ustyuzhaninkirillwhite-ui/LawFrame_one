import {
  generatePiecesMarkdown,
  scanActivepiecesPieces,
  summarizePieces,
} from './index';

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
};

declare const console: {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

const [, , repoArg, ...flags] = process.argv;
const repoRoot = repoArg || process.env.ACTIVEPIECES_REPO_ROOT || 'E:/activepieces-main';

try {
  const report = scanActivepiecesPieces(repoRoot);
  if (flags.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else if (flags.includes('--summary')) {
    console.log(summarizePieces(report));
  } else {
    console.log(generatePiecesMarkdown(report));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
