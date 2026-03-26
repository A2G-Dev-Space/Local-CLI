# Branch Customization Guide for Hanseol Web

## main-dev (DEV) — hanseol-web
Base branch. All changes start here.

| File | Key | Value |
|------|-----|-------|
| `web/docker/.env` | `DASHBOARD_URL` | `https://52.78.246.50.nip.io` |
| `web/docker/.env` | `ADMIN_EMAILS` | `gkstmdgk2731@naver.com` |
| `web/docker/.env` | `ENV_LABEL` | `DEV` |
| `web/docker/.env` | `PROXY_PORT` | `7090` |
| `web/session/constants.ts` | `APP_NAME` | `hanseol-web` |
| `web/session/constants.ts` | `SERVICE_ID` | `hanseol-web` |
| `web/session/constants.ts` | `DASHBOARD_URL` fallback | `https://52.78.246.50.nip.io` |
| `web/frontend/src/i18n/ko.json` | `app.name` | `Hanseol Web` |

## main (PROD) — hanseol-web
Cherry-pick from main-dev, change URLs to PROD.

| File | Key | Value |
|------|-----|-------|
| `web/docker/.env` | `DASHBOARD_URL` | `https://3.39.170.84.nip.io` |
| `web/docker/.env` | `ADMIN_EMAILS` | `gkstmdgk2731@naver.com` |
| `web/docker/.env` | `ENV_LABEL` | (empty — no label for PROD) |
| `web/session/constants.ts` | `DASHBOARD_URL` fallback | `https://3.39.170.84.nip.io` |
| `web/session/constants.ts` | `ONCE_URL` fallback | `https://3.39.170.84.nip.io:5090` |
| `web/session/constants.ts` | `FREE_URL` fallback | `https://3.39.170.84.nip.io:6090` |

## nexus-coder — nexus-web
Major customization. SSO auth, org chart integration, no landing page.

### Branding changes
| File | Key | Value |
|------|-----|-------|
| `web/session/constants.ts` | `APP_NAME` | `nexus-web` |
| `web/session/constants.ts` | `SERVICE_ID` | `nexus-web` |
| `web/session/constants.ts` | `DASHBOARD_URL` fallback | Agent-Dashboard internal URL |
| `web/frontend/src/i18n/ko.json` | `app.name` | `Nexus Web` |
| `web/docker/.env` | `DASHBOARD_URL` | Agent-Dashboard internal URL |
| `web/docker/.env` | `ADMIN_EMAILS` | `syngha.han` |

### SSO Authentication (replaces Dashboard OAuth)
| File | Change |
|------|--------|
| `web/api/src/routes/auth.routes.ts` | Replace Dashboard OAuth with Knox SSO flow |
| `web/api/src/middleware/auth.ts` | Validate SSO token instead of Dashboard JWT |
| `web/api/prisma/schema.prisma` | Add `dept` field auto-populated from SSO |

### Org Chart Integration (Agent-Dashboard API)
| File | Change |
|------|--------|
| `web/api/src/services/org.service.ts` | NEW: Fetch org tree from Agent-Dashboard `/internal/org/*` |
| `web/api/src/routes/agent.routes.ts` | Add ORG_SCOPED visibility validation using org service |
| `web/api/src/routes/admin.routes.ts` | Add dept-based filtering for admin views |
| `web/frontend/src/pages/AgentBuilder.tsx` | Add org scope selector (dept tree picker) |
| `web/frontend/src/pages/admin/Users.tsx` | Add dept column + dept filter |

### No Landing Page
| File | Change |
|------|--------|
| `web/frontend/src/App.tsx` | Change `/` route: `<Navigate to="/sessions" />` or `<Navigate to="/login" />` |
| `web/frontend/src/pages/Landing.tsx` | Can be deleted or kept (not used) |

## local-cli-git — local-web
Stripped-down self-hosted version. No auth, no admin, no sharing.

### Remove auth
| File | Change |
|------|--------|
| `web/api/src/middleware/auth.ts` | `requireAuth` becomes no-op (always passes) |
| `web/api/src/routes/auth.routes.ts` | Remove OAuth flow, add simple local user |
| `web/frontend/src/App.tsx` | Remove `ProtectedRoute`, all routes public |
| `web/frontend/src/stores/auth.store.ts` | Auto-login as local user |

### Remove admin
| File | Change |
|------|--------|
| `web/frontend/src/App.tsx` | Remove all `/admin/*` routes |
| `web/frontend/src/components/Layout.tsx` | Remove admin nav items |

### Remove agent sharing
| File | Change |
|------|--------|
| `web/frontend/src/App.tsx` | Remove `/marketplace` route |
| `web/frontend/src/components/Layout.tsx` | Remove marketplace nav item |
| `web/api/src/routes/agent.routes.ts` | Remove marketplace endpoint |
| `web/api/prisma/schema.prisma` | Remove AgentVisibility.PUBLIC/ORG_SCOPED |

### Self-hosted LLM config
| File | Change |
|------|--------|
| `web/frontend/src/pages/Settings.tsx` | NEW: LLM endpoint/model config page |
| `web/api/src/routes/config.routes.ts` | NEW: Save/load LLM endpoint config |
| `web/session/constants.ts` | Remove DASHBOARD_URL dependency |

### Docker one-command setup
| File | Change |
|------|--------|
| `web/docker/docker-compose.yml` | Remove dashboard dependency |
| `web/docker/.env.example` | Remove DASHBOARD_URL, add LLM_ENDPOINT_URL |
