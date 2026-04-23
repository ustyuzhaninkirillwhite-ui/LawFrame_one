FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/ai-gateway/package.json packages/ai-gateway/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/workflow/package.json packages/workflow/package.json
RUN corepack pnpm install --filter @lexframe/backend... --no-frozen-lockfile

COPY . .
RUN corepack pnpm --filter @lexframe/backend build

CMD ["node", "apps/backend/dist/main.js"]
