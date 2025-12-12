# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# npm SSL 설정 (사내 네트워크)
RUN npm config set strict-ssl false

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build the app (use npx for tsc and vite)
RUN npx tsc && npx vite build

# Production stage - serve with nginx
FROM nginx:alpine AS production

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
