FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3100
ARG NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=demo_publishable_key
ARG NEXT_PUBLIC_ACTIVEPIECES_INSTANCE_URL=http://localhost:8080
ARG NEXT_PUBLIC_ACTIVEPIECES_RUNTIME_URL=http://localhost:3100/automation-runtime
ARG NEXT_PUBLIC_ACTIVEPIECES_MVP_CANVAS_ENABLED=1
ARG NEXT_PUBLIC_LEXFRAME_CANVAS_RESERVE_ENABLED=0
ARG NEXT_PUBLIC_LEXFRAME_AP_DESIGN_SYSTEM_ENABLED=0
ARG NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL=/vendor/activepieces/embed-sdk-0.9.0.js
ARG NEXT_PUBLIC_POSTHOG_KEY=phc_stage_local
ARG NEXT_PUBLIC_CONTRACTS_VERSION=stage11
ARG NEXT_PUBLIC_ENABLE_MSW=0

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_ACTIVEPIECES_INSTANCE_URL=$NEXT_PUBLIC_ACTIVEPIECES_INSTANCE_URL
ENV NEXT_PUBLIC_ACTIVEPIECES_RUNTIME_URL=$NEXT_PUBLIC_ACTIVEPIECES_RUNTIME_URL
ENV NEXT_PUBLIC_ACTIVEPIECES_MVP_CANVAS_ENABLED=$NEXT_PUBLIC_ACTIVEPIECES_MVP_CANVAS_ENABLED
ENV NEXT_PUBLIC_LEXFRAME_CANVAS_RESERVE_ENABLED=$NEXT_PUBLIC_LEXFRAME_CANVAS_RESERVE_ENABLED
ENV NEXT_PUBLIC_LEXFRAME_AP_DESIGN_SYSTEM_ENABLED=$NEXT_PUBLIC_LEXFRAME_AP_DESIGN_SYSTEM_ENABLED
ENV NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL=$NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_CONTRACTS_VERSION=$NEXT_PUBLIC_CONTRACTS_VERSION
ENV NEXT_PUBLIC_ENABLE_MSW=$NEXT_PUBLIC_ENABLE_MSW

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/activepieces-bridge/package.json packages/activepieces-bridge/package.json
COPY packages/activepieces-catalog-sync/package.json packages/activepieces-catalog-sync/package.json
COPY packages/activepieces-inventory/package.json packages/activepieces-inventory/package.json
COPY packages/activepieces-legal-pieces/package.json packages/activepieces-legal-pieces/package.json
COPY packages/activepieces-template-ingestor/package.json packages/activepieces-template-ingestor/package.json
COPY packages/ai-gateway/package.json packages/ai-gateway/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/canvas-test-fixtures/package.json packages/canvas-test-fixtures/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/design-system-activepieces-bridge/package.json packages/design-system-activepieces-bridge/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/telemetry/package.json packages/telemetry/package.json
COPY packages/workflow/package.json packages/workflow/package.json
COPY packages/workflow-compiler/package.json packages/workflow-compiler/package.json
COPY packages/workflow-dsl/package.json packages/workflow-dsl/package.json
COPY tests/e2e/package.json tests/e2e/package.json
RUN corepack pnpm install --filter @lexframe/web... --frozen-lockfile

COPY . .
RUN corepack pnpm --filter @lexframe/web... --workspace-concurrency=1 run build

EXPOSE 3000
CMD ["corepack", "pnpm", "--filter", "@lexframe/web", "start"]
