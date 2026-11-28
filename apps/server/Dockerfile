FROM oven/bun:1 AS builder
WORKDIR /app

COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --ignore-scripts
RUN cd apps/server && bun run build

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/server/.env.schema ./apps/server/.env.schema
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/packages ./packages

EXPOSE 3000
WORKDIR /app/apps/server
CMD ["bun", "run", "dist/index.mjs"]
