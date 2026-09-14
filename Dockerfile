# syntax=docker/dockerfile:1

FROM node:26-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run db:generate
RUN npm run build

FROM node:26-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4175 \
    LOG_LEVEL=info

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server ./server
COPY --from=build /app/server/generated ./server/generated
COPY shared ./shared

RUN mkdir -p /app/data/documents && chown -R node:node /app
USER node

EXPOSE 4175

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4175/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "server"]
