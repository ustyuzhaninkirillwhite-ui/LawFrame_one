import type {
  ActivepiecesFeatureAdoption,
  ActivepiecesSecretBoundaryCheck,
  ActivepiecesSecurityPolicy,
} from './activepieces-parity.types';

const FRONTEND_FORBIDDEN_SECRET_KEYS = [
  'activepiecesApiKey',
  'activepiecesSigningPrivateKey',
  'supabaseServiceRole',
  'aiProviderKey',
  'oauthClientSecret',
  'redisUrl',
  'postgresUrl',
  'databaseUrl',
  'serviceRole',
  'privateKey',
  'apiKey',
  'accessToken',
  'refreshToken',
];

const FORBIDDEN_PRODUCTION_PIECES = [
  '@activepieces/piece-supabase',
  'supabase',
  'service_role',
];

const ADMIN_ONLY_PIECE_PATTERNS = [
  /postgres|mysql|mongodb|snowflake|bigquery|oracle-database/i,
  /sftp|smtp|http|graphql|soap|webhook/i,
  /custom-code|code/i,
];

const APPROVAL_REQUIRED_PIECE_PATTERNS = [
  /gmail|slack|telegram|twilio|sendgrid|smtp|whatsapp|microsoft-teams/i,
  /docusign|pandadoc|sign-now|signrequest/i,
];

const AI_PIECE_PATTERNS = [
  /openai|anthropic|claude|gemini|bedrock|cohere|perplexity|replicate/i,
];

export function classifyActivepiecesPiecePolicy(
  pieceName: string,
): ActivepiecesSecurityPolicy {
  if (
    FORBIDDEN_PRODUCTION_PIECES.some((blocked) =>
      pieceName.toLowerCase().includes(blocked.toLowerCase()),
    )
  ) {
    return 'forbidden_in_production';
  }

  if (AI_PIECE_PATTERNS.some((pattern) => pattern.test(pieceName))) {
    return 'blocked_by_default';
  }

  if (ADMIN_ONLY_PIECE_PATTERNS.some((pattern) => pattern.test(pieceName))) {
    return 'advanced_only';
  }

  if (
    APPROVAL_REQUIRED_PIECE_PATTERNS.some((pattern) => pattern.test(pieceName))
  ) {
    return 'requires_human_approval';
  }

  return 'safe_with_workspace_policy';
}

export function classifyActivepiecesFeature(
  feature: Pick<
    ActivepiecesFeatureAdoption,
    'feature' | 'repoPaths' | 'license'
  >,
): ActivepiecesFeatureAdoption {
  if (feature.license === 'ee') {
    return {
      ...feature,
      adoptionMode: 'blocked_license',
      securityPolicy: 'requires_admin_role',
      notes: [
        'Use only through commercial Activepieces license or implement a LexFrame-native fallback.',
      ],
    };
  }

  if (feature.repoPaths.some((repoPath) => repoPath.includes('/pieces/'))) {
    return {
      ...feature,
      adoptionMode: 'library_import',
      securityPolicy: classifyActivepiecesPiecePolicy(feature.feature),
      notes: [
        'Import metadata into LexFrame catalog and enforce runtime policy.',
      ],
    };
  }

  if (feature.repoPaths.some((repoPath) => repoPath.includes('/builder/'))) {
    return {
      ...feature,
      adoptionMode: 'activepieces_embedded',
      securityPolicy: 'advanced_only',
      notes: [
        'Expose through embedded builder first; native parity can follow.',
      ],
    };
  }

  return {
    ...feature,
    adoptionMode: 'wrapper',
    securityPolicy: 'safe_with_workspace_policy',
    notes: [
      'Use LexFrame backend wrapper so canonical state stays in LexFrame.',
    ],
  };
}

export function assertNoPrivilegedFrontendSecrets(
  payload: unknown,
): ActivepiecesSecretBoundaryCheck {
  const blockedKeys = new Set<string>();
  visit(payload, (key) => {
    if (
      FRONTEND_FORBIDDEN_SECRET_KEYS.some(
        (blocked) => blocked.toLowerCase() === key.toLowerCase(),
      )
    ) {
      blockedKeys.add(key);
    }
  });

  return {
    safe: blockedKeys.size === 0,
    blockedKeys: [...blockedKeys].sort(),
    message:
      blockedKeys.size === 0
        ? 'No privileged frontend secret keys detected.'
        : 'Privileged Activepieces/LexFrame secrets must remain backend-only.',
  };
}

function visit(
  value: unknown,
  visitor: (key: string, current: unknown) => void,
  key = '',
): void {
  visitor(key, value);
  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, visitor);
    }
    return;
  }

  if (typeof value === 'object' && value !== null) {
    for (const [childKey, childValue] of Object.entries(value)) {
      visit(childValue, visitor, childKey);
    }
  }
}
