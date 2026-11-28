FROM node:24-slim AS base
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

# Install workspace dependencies (skip varlock postinstall for apps/web & apps/server)
COPY package.json bun.lock bunfig.toml tsconfig.json turbo.json ./
COPY apps/scheduler/package.json apps/scheduler/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/poller/package.json packages/poller/package.json

RUN bun install --ignore-scripts

# Copy scheduler and shared pure packages
COPY packages/config packages/config
COPY packages/db packages/db
COPY packages/poller packages/poller
COPY apps/scheduler apps/scheduler

# Install Chromium and OS dependencies required by Playwright
RUN cd apps/scheduler && bun x playwright install chromium --with-deps

ENV NODE_ENV=production
ENV PLAYWRIGHT_HEADLESS=true

WORKDIR /app/apps/scheduler
CMD ["bun", "run", "start"]
