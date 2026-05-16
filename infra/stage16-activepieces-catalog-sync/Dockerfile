FROM activepieces/activepieces:0.44.0 AS activepieces-source

FROM node:22-alpine AS sync
WORKDIR /app
RUN apk add --no-cache postgresql-client && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/activepieces-catalog-sync/package.json packages/activepieces-catalog-sync/package.json
COPY packages/activepieces-inventory/package.json packages/activepieces-inventory/package.json
RUN corepack pnpm install --filter @lexframe/activepieces-catalog-sync... --frozen-lockfile

COPY packages/activepieces-catalog-sync packages/activepieces-catalog-sync
COPY packages/activepieces-inventory packages/activepieces-inventory
COPY --from=activepieces-source /usr/src/app/packages/pieces /activepieces/packages/pieces

RUN corepack pnpm --filter @lexframe/activepieces-catalog-sync... --workspace-concurrency=1 run build

ENTRYPOINT []
CMD ["node", "packages/activepieces-catalog-sync/dist/cli.js", "--repo-root", "/activepieces", "--apply"]
