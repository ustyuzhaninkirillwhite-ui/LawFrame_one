import { z } from "zod";

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3100),
  LEXFRAME_APP_BASE_URL: z.string().url().default("http://127.0.0.1:3000"),
  LEXFRAME_ENV_PROFILE: z.enum(["local", "ci", "production"]).default("local"),
  LEXFRAME_READINESS_PROFILE: z
    .enum(["local-basic", "local-integrated", "staging-rc", "production"])
    .default("local-basic"),
  LEXFRAME_DEPLOY_ENV: z.enum(["local", "preview", "staging", "production"]).default("local"),
  LEXFRAME_CONTRACTS_VERSION: z.string().min(1).default("stage11"),
  LEXFRAME_RELEASE_SHA: z.string().min(7).default("local-dev"),
  LEXFRAME_METRICS_ENABLED: z.enum(["0", "1"]).default("1"),
  LEXFRAME_HEALTHCHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  LEXFRAME_MINING_WORKER_HEALTH_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:8090/health/ready"),
  LEXFRAME_REQUIRE_MFA_FOR_ADMIN_ACTIONS: z.enum(["0", "1"]).default("0"),
  LEXFRAME_REQUIRE_REAUTH_FOR_ADMIN_ACTIONS: z.enum(["0", "1"]).default("1"),
  LEXFRAME_DEFAULT_SESSION_MAX_AGE_MINUTES: z.coerce.number().int().positive().default(720),
  LEXFRAME_DEFAULT_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(60),
  LEXFRAME_AI_SENSITIVE_DATA_POLICY: z
    .enum(["allow", "zdr_or_block", "private_only", "block"])
    .default("zdr_or_block"),
  LEXFRAME_AI_GATEWAY_ENABLED: z.enum(["0", "1", "false", "true"]).default("true"),
  LEXFRAME_AI_DEFAULT_PROVIDER: z
    .enum(["cometapi", "openai_compatible", "openai", "mock"])
    .default("cometapi"),
  LEXFRAME_AI_DEFAULT_MODEL: z.string().min(1).default("deepseek-v4-flash"),
  LEXFRAME_AI_DEFAULT_ROUTE: z.string().min(1).default("default_chat"),
  LEXFRAME_AI_DEFAULT_REASONING_MODE: z.string().min(1).default("non_thinking"),
  LEXFRAME_COMETAPI_BASE_URL: z
    .string()
    .url()
    .default("https://api.cometapi.com/v1"),
  LEXFRAME_COMETAPI_API_KEY_REF: z.string().min(1).default("owner_default_ai"),
  LEXFRAME_AI_AGENT_ROUTE: z.string().min(1).default("agent_general"),
  LEXFRAME_AI_RAG_SUMMARY_ROUTE: z.string().min(1).default("rag_legal_summary"),
  LEXFRAME_AI_AUTOMATION_PLANNER_ROUTE: z
    .string()
    .min(1)
    .default("automation_planner_high"),
  LEXFRAME_AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(90000),
  LEXFRAME_AI_RETRY_COUNT: z.coerce.number().int().min(0).default(1),
  LEXFRAME_STAGE18_LIVE_PROVIDER_SMOKE: z.enum(["0", "1"]).default("0"),
  AI_PROVIDER_MODE: z.enum(["mock", "controlled-real"]).default("mock"),
  LEXFRAME_DELIVERY_TRANSPORT: z
    .enum(["disabled", "webhook"])
    .default("disabled"),
  LEXFRAME_DELIVERY_WEBHOOK_URL: z.string().default(""),
  LEXFRAME_DELIVERY_WEBHOOK_TOKEN: z.string().default(""),
  LEXFRAME_DELIVERY_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  LEXFRAME_DELIVERY_FROM_EMAIL: z.string().min(3).default("noreply@lexframe.local"),
  LEXFRAME_SECRET_MANAGER_PROVIDER: z
    .enum(["env", "vault", "aws", "gcp", "doppler", "1password"])
    .default("env"),
  SUPABASE_URL: z.string().url().default("http://127.0.0.1:54321"),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(10).default("demo_publishable_key"),
  SUPABASE_SECRET_KEY: z.string().min(10).default("stage0_supabase_secret_key"),
  SUPABASE_DB_URL: z.string().min(10).default("postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
  ACTIVEPIECES_BASE_URL: z.string().url().default("http://127.0.0.1:8080"),
  ACTIVEPIECES_PUBLIC_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:3100/automation-runtime"),
  ACTIVEPIECES_REVERSE_PROXY_HEALTH_URL: z.string().url().default("http://127.0.0.1:3100/automation-runtime/api/v1/health"),
  ACTIVEPIECES_MVP_CANVAS_ENABLED: z.enum(["0", "1"]).default("1"),
  ACTIVEPIECES_CATALOG_MODE: z.enum(["max", "restricted"]).default("max"),
  ACTIVEPIECES_FORCE_RU_LOCALE: z.enum(["0", "1", "false", "true"]).default("true"),
  ACTIVEPIECES_BRAND_DISPLAY_NAME: z.string().min(1).default("Автоматизация"),
  ACTIVEPIECES_API_KEY_SECRET_REF: z.string().default(""),
  ACTIVEPIECES_API_KEY_FILE: z.string().default(""),
  ACTIVEPIECES_API_KEY: z.string().min(10).default("stage0_activepieces_api_key"),
  ACTIVEPIECES_SERVICE_EMAIL: z
    .string()
    .email()
    .default("lexframe-stage16@lexframe.test"),
  ACTIVEPIECES_SERVICE_PASSWORD: z
    .string()
    .min(12)
    .default("Stage16Activepieces!123"),
  ACTIVEPIECES_SIGNING_PRIVATE_KEY_SECRET_REF: z.string().default(""),
  ACTIVEPIECES_SIGNING_PRIVATE_KEY_FILE: z.string().default(""),
  ACTIVEPIECES_SIGNING_PRIVATE_KEY: z.string().min(10).default("stage0_signing_private_key"),
  ACTIVEPIECES_SIGNING_KEY_ID: z.string().min(3).default("lexframe-stage4"),
  ACTIVEPIECES_WORKER_TOKEN_SECRET_REF: z.string().default(""),
  ACTIVEPIECES_WORKER_HEALTH_URL: z.string().default(""),
  ACTIVEPIECES_WORKER_CACHE_MOUNT_PATH: z.string().default("/usr/src/app/cache"),
  ACTIVEPIECES_POSTGRES_HOST: z.string().default("127.0.0.1"),
  ACTIVEPIECES_POSTGRES_PORT: z.coerce.number().int().positive().default(54323),
  ACTIVEPIECES_POSTGRES_DATABASE: z.string().default("activepieces"),
  ACTIVEPIECES_POSTGRES_USERNAME: z.string().default("postgres"),
  ACTIVEPIECES_POSTGRES_PASSWORD: z.string().default(""),
  ACTIVEPIECES_POSTGRES_PASSWORD_FILE: z.string().default(""),
  ACTIVEPIECES_REDIS_HOST: z.string().default("127.0.0.1"),
  ACTIVEPIECES_REDIS_PORT: z.coerce.number().int().positive().default(6380),
  ACTIVEPIECES_REDIS_PASSWORD: z.string().default(""),
  ACTIVEPIECES_REDIS_PASSWORD_FILE: z.string().default(""),
  ACTIVEPIECES_REDIS_TYPE: z.enum(["STANDALONE", "SENTINEL"]).default("STANDALONE"),
  ACTIVEPIECES_NETWORK_MODE: z.string().default("STRICT"),
  ACTIVEPIECES_SSRF_ALLOW_LIST: z.string().default(""),
  ACTIVEPIECES_PROJECT_PREFIX: z.string().min(2).default("lf"),
  ACTIVEPIECES_SIMULATE_RUNS: z.enum(["0", "1"]).default("1"),
  LEXFRAME_RUNTIME_MASTER_SECRET: z.string().min(16).default("stage4_runtime_master_secret"),
  CONTAINER_REGISTRY: z.string().min(1).default("ghcr.io/example/lexframe"),
  XAI_API_KEY: z.string().min(10).default("stage0_xai_api_key"),
  COMETAPI_API_KEY: z.string().min(10).default("stage0_comet_api_key"),
  COMETAPI_API_KEYS: z.string().default(""),
  LEXFRAME_LOCAL_KEYS_FILE: z.string().default(""),
  LEXFRAME_LOCAL_KEYS_HOST_DIR: z.string().default(""),
  LEXFRAME_LOCAL_KEYS_DISABLED: z.enum(["true", "false"]).default("false"),
  LEXFRAME_STAGE17_READINESS_ENABLED: z.enum(["0", "1"]).default("0"),
  LEXFRAME_STAGE17_REQUIRE_WORKER_HEARTBEAT: z.enum(["0", "1"]).default("0"),
  LEXFRAME_STAGE17_REQUIRE_UX_ARTIFACTS: z.enum(["0", "1"]).default("0"),
  LEXFRAME_STAGE17_PIECES_PROFILE: z
    .enum(["stage17-production-allowlist", "stage17-local-all-open-source-pieces"])
    .default("stage17-production-allowlist"),
  LEXFRAME_STAGE17_I18N_ARTIFACT_PATH: z.string().default("docs/stage17/localization-coverage-report.md"),
  LEXFRAME_STAGE17_BRANDING_ARTIFACT_PATH: z.string().default("docs/stage17/debranding-coverage-report.md"),
  LEXFRAME_STAGE17_DESIGN_TOKENS_ARTIFACT_PATH: z.string().default("docs/stage17/17.1/activepieces-design-token-inventory.md"),
  LEXFRAME_AP_DESIGN_SYSTEM_ENABLED: z.enum(["0", "1"]).default("0"),
  LEXFRAME_AI_TEST_FORCE_COMETAPI: z.enum(["0", "1"]).default("0"),
  LEXFRAME_AI_TEST_MODEL: z.string().min(1).default("grok-4-1-fast-non-reasoning"),
  ACTIVEPIECES_SOURCE_DIR: z.string().default("E:\\activepieces-main"),
  OPENSEARCH_URL: z.string().url().default("http://127.0.0.1:9200"),
  OPENSEARCH_INDEX_ALIAS: z.string().min(3).default("legal_chunks_current"),
  OPENSEARCH_SEARCH_PIPELINE: z.string().min(3).default("legal-hybrid-pipeline"),
  TEMPORAL_ADDRESS: z.string().min(3).default("127.0.0.1:7233"),
  TEMPORAL_NAMESPACE: z.string().min(3).default("default"),
  TEMPORAL_TASK_QUEUE: z.string().min(3).default("lexframe-legal"),
  POSTHOG_KEY: z.string().min(10).default("stage0_posthog_key"),
  GRAFANA_BASE_URL: z.string().url().default("http://127.0.0.1:3001"),
  SENTRY_DSN: z.string().min(10).default("https://examplePublicKey@o0.ingest.sentry.io/0"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function loadServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  return serverEnvSchema.parse(source);
}
