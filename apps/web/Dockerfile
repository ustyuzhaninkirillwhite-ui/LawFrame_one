FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ai-gateway/package.json packages/ai-gateway/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/workflow/package.json packages/workflow/package.json
RUN corepack pnpm install --filter @lexframe/web... --no-frozen-lockfile

COPY . .
RUN corepack pnpm --filter @lexframe/web build

CMD ["corepack", "pnpm", "--filter", "@lexframe/web", "start"]
