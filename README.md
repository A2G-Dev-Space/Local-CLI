# Nexus Coder v2.2.0

**Enterprise AI Coding Assistant**

> SSO 인증 기반 사내 AI 코딩 어시스턴트
> Admin 대시보드를 통한 중앙집중식 모델 관리 및 사용량 모니터링

---

## 설치

### CLI 설치 (개인 사용자)

```bash
# 1. 설치
git clone https://github.com/your-org/nexus-coder.git
cd nexus-coder
npm install && npm run build

# 2. 전역 링크 (선택)
npm link

# 3. 로그인
ncli login

# 4. 실행
ncli
```

### Admin Server 배포

```bash
cd nexus-coder-admin
cp .env.example .env
# .env 파일 수정 (DB 비밀번호, JWT 시크릿 등)
docker-compose up -d
```

---

## Architecture

```bash
nexus              # 대화형 모드 시작
nexus --verbose    # 상세 로깅
nexus --debug      # 디버그 모드
```
┌─────────────────────────────────────────────────────────────────┐
│                     NEXUS CODER ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐              ┌──────────────────────┐       │
│   │   Samsung    │◄────────────►│    ncli (CLI Tool)   │       │
│   │  SSO Server  │  JWT Token   │                      │       │
│   └──────────────┘              └──────────┬───────────┘       │
│                                            │                   │
│                            API calls (Bearer token)            │
│                                            │                   │
│                                            ▼                   │
│   ┌────────────────────────────────────────────────────────┐   │
│   │              ADMIN SERVER (Docker Compose)              │   │
│   │  ┌─────────────┐    ┌─────────────┐    ┌────────────┐  │   │
│   │  │   Express   │    │  PostgreSQL │    │   Redis    │  │   │
│   │  │     API     │◄──►│     DB      │◄──►│   Cache    │  │   │
│   │  └─────────────┘    └─────────────┘    └────────────┘  │   │
│   │         │                                               │   │
│   │         ▼                                               │   │
│   │  ┌─────────────────────────────────────────────────┐   │   │
│   │  │           React Admin Dashboard                  │   │   │
│   │  │  - Model Management (CRUD)                       │   │   │
│   │  │  - User Management                               │   │   │
│   │  │  - Usage Analytics (Real-time Graphs)            │   │   │
│   │  └─────────────────────────────────────────────────┘   │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

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
ncli              # 대화형 모드 시작
ncli login        # SSO 로그인
ncli logout       # 로그아웃
ncli --verbose    # Verbose 로깅
ncli --debug      # Debug 모드
```

### Slash Commands (대화형 모드 내)

| Command | Description |
|---------|-------------|
| `/help` | 도움말 표시 |
| `/clear` | 대화 초기화 |
| `/compact` | 대화 압축 (컨텍스트 절약) |
| `/model` | 모델 선택 |
| `/settings` | 설정 메뉴 |
| `/usage` | 토큰 사용량 통계 |

### Keyboard Shortcuts

- `Ctrl+C` - 종료
- `ESC` - 현재 작업 중단
- `Tab` - Auto ↔ Supervised 모드 전환
- `@` - 파일 브라우저
- `/` - 명령어 자동완성

---

## 문제 해결

```
~/.nexus-coder/
├── config.json        # 설정 파일
├── auth.json          # 인증 정보
├── cert/              # SSO 인증서
│   └── cert.cer
├── docs/              # 다운로드된 문서
└── projects/          # 프로젝트별 세션
```

---

## Admin Server Setup

### Environment Variables

```env
# Database
POSTGRES_USER=nexus
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=nexus_coder
DATABASE_URL=postgresql://nexus:password@postgres:5432/nexus_coder

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your-jwt-secret

# SSO
SSO_BASE_URL=https://genai.samsungds.net:36810
SSO_CERT_PATH=/app/cert/cert.cer

# Server
PORT=4090
```

### Docker Compose

```bash
cd nexus-coder-admin
docker-compose up -d

# 로그 확인
docker-compose logs -f api

# 중지
docker-compose down
```

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
cd nexus-coder-admin/packages/api
npm install
npx prisma migrate dev    # DB 마이그레이션
npm run dev               # API 서버 시작

cd ../dashboard
npm install
npm run dev               # Dashboard 개발 서버
```

---

## 요구사항

- Node.js v20+
- npm v10+
- Docker & Docker Compose (Admin Server)

---

## License

Internal Use Only - Samsung DS

---

**Authors**: syngha.han, byeongju.lee, young87.kim
