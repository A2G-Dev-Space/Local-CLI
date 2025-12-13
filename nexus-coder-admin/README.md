# Nexus Coder Admin Server

Admin server for managing Nexus Coder CLI - models, users, and usage statistics.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Docker Compose Stack                    │
│                                                          │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐ │
│  │  Nginx  │──►│   API   │──►│Postgres │   │  Redis  │ │
│  │  :4090  │   │  :3000  │   │  :5432  │   │  :6379  │ │
│  │         │   └─────────┘   └─────────┘   └─────────┘ │
│  │         │                                            │
│  │         │   ┌───────────────────────┐               │
│  │         │──►│  React Dashboard      │               │
│  │         │   │  :8080                │               │
│  └─────────┘   └───────────────────────┘               │
└──────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Setup Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 2. Add SSO Certificate

Place your SSO certificate in `./cert/cert.cer`

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Initialize Database

```bash
docker-compose exec api npx prisma migrate deploy
```

### 5. Create Initial Super Admin

```bash
docker-compose exec api npx ts-node scripts/create-admin.ts --loginid your.loginid --role SUPER_ADMIN
```

## Access Points

- **Admin Dashboard**: http://localhost:4090
- **API**: http://localhost:4090/api

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| POSTGRES_DB | Database name | nexuscoder |
| POSTGRES_USER | Database user | nexuscoder |
| POSTGRES_PASSWORD | Database password | nexuscoder123 |
| JWT_SECRET | JWT signing secret | (required) |
| SSO_BASE_URL | Samsung SSO server URL | https://genai.samsungds.net:36810 |

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

## API Endpoints

### Public (for CLI)
- `POST /api/auth/callback` - SSO callback
- `GET /api/auth/me` - Current user info
- `GET /api/models` - List enabled models
- `POST /api/usage` - Report usage

### Admin
- `GET /api/admin/models` - All models
- `POST /api/admin/models` - Create model
- `PUT /api/admin/models/:id` - Update model
- `DELETE /api/admin/models/:id` - Delete model
- `GET /api/admin/users` - List users
- `GET /api/admin/stats/*` - Usage statistics
