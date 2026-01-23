# AI Services Dashboard

Multi-service admin dashboard for managing AI services - models, users, usage statistics, and more.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                         │
│                                                                 │
│   ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐      │
│   │  Nginx  │──►│   API    │──►│Postgres │   │  Redis  │      │
│   │ :${PORT}│   │  :3000   │   │  :5432  │   │  :6379  │      │
│   │         │   └──────────┘   └─────────┘   └─────────┘      │
│   │         │                                                  │
│   │  /      │──► Dashboard (React SPA)                        │
│   │  /api/* │──► API Server                                    │
│   │  /docs  │──► VitePress Static Docs                        │
│   └─────────┘                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Features

- **Multi-Service Support**: Manage multiple AI services from a single dashboard
- **Global Statistics**: View aggregated stats across all services
- **Service-Specific Views**: Drill down into individual service metrics
- **Department Analytics**: Usage statistics by department (사업부)
- **User Management**: Service-specific admin roles (SUPER_ADMIN, ADMIN, VIEWER)
- **Model Management**: Configure LLM endpoints per service
- **Feedback System**: Collect user feedback per service

## Quick Start

### 1. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration (see .env.example for all options)
nano .env
```

### 2. Add SSO Certificate

```bash
# Place your SSO certificate
mkdir -p ./cert
cp /path/to/your/cert.cer ./cert/
```

### 3. Build and Start Services

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f
```

### 4. Initialize Database

```bash
# Run database migrations
docker-compose exec api npx prisma migrate deploy

# Run multi-service migration script (first time only)
docker-compose exec api npx ts-node scripts/migrate-to-multi-service.ts
```

### 5. Create Initial Admin

```bash
# Create super admin
docker-compose exec api npx ts-node scripts/create-admin.ts \
  --loginid your.loginid --role SUPER_ADMIN
```

## Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | http://localhost:4090 | Admin dashboard |
| API | http://localhost:4090/api | REST API |
| Docs | http://localhost:4090/docs | Documentation |
| PostgreSQL | localhost:4091 | Database (debug) |
| Redis | localhost:4092 | Cache (debug) |

## Configuration

### Key Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PROXY_PORT` | Main proxy port | 4090 |
| `POSTGRES_PORT` | PostgreSQL external port | 4091 |
| `REDIS_PORT` | Redis external port | 4092 |
| `POSTGRES_DB` | Database name | nexuscoder |
| `POSTGRES_USER` | Database user | nexuscoder |
| `POSTGRES_PASSWORD` | Database password | nexuscoder123 |
| `JWT_SECRET` | JWT signing secret | (required) |
| `DEVELOPERS` | Super admin list (comma-separated) | syngha.han |
| `DEFAULT_SERVICE_ID` | Default service ID | nexus-coder |

See `.env.example` for complete configuration options.

## Project Structure

```
Dashboard/
├── packages/
│   ├── api/                    # Express.js API Server
│   │   ├── src/
│   │   │   ├── routes/         # API routes
│   │   │   ├── middleware/     # Auth, logging, etc.
│   │   │   └── index.ts        # Entry point
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   └── scripts/            # Migration scripts
│   │
│   └── dashboard/              # React Dashboard
│       ├── src/
│       │   ├── pages/          # Page components
│       │   ├── components/     # Reusable components
│       │   └── services/       # API client
│       └── public/
│
├── docs-site/                  # VitePress Documentation
│   └── docs/
│       ├── guide/              # User guides
│       ├── demos/              # Demo examples
│       └── .vitepress/         # VitePress config
│
├── nginx/                      # Nginx configuration
├── cert/                       # SSL certificates
├── docker-compose.yml          # Docker orchestration
└── .env.example                # Environment template
```

## API Endpoints

### Public Endpoints (for CLI clients)

```
POST /api/auth/callback         # SSO callback
GET  /api/auth/me               # Current user info
GET  /api/models                # List enabled models
POST /api/usage                 # Report usage
GET  /api/my-usage/*            # Personal usage stats
POST /api/feedback              # Submit feedback
```

### Admin Endpoints

```
# Services
GET    /api/services            # List services
POST   /api/services            # Create service
PUT    /api/services/:id        # Update service
DELETE /api/services/:id        # Delete service

# Models (supports ?serviceId=)
GET    /api/admin/models        # List models
POST   /api/admin/models        # Create model
PUT    /api/admin/models/:id    # Update model
DELETE /api/admin/models/:id    # Delete model

# Users (supports ?serviceId=)
GET    /api/admin/users         # List users
POST   /api/admin/users/:id/promote    # Promote user
DELETE /api/admin/users/:id/demote     # Demote user

# Statistics (supports ?serviceId=)
GET    /api/admin/stats/overview       # Overview stats
GET    /api/admin/stats/daily-usage    # Daily usage
GET    /api/admin/stats/model-daily-trend  # Model trends

# Global Statistics
GET    /api/admin/stats/global/overview    # All services overview
GET    /api/admin/stats/global/by-service  # Per-service breakdown
GET    /api/admin/stats/global/by-dept     # Per-department breakdown
```

## Migration from Existing Repo

### Step 1: Clone New Repository

```bash
git clone git@github.com:A2G-Dev-Space/Dashboard.git
cd Dashboard
```

### Step 2: Copy Project Files

```bash
# Copy packages
cp -r /path/to/nexus-coder-admin/packages .

# Copy docs-site
cp -r /path/to/docs-site .

# Copy configuration files
cp /path/to/nexus-coder-admin/.env.example .
cp /path/to/nexus-coder-admin/docker-compose.yml .
cp -r /path/to/nexus-coder-admin/nginx .
cp -r /path/to/nexus-coder-admin/cert .
```

### Step 3: Apply Production Stash

If you have stashed changes on the production server:

```bash
# On production server: Export stash as patch
cd /path/to/production/nexus-coder-admin
git stash show -p stash@{0} > /tmp/production-changes.patch

# Copy patch to new location
scp user@production:/tmp/production-changes.patch ./

# Apply patch to new repository
cd /path/to/new/Dashboard
patch -p1 < production-changes.patch

# If paths differ, manually adjust:
# - Old: nexus-coder-admin/packages/...
# - New: packages/...
# Use: patch -p2 instead of -p1
```

### Step 4: Setup Environment

```bash
# Copy production .env
scp user@production:/path/to/.env ./.env

# Or create from template
cp .env.example .env
nano .env
```

### Step 5: Database Migration

```bash
# Start services
docker-compose up -d

# Run migrations
docker-compose exec api npx prisma migrate deploy

# Run multi-service migration (if not already done)
docker-compose exec api npx ts-node scripts/migrate-to-multi-service.ts
```

## Adding a New Service

### 1. Create Service via API

```bash
curl -X POST http://localhost:4090/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "new-service",
    "displayName": "New Service",
    "description": "Description of the new service"
  }'
```

### 2. Add Service Documentation (Optional)

```bash
# Create service documentation directory
mkdir -p docs-site/docs/new-service/guide

# Create index page
cat > docs-site/docs/new-service/index.md << 'EOF'
# New Service

Welcome to New Service documentation.

## Getting Started

[Guide](/new-service/guide/getting-started)
EOF
```

### 3. Update VitePress Config

Edit `docs-site/docs/.vitepress/config.mts`:

```typescript
const services = [
  {
    id: 'nexus-coder',
    name: 'Nexus Coder',
    // ... existing
  },
  {
    id: 'new-service',
    name: 'New Service',
    description: 'Another AI Service',
    basePath: '/new-service',
    icon: '🔧'
  }
]
```

### 4. Add Models for the Service

```bash
curl -X POST http://localhost:4090/api/admin/models \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "gpt-4",
    "displayName": "GPT-4",
    "endpointUrl": "https://api.openai.com/v1/chat/completions",
    "maxTokens": 128000,
    "serviceId": "SERVICE_UUID_HERE"
  }'
```

## Development

### API Server

```bash
cd packages/api
npm install
npm run dev
```

### Dashboard

```bash
cd packages/dashboard
npm install
npm run dev
```

### Documentation Site

```bash
cd docs-site
npm install
npm run dev
```

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Connect directly
docker-compose exec postgres psql -U nexuscoder -d nexuscoder
```

### API Not Responding

```bash
# Check API container
docker-compose logs api

# Restart API
docker-compose restart api
```

### Migration Script Fails

```bash
# Run with verbose logging
docker-compose exec api DEBUG=* npx ts-node scripts/migrate-to-multi-service.ts

# Check if service already exists
docker-compose exec api npx prisma studio
```

## License

Internal Use Only - Samsung DS
