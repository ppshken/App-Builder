# Debian/glibc is intentional: better-sqlite3 and Playwright Chromium need native libraries.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
COPY . .
ENV NODE_ENV=production NOCODE_DB_PATH=/tmp/build-only.db
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 \
    NOCODE_DB_PATH=/data/data.db PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    XDG_CACHE_HOME=/tmp/.cache XDG_CONFIG_HOME=/tmp/.config
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
RUN node node_modules/playwright/cli.js install --with-deps chromium && rm -rf /var/lib/apt/lists/* /root/.npm
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/app/fonts.css ./app/fonts.css
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY deploy/healthcheck.cjs deploy/setup-owner.cjs deploy/start-app.sh ./deploy/
RUN mkdir -p /data /app/.next/cache && chown -R node:node /data /app/.next/cache && chmod 0700 /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD ["node", "deploy/healthcheck.cjs"]
CMD ["sh", "deploy/start-app.sh"]
