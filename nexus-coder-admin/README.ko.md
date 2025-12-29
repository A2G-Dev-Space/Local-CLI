# Nexus Coder Admin Server

Nexus Coder CLI를 위한 관리 서버 - 모델, 사용자, 사용량 통계, 피드백 관리

## 목차
- [아키텍처](#아키텍처)
- [빠른 시작](#빠른-시작)
- [인증서 설정](#인증서-설정)
- [환경 변수](#환경-변수)
- [실행 방법](#실행-방법)
- [관리자 설정](#관리자-설정)
- [문서 사이트](#문서-사이트)
- [API 엔드포인트](#api-엔드포인트)
- [개발 환경](#개발-환경)

---

## 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│                  Docker Compose Stack                         │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Nginx (:4090)                         │ │
│  │  /        → Dashboard (React)                           │ │
│  │  /api     → API Server (Express)                        │ │
│  │  /docs    → VitePress 문서                              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐              │
│         ▼                  ▼                  ▼              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐        │
│  │  PostgreSQL │   │    Redis    │   │   VitePress │        │
│  │    :5432    │   │    :6379    │   │    (정적)   │        │
│  └─────────────┘   └─────────────┘   └─────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

---

## 빠른 시작

### 1단계: 환경 변수 설정

```bash
cd nexus-coder-admin
cp .env.example .env
```

`.env` 파일을 열고 필요한 값을 설정하세요:

```bash
# 데이터베이스 설정
POSTGRES_DB=nexuscoder
POSTGRES_USER=nexuscoder
POSTGRES_PASSWORD=your_secure_password

# 보안 설정
JWT_SECRET=your_jwt_secret_change_in_production

# 개발자 계정 (SUPER_ADMIN 권한)
DEVELOPERS=user1.id,user2.id
```

### 2단계: 인증서 설정

SSO JWT 검증을 위한 인증서 파일을 배치합니다:

```bash
# cert 디렉토리에 인증서 파일 복사
cp /path/to/your/cert.cer ./cert/cert.cer
```

### 3단계: 문서 빌드 (VitePress)

```bash
cd ../docs-site
npm install
npm run build
```

### 4단계: Docker Compose 실행

```bash
cd ../nexus-coder-admin

# 모든 서비스 빌드 및 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f

# 서비스 상태 확인
docker-compose ps
```

> **참고:** API 컨테이너가 시작될 때 자동으로 `prisma db push`가 실행되어 DB 스키마가 적용됩니다.

---

## 인증서 설정

### SSO 인증서 (cert.cer)

Samsung DS GenAI Portal SSO에서 발급하는 JWT 토큰 검증에 사용됩니다.

**파일 위치:**
```
nexus-coder-admin/cert/cert.cer
```

---

## 환경 변수

### .env 파일 설정

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `POSTGRES_DB` | PostgreSQL 데이터베이스 이름 | `nexuscoder` |
| `POSTGRES_USER` | PostgreSQL 사용자명 | `nexuscoder` |
| `POSTGRES_PASSWORD` | PostgreSQL 비밀번호 | `nexuscoder123` |
| `JWT_SECRET` | JWT 서명 시크릿 | (필수 변경) |
| `DEVELOPERS` | SUPER_ADMIN 권한 사용자 ID (쉼표 구분) | - |

---

## 실행 방법

### Docker Compose (권장)

```bash
# 서비스 시작
docker-compose up -d

# 서비스 재빌드 및 시작
docker-compose up -d --build

# 서비스 중지
docker-compose down

# 로그 확인
docker-compose logs -f api
docker-compose logs -f dashboard

# 특정 서비스 재시작
docker-compose restart api
docker-compose up -d --build dashboard
```

### 접속 URL

| 서비스 | URL |
|--------|-----|
| **Portal (Dashboard)** | http://서버주소:4090 |
| **API Server** | http://서버주소:4090/api |
| **문서 사이트** | http://서버주소:4090/docs |
| **PostgreSQL** | 서버주소:4091 |
| **Redis** | 서버주소:4092 |

---

## 관리자 설정

### 역할 종류

| 역할 | 설명 | 권한 |
|------|------|------|
| **SUPER_ADMIN** | 개발자 | 모든 권한 (환경변수 `DEVELOPERS`에 설정) |
| **ADMIN** | 관리자 | 모델 관리, 사용자 조회, 피드백 답변 |
| **VIEWER** | 뷰어 | 읽기 전용 (대시보드 조회만) |
| 일반 사용자 | - | 내 사용량 조회, 피드백 작성 |

### 개발자 등록 (SUPER_ADMIN)

`.env` 파일에서 `DEVELOPERS` 변수에 로그인 ID 추가:

```bash
DEVELOPERS=user1.loginid,user2.loginid
```

서비스 재시작:
```bash
docker-compose restart api
```

### 관리자 등록 (ADMIN/VIEWER)

Dashboard에서 SUPER_ADMIN이 사용자 목록에서 권한 부여 가능.

또는 DB에 직접 추가:
```bash
docker-compose exec postgres psql -U nexuscoder -d nexuscoder -c \
  "INSERT INTO admins (id, loginid, role) VALUES (gen_random_uuid(), 'user.loginid', 'ADMIN');"
```

---

## 문서 사이트

### 빌드

```bash
cd docs-site
npm install
npm run build
```

빌드 결과물: `docs-site/.vitepress/dist/`

### Docker Compose에서 마운트

`docker-compose.yml`의 nginx 서비스에서 문서 디렉토리 마운트:
```yaml
volumes:
  - ../docs-site/.vitepress/dist:/var/www/docs:ro
```

### 문서에 이미지/영상 추가

상세 가이드는 아래 [이미지/영상 추가 가이드](#이미지영상-추가-가이드) 참조.

---

## API 엔드포인트

### 공개 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/models` | 활성화된 모델 목록 |
| `POST` | `/api/auth/login` | SSO 로그인 |
| `GET` | `/api/auth/check` | 세션 확인 |

### 사용자 API (로그인 필요)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/my-usage/summary` | 내 사용량 요약 |
| `GET` | `/api/my-usage/daily` | 내 일별 사용량 |
| `GET` | `/api/my-usage/by-model` | 내 모델별 사용량 |
| `GET` | `/api/feedback` | 피드백 목록 |
| `POST` | `/api/feedback` | 피드백 작성 |

### 관리자 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/admin/models` | 모든 모델 (비활성 포함) |
| `POST` | `/api/admin/models` | 모델 생성 |
| `PUT` | `/api/admin/models/:id` | 모델 수정 |
| `DELETE` | `/api/admin/models/:id` | 모델 삭제 |
| `GET` | `/api/admin/users` | 사용자 목록 |
| `GET` | `/api/admin/stats/overview` | 대시보드 통계 |
| `POST` | `/api/feedback/:id/respond` | 피드백 답변 |

---

## 개발 환경

### API 서버 로컬 실행

```bash
cd packages/api
npm install
npx prisma generate
npm run dev
```

### Dashboard 로컬 실행

```bash
cd packages/dashboard
npm install
npm run dev
```

### 문서 사이트 로컬 실행

```bash
cd docs-site
npm install
npm run dev
```

---

## 문제 해결

### 서비스가 시작되지 않을 때

```bash
# 로그 확인
docker-compose logs api
docker-compose logs postgres

# 컨테이너 재빌드
docker-compose build --no-cache
docker-compose up -d
```

### 테이블이 없다는 오류

API 컨테이너가 시작 시 자동으로 마이그레이션을 실행합니다.
수동 실행이 필요한 경우:

```bash
docker exec -it nexus-coder-api npx prisma db push
```

### 인증서 오류

```bash
ls -la cert/cert.cer
```

---

## 이미지/영상 추가 가이드

### 파일 위치

```
docs-site/docs/public/
├── images/       ← 이미지 파일
├── screenshots/  ← 스크린샷
└── videos/       ← 영상 파일
```

### 이미지 추가

1. 이미지 파일을 `docs-site/docs/public/images/`에 복사
2. Markdown에서 사용:

```markdown
![이미지 설명](/images/파일명.png)
```

### 영상 추가

1. 영상 파일(mp4)을 `docs-site/docs/public/videos/`에 복사
2. Markdown에서 사용:

```markdown
<video controls width="100%">
  <source src="/videos/파일명.mp4" type="video/mp4">
</video>
```

### 예시: demos/index.md

```markdown
# Demos

## 기본 사용법

기본적인 CLI 사용 방법을 확인하세요.

<video controls width="100%">
  <source src="/videos/basic-usage.mp4" type="video/mp4">
</video>

## 스크린샷

![메인 화면](/screenshots/main-screen.png)
```

### 빌드 및 반영

```bash
cd docs-site
npm run build

# 서버에서
docker-compose restart nginx
```

---

## 라이선스

Internal Use Only - Samsung DS
