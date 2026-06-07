# Build stage: compile TypeScript, then prune to production deps
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build && npm ci --omit=dev

# Runtime stage: dist + production node_modules only
FROM node:24-alpine

ENV NODE_ENV=production

WORKDIR /app

# package.json must sit next to dist/ ("type": "module" drives ESM loading)
COPY --chown=node:node package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

CMD ["node", "dist/main.js"]
