FROM node:20-alpine AS base
WORKDIR /app

# ─── Install deps ─────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev

# ─── Build ────────────────────────────────────
FROM base AS builder
COPY package.json package-lock.json ./
COPY apps/api/ apps/api/
COPY packages/ packages/
RUN npm ci --ignore-scripts 2>/dev/null || npm install
RUN cd apps/api && npx prisma generate && npx nest build

# ─── Production ───────────────────────────────
FROM base AS runner

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY apps/api/package.json ./

ENV NODE_ENV=production
ENV API_PORT=4000
EXPOSE 4000

CMD ["node", "dist/main.js"]
