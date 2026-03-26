FROM node:20-slim

WORKDIR /app

COPY web/api/package*.json ./
RUN npm ci --production

COPY web/api/dist/ ./dist/
COPY web/api/prisma/ ./prisma/
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
