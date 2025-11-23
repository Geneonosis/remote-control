FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# === RUNTIME IMAGE ===
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# copy only the built output and minimal files
COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Environment variables:
# PORT - port to listen on (default: 3000)
# GOOGLE_CLIENT_ID - Google OAuth Client ID
# AGENT_TOKENT_DESKTOP_1 - Token for desktop agent 1
EXPOSE 3001

CMD ["node", "dist/server.js"]