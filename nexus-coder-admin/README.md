# Nexus Coder Admin Server

Nexus Coder CLI를 위한 Admin 서버입니다. LLM 모델 관리, 사용자 관리, 사용량 통계를 제공합니다.

## 설치 및 배포

### 1. 환경 설정

```bash
# 저장소 클론
git clone https://github.com/A2G-Dev-Space/Local-CLI.git
cd Local-CLI/nexus-coder-admin

# 환경변수 설정
cp .env.example .env
```

`.env` 파일 수정:
```env
POSTGRES_DB=nexuscoder
POSTGRES_USER=nexuscoder
POSTGRES_PASSWORD=your-secure-password

JWT_SECRET=your-jwt-secret-change-in-production

ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password
```

### 2. SSO 인증서 설정

SSO 인증서를 `./cert/cert.cer` 경로에 배치합니다.

```bash
mkdir -p cert
cp /path/to/your/cert.cer ./cert/
```

### 3. Docker Compose 실행

```bash
# 빌드 및 실행
docker compose up -d --build

# 로그 확인
docker compose logs -f
```

### 4. 데이터베이스 초기화

```bash
docker compose exec api npx prisma db push
```

### 5. 접속 확인

- **Admin Dashboard**: http://your-server:4090
- **API Endpoint**: http://your-server:4090/api

기본 관리자 계정: `.env`에 설정한 `ADMIN_USERNAME` / `ADMIN_PASSWORD`

## 서비스 관리

```bash
# 시작
docker compose up -d

# 중지
docker compose down

# 재시작
docker compose restart

# 로그 확인
docker compose logs -f api

# 재빌드 (코드 변경 후)
docker compose up -d --build
```

## 포트 정보

| 서비스 | 내부 포트 | 외부 포트 |
|--------|----------|----------|
| Nginx (프록시) | 4090 | 4090 |
| PostgreSQL | 5432 | 4091 |
| Redis | 6379 | 4092 |

## 사내 네트워크 설정

사내 네트워크에서 프록시 문제가 있을 경우 `docker-compose.yml`의 프록시 설정을 확인하세요:

```yaml
x-proxy-env: &proxy-env
  HTTP_PROXY: ""
  HTTPS_PROXY: ""
  NO_PROXY: "localhost,127.0.0.1,.samsungds.net,postgres,redis,api,dashboard,nginx"
```
