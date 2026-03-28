# Hanseol Web Session Container
# Built from project root: docker build -f web/session/Dockerfile -t hanseol-web-session .

FROM node:20-slim

# Install system dependencies + Chromium from Debian repos (avoids Playwright installer issues)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl wget ca-certificates procps lsof fuser chromium \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Create workspace directory (user's isolated environment)
RUN mkdir -p /workspace/.hanseol-web && chown -R node:node /workspace

WORKDIR /app

# Copy built session engine (built with tsc before docker build)
COPY web/session/dist/ ./dist/
COPY web/session/package.json ./

# Copy shared node_modules (session engine dependencies)
# In production, use a separate npm install step
COPY package.json /tmp/root-package.json
RUN npm install --omit=dev --prefix /app ws \
    && rm /tmp/root-package.json

USER node
WORKDIR /workspace

ENV NODE_ENV=production
ENV SESSION_WS_PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD node -e "const ws=new (require('ws'))(\"ws://localhost:${SESSION_WS_PORT}\");ws.on('open',()=>{ws.close();process.exit(0)});ws.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),2000)"

CMD ["node", "/app/dist/session-server.js"]
