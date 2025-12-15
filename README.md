# Nexus Coder v2.2.0

**Enterprise AI Coding Assistant**

> SSO 인증 기반 사내 AI 코딩 어시스턴트
> Admin 대시보드를 통한 중앙집중식 모델 관리 및 사용량 모니터링

---

## Branch 구조

| Branch | 설명 |
|--------|------|
| `main` | 개인용 CLI (로컬 LLM 설정, SSO 없음) |
| `nexus-coder` | 엔터프라이즈 버전 (SSO 필수, Admin Server 연동) |

### main vs nexus-coder 차이점

| 기능 | main | nexus-coder |
|------|------|-------------|
| SSO 로그인 | 없음 | 필수 (자동) |
| 모델 소스 | 로컬 설정 파일 | Admin Server |
| 모델 추가/삭제 | 사용자가 직접 | Admin만 가능 |
| LLM 호출 경로 | 직접 LLM 서버 | Admin Server 프록시 |
| 사용량 추적 | 로컬만 | 서버 DB 기록 |

---

## Quick Start

### CLI 설치 (개인 사용자)

```bash
# 1. 저장소 클론
git clone https://github.com/anthropics/nexus-coder.git
cd nexus-coder
git checkout nexus-coder  # 엔터프라이즈 버전

# 2. 설치
npm install && npm run build

# 3. 전역 링크 (선택)
npm link

# 4. 실행 (첫 실행 시 자동 SSO 로그인)
nexus
```

**인증서 관련:**
- `cert/cert.cer` 파일이 레포에 포함되어 있습니다
- 사용자가 별도로 인증서를 배치할 필요 없습니다
- 첫 실행 시 자동으로 SSO 로그인 창이 열립니다

### Admin Server 배포

```bash
cd nexus-coder-admin
cp .env.example .env
# .env 파일 수정 (DB 비밀번호, JWT 시크릿 등)
docker-compose up -d
```

**기본 포트:**
| 서비스 | 포트 |
|--------|------|
| Admin Server (Nginx) | 4090 |
| PostgreSQL | 4091 |
| Redis | 4092 |

---

## Architecture

```bash
nexus              # 대화형 모드 시작
nexus --verbose    # 상세 로깅
nexus --debug      # 디버그 모드
```
┌─────────────────────────────────────────────────────────────────────┐
│                      NEXUS CODER ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────┐                ┌──────────────────────┐         │
│   │   Samsung    │◄──────────────►│   nexus (CLI Tool)   │         │
│   │  SSO Server  │   JWT Token    │                      │         │
│   └──────────────┘                └──────────┬───────────┘         │
│                                              │                     │
│                         API calls with Auth Headers                │
│                         (Authorization, X-User-Id,                 │
│                          X-User-Name, X-User-Dept)                 │
│                                              │                     │
│                                              ▼                     │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │               ADMIN SERVER (a2g.samsungds.net:4090)         │   │
│   │                                                             │   │
│   │  ┌─────────────────────────────────────────────────────┐   │   │
│   │  │                  Nginx (:4090)                       │   │   │
│   │  │  - /api/* → Express API                              │   │   │
│   │  │  - /v1/*  → LLM Proxy                                │   │   │
│   │  │  - /*     → React Dashboard                          │   │   │
│   │  └─────────────────────────────────────────────────────┘   │   │
│   │                          │                                  │   │
│   │           ┌──────────────┼──────────────┐                  │   │
│   │           ▼              ▼              ▼                  │   │
│   │  ┌─────────────┐  ┌───────────┐  ┌────────────┐           │   │
│   │  │   Express   │  │PostgreSQL │  │   Redis    │           │   │
│   │  │  API :3000  │  │   :4091   │  │   :4092    │           │   │
│   │  └──────┬──────┘  └───────────┘  └────────────┘           │   │
│   │         │                                                   │   │
│   │         │  LLM Proxy (/v1/chat/completions)                │   │
│   │         ▼                                                   │   │
│   │  ┌─────────────────────────────────────────────────────┐   │   │
│   │  │              Actual LLM Endpoints                    │   │   │
│   │  │  - OpenAI, Azure, Ollama, LiteLLM, etc.              │   │   │
│   │  │  - Managed by Admin via Dashboard                    │   │   │
│   │  └─────────────────────────────────────────────────────┘   │   │
│   │                                                             │   │
│   │  ┌─────────────────────────────────────────────────────┐   │   │
│   │  │           React Admin Dashboard (:8080)              │   │   │
│   │  │  - Model Management (CRUD)                           │   │   │
│   │  │  - User Management                                   │   │   │
│   │  │  - Usage Analytics (Real-time Graphs)                │   │   │
│   │  └─────────────────────────────────────────────────────┘   │   │
│   └────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## LLM Proxy Flow

CLI에서 LLM을 호출하면 Admin Server가 프록시 역할을 합니다:

```
CLI                    Admin Server              Actual LLM
 │                          │                        │
 │  POST /v1/chat/completions                        │
 │  + Auth Headers ──────►  │                        │
 │                          │  Validate User         │
 │                          │  Track Active User     │
 │                          │                        │
 │                          │  POST /chat/completions│
 │                          │  ─────────────────────►│
 │                          │                        │
 │                          │  ◄───── Response ──────│
 │                          │                        │
 │                          │  Record Usage to DB    │
 │                          │  (userId, modelId,     │
 │                          │   inputTokens,         │
 │                          │   outputTokens)        │
 │                          │                        │
 │  ◄────── Response ───────│                        │
 │                          │                        │
```

**기록되는 정보:**
- 사용자 ID, 이름, 부서
- 모델 ID
- Input/Output 토큰 수
- 요청 시간

---

## Features

### For Users (CLI)

- **SSO 로그인**: Samsung DS GenAI Portal SSO 연동
- **중앙집중식 모델**: Admin이 등록한 LLM 모델 사용
- **Plan & Execute**: 자동 작업 분해 및 순차 실행
- **Supervised Mode**: 파일 수정 전 승인 요청
- **Session 관리**: 대화 히스토리 저장/복원

### For Admins (Dashboard)

- **모델 관리**: LLM 엔드포인트 CRUD
- **사용자 관리**: 사용자 목록 및 상태 관리
- **사용량 분석**: 실시간 사용량 그래프
  - 일별/주별/월별 누적 그래프
  - 사용자별 사용량
  - 모델별 사용량
  - 부서별 사용량

---

## CLI Commands

```bash
nexus              # 대화형 모드 시작 (첫 실행 시 자동 SSO 로그인)
nexus --verbose    # Verbose 로깅
nexus --debug      # Debug 모드
```

**인증 방식:**
- 첫 실행 시 자동으로 브라우저에서 SSO 로그인
- 로그인 후 세션은 `~/.nexus-coder/auth.json`에 저장됨
- 세션 만료 시 자동으로 재로그인

### Slash Commands (대화형 모드 내)

| Command | Description |
|---------|-------------|
| `/help` | 도움말 표시 |
| `/clear` | 대화 초기화 |
| `/compact` | 대화 압축 (컨텍스트 절약) |
| `/model` | 모델 선택 |
| `/settings` | 설정 메뉴 |
| `/usage` | 토큰 사용량 통계 |
| `/load` | 저장된 세션 로드 |
| `/docs` | 문서 관리 |

### Keyboard Shortcuts

- `Ctrl+C` - 종료
- `ESC` - 현재 작업 중단
- `Tab` - Auto ↔ Supervised 모드 전환
- `@` - 파일 브라우저
- `/` - 명령어 자동완성

---

## 문제 해결

**사용자 데이터 (`~/.nexus-coder/`):**
```
~/.nexus-coder/
├── config.json        # 설정 파일 (모델 정보 등)
├── auth.json          # 인증 정보 (자동 저장)
├── docs/              # 다운로드된 문서
├── backups/           # 백업 파일
└── projects/          # 프로젝트별 세션
```

**레포지토리:**
```
nexus-coder/
├── cert/
│   └── cert.cer           # SSO 인증서 (번들됨)
├── src/
│   ├── cli.ts             # CLI 진입점
│   ├── core/
│   │   ├── auth/          # SSO 인증 모듈
│   │   ├── llm/           # LLM Client
│   │   ├── config/        # 설정 관리
│   │   └── nexus-setup.ts # Admin Server 모델 로드
│   └── ui/                # React/Ink UI
└── nexus-coder-admin/     # Admin Server
    ├── docker-compose.yml
    └── packages/
        ├── api/           # Express API + LLM Proxy
        └── dashboard/     # React Admin Dashboard
```

---

## Admin Server Setup

### Environment Variables

```env
# Database
POSTGRES_USER=nexuscoder
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=nexuscoder

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your-jwt-secret-change-in-production

# SSO
SSO_CERT_PATH=/app/cert/cert.cer

# Initial Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password
```

### Docker Compose

```bash
cd nexus-coder-admin
docker-compose up -d

# 로그 확인
docker-compose logs -f api

# 중지
docker-compose down

# 데이터 초기화 (주의!)
docker-compose down -v
```

### API Endpoints

**Public (CLI용):**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/models` | 활성 모델 목록 |
| POST | `/v1/chat/completions` | LLM 프록시 |
| GET | `/v1/health` | 헬스 체크 |

**Admin Only:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/models` | 모든 모델 (비활성 포함) |
| POST | `/admin/models` | 모델 생성 |
| PUT | `/admin/models/:id` | 모델 수정 |
| DELETE | `/admin/models/:id` | 모델 삭제 |
| GET | `/admin/stats/overview` | 대시보드 개요 |
| GET | `/admin/stats/daily` | 일별 사용량 |
| GET | `/admin/stats/by-user` | 사용자별 통계 |
| GET | `/admin/stats/by-model` | 모델별 통계 |

---

## Scaling Guide

### 현재 지원 규모
- 동시 사용자: ~100명
- 일일 요청: ~10,000건

### 스케일 아웃 (100명+ 동시 사용 시)

```yaml
# docker-compose.yml 수정
services:
  api:
    deploy:
      replicas: 3

  nginx:
    volumes:
      - ./nginx/nginx-lb.conf:/etc/nginx/nginx.conf:ro
```

```nginx
# nginx-lb.conf
upstream api {
    least_conn;
    server api:3000 weight=1;
    server api:3000 weight=1;
    server api:3000 weight=1;
}
```

### 대규모 사용 (1000명+)
Go/Rust 기반 API 서버 전환 권장

---

## Development

### CLI 개발

```bash
npm install
npm run build
npm run dev       # 개발 모드
```

### Admin Server 개발

```bash
# API 서버
cd nexus-coder-admin/packages/api
npm install
npx prisma migrate dev    # DB 마이그레이션
npm run dev               # API 서버 시작

# Dashboard
cd ../dashboard
npm install
npm run dev               # Dashboard 개발 서버
```

---

## Troubleshooting

### CLI에서 "Admin Server에서 모델을 가져올 수 없습니다"
- Admin Server가 실행 중인지 확인: `curl http://a2g.samsungds.net:4090/v1/health`
- 네트워크 연결 확인

### SSO 로그인 실패
- `cert/cert.cer` 파일 존재 확인
- 브라우저 팝업 차단 확인

### Dashboard 접속 불가
- `http://a2g.samsungds.net:4090` 접속
- Docker 컨테이너 상태 확인: `docker-compose ps`

---

## Requirements

- Node.js v20+
- npm v10+
- Docker & Docker Compose (Admin Server)

---

## License

Internal Use Only - Samsung DS

---

**Authors**: syngha.han, byeongju.lee, young87.kim
