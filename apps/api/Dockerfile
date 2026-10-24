FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/core/package.json packages/core/package.json
RUN npm ci --omit=dev --workspace @axon/api --no-audit --no-fund
COPY apps/api/src apps/api/src
COPY packages/core/src packages/core/src
USER node
EXPOSE 3000
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]
