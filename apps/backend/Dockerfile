FROM node:22-alpine AS base
ENTRYPOINT []
WORKDIR /app
RUN corepack enable

ENV NODE_ENV=production
ENV PORT=3100

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
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/telemetry/package.json packages/telemetry/package.json
COPY packages/workflow/package.json packages/workflow/package.json
COPY packages/workflow-compiler/package.json packages/workflow-compiler/package.json
COPY packages/workflow-dsl/package.json packages/workflow-dsl/package.json
RUN corepack pnpm install --filter @lexframe/backend... --frozen-lockfile

COPY . .
RUN corepack pnpm --filter @lexframe/backend... --workspace-concurrency=1 run build

EXPOSE 3100
CMD ["node", "apps/backend/dist/main.js"]
