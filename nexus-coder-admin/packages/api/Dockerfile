# Build stage
FROM node:20-alpine AS builder

# Install OpenSSL for Prisma (skip SSL verification for corporate network)
RUN echo "http://dl-cdn.alpinelinux.org/alpine/v3.18/main" > /etc/apk/repositories && \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.18/community" >> /etc/apk/repositories && \
    apk add --no-cache --allow-untrusted openssl1.1-compat

WORKDIR /app

# SSL 인증서 검증 비활성화 (사내 네트워크)
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN npm config set strict-ssl false

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npx tsc

# Production stage
FROM node:20-alpine AS production

# Install OpenSSL 1.1 for Prisma (skip SSL verification for corporate network)
RUN echo "http://dl-cdn.alpinelinux.org/alpine/v3.18/main" > /etc/apk/repositories && \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.18/community" >> /etc/apk/repositories && \
    apk add --no-cache --allow-untrusted openssl1.1-compat

WORKDIR /app

# Copy node_modules from builder (includes all dependencies)
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema
COPY --from=builder /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy package.json for reference
COPY package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
