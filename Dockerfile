# ============================================================
# SHFF Dock — один образ: ядро на fastify раздаёт API и панель,
# а стеки поднимает через docker compose на сокете хоста.
# ============================================================

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# docker cli и плагин compose: панель поднимает стеки именно им, а не своей
# самодельной реализацией compose. Сам демон не ставится — используется хостовый
# через примонтированный сокет.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
  && chmod a+r /etc/apt/keyrings/docker.asc \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" \
     > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
  && apt-get purge -y gnupg \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=7788 \
    DOCK_DRIVER=docker \
    DOCK_ROOT=/home/dock \
    DOCK_PROC_ROOT=/host/proc \
    DOCK_SYS_ROOT=/host/sys \
    DOCK_ROOTFS=/host/rootfs \
    DOCK_WEB_DIST=/app/apps/web/dist

COPY package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

# Реестра стеков в образе нет — он приезжает из отдельного репозитория и
# кэшируется в /home/dock/registry. Поэтому каталог пополняется коммитом в
# реестр, а не пересборкой образа и переустановкой панели у всех.

EXPOSE 7788

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||7788)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/server.js"]
