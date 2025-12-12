# Nexus Coder Admin Server

Nexus Coder CLI를 위한 관리 서버 - 모델, 사용자, 사용량 통계 관리

## 목차
- [아키텍처](#아키텍처)
- [빠른 시작](#빠른-시작)
- [인증서 설정](#인증서-설정)
- [환경 변수](#환경-변수)
- [실행 방법](#실행-방법)
- [관리자 로그인](#관리자-로그인)
- [API 엔드포인트](#api-엔드포인트)
- [개발 환경](#개발-환경)

---

## 아키텍처

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

# 관리자 로그인 (Dashboard 접속용)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=aidivn
```

### 2단계: 인증서 설정

SSO JWT 검증을 위한 인증서 파일을 배치합니다:

```bash
# cert 디렉토리에 인증서 파일 복사
cp /path/to/your/cert.cer ./cert/cert.cer
```

**인증서 파일 위치:**
```
nexus-coder-admin/
├── cert/
│   └── cert.cer    ← 여기에 인증서 파일 배치
├── docker-compose.yml
└── ...
```

### 3단계: Docker Compose 실행

```bash
# 모든 서비스 빌드 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 서비스 상태 확인
docker-compose ps
```

### 4단계: 데이터베이스 마이그레이션

```bash
# 첫 실행 시 데이터베이스 스키마 생성
docker-compose exec api npx prisma migrate deploy
```

---

## 인증서 설정

### SSO 인증서 (cert.cer)

Samsung DS GenAI Portal SSO에서 발급하는 JWT 토큰 검증에 사용됩니다.

**파일 형식:**
- DER (.cer) 또는 PEM (.pem) 형식 모두 지원
- 시스템이 자동으로 형식을 감지하여 처리

**인증서 파일 위치:**
```
nexus-coder-admin/cert/cert.cer
```

**CLI 인증서는 레포에 번들됨:**
CLI 설치 시 `cert/cert.cer` 파일이 자동으로 포함됩니다.
사용자가 별도로 인증서를 배치할 필요가 없습니다.

---

## 환경 변수

### .env 파일 설정

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `POSTGRES_DB` | PostgreSQL 데이터베이스 이름 | `nexuscoder` |
| `POSTGRES_USER` | PostgreSQL 사용자명 | `nexuscoder` |
| `POSTGRES_PASSWORD` | PostgreSQL 비밀번호 | `nexuscoder123` |
| `JWT_SECRET` | JWT 서명 시크릿 | (필수 변경) |
| `ADMIN_USERNAME` | Dashboard 관리자 ID | `admin` |
| `ADMIN_PASSWORD` | Dashboard 관리자 비밀번호 | `aidivn` |
| `SSO_BASE_URL` | Samsung SSO 서버 URL | `https://genai.samsungds.net:36810` |

### 보안 권장사항

```bash
# 프로덕션 환경에서는 반드시 변경하세요
POSTGRES_PASSWORD=<강력한_비밀번호>
JWT_SECRET=<최소_32자_랜덤_문자열>
ADMIN_PASSWORD=<안전한_관리자_비밀번호>
```

---

## 실행 방법

### Docker Compose (권장)

```bash
# 서비스 시작
docker-compose up -d

# 서비스 중지
docker-compose down

# 로그 확인
docker-compose logs -f api
docker-compose logs -f dashboard

# 서비스 재시작
docker-compose restart api
```

### 접속 URL

| 서비스 | URL |
|--------|-----|
| **Admin Dashboard** | http://localhost:4090 |
| **API Server** | http://localhost:4090/api |
| **PostgreSQL** | localhost:5432 |
| **Redis** | localhost:6379 |

---

## 관리자 로그인

### Dashboard 접속

1. 브라우저에서 `http://localhost:4090` 접속
2. 로그인 화면에서 관리자 계정 입력:
   - **ID:** `admin` (또는 .env의 `ADMIN_USERNAME`)
   - **Password:** `aidivn` (또는 .env의 `ADMIN_PASSWORD`)

### 관리자 계정 변경

`.env` 파일에서 수정 후 서비스 재시작:

```bash
# .env 파일 수정
ADMIN_USERNAME=newadmin
ADMIN_PASSWORD=newpassword

# 서비스 재시작
docker-compose restart dashboard
```

### SSO 사용자 관리자 등록

SSO로 로그인한 사용자를 관리자로 등록하려면:

```bash
# PostgreSQL에 직접 추가
docker-compose exec postgres psql -U nexuscoder -d nexuscoder -c \
  "INSERT INTO admins (id, loginid, role) VALUES (gen_random_uuid(), 'user.loginid', 'ADMIN');"
```

**역할 종류:**
- `SUPER_ADMIN`: 모든 권한 (모델 삭제, 관리자 관리)
- `ADMIN`: 모델 생성/수정, 사용자 조회
- `VIEWER`: 읽기 전용

---

## API 엔드포인트

### 공개 API (CLI용)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/auth/callback` | SSO 콜백, 사용자 동기화 |
| `GET` | `/api/auth/me` | 현재 사용자 정보 |
| `GET` | `/api/models` | 활성화된 모델 목록 |
| `POST` | `/api/usage` | 사용량 기록 |

### 관리자 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/admin/models` | 모든 모델 (비활성 포함) |
| `POST` | `/api/admin/models` | 모델 생성 |
| `PUT` | `/api/admin/models/:id` | 모델 수정 |
| `DELETE` | `/api/admin/models/:id` | 모델 삭제 |
| `GET` | `/api/admin/users` | 사용자 목록 |
| `GET` | `/api/admin/stats/overview` | 대시보드 통계 |
| `GET` | `/api/admin/stats/daily-active-users` | 일별 활성 사용자 |
| `GET` | `/api/admin/stats/cumulative-users` | 누적 사용자 |
| `GET` | `/api/admin/stats/model-daily-trend` | 모델별 사용량 추이 |
| `GET` | `/api/admin/stats/model-user-trend` | 모델별 사용자 사용량 |

---

## 개발 환경

### API 서버 로컬 실행

```bash
cd packages/api

# 의존성 설치
npm install

# Prisma 클라이언트 생성
npx prisma generate

# 개발 서버 실행
npm run dev
```

### Dashboard 로컬 실행

```bash
cd packages/dashboard

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

### 데이터베이스 관리

```bash
# Prisma Studio (GUI)
cd packages/api
npx prisma studio

# 마이그레이션 생성
npx prisma migrate dev --name migration_name

# 마이그레이션 적용
npx prisma migrate deploy
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

### 데이터베이스 연결 오류

```bash
# PostgreSQL 상태 확인
docker-compose exec postgres pg_isready

# 데이터베이스 접속 테스트
docker-compose exec postgres psql -U nexuscoder -d nexuscoder
```

### 인증서 오류

인증서 파일이 올바른 위치에 있는지 확인:
```bash
ls -la cert/cert.cer
```

---

## 라이선스

Internal Use Only - Samsung DS
