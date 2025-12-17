# Nexus Coder v2.6.1

**Enterprise AI Coding Assistant**

> SSO 인증 기반 사내 AI 코딩 어시스턴트
> Node.js 설치 없이 단일 바이너리로 실행 가능

---

## Quick Start (바이너리 설치)

**Node.js, npm 설치 불필요** - 바이너리만 다운로드하여 바로 사용

### 1. 바이너리 다운로드

```bash
# 바이너리 다운로드 (관리자에게 요청 또는 공유 폴더에서 복사)
cp /path/to/nexus ~/nexus
chmod +x ~/nexus
```

### 2. 첫 실행 (자동 설치)

```bash
./nexus
```

첫 실행 시 자동으로:
- GitHub에서 최신 버전 클론
- `~/.local/bin/`에 바이너리 설치
- `~/.bashrc` 또는 `~/.zshrc`에 PATH 추가
- SSO 로그인 진행

### 3. 설치 완료 후

```bash
# 셸 설정 리로드
source ~/.bashrc   # 또는 source ~/.zshrc

# 이후부터는 어디서든 실행 가능
nexus
```

### 자동 업데이트

`nexus` 실행 시 자동으로 최신 버전을 확인하고 업데이트합니다.
업데이트 후에는 안내 메시지에 따라 셸을 리로드하세요.

```
Update complete! Run: source ~/.bashrc && nexus
```

---

## 설치 위치

| 항목 | 경로 |
|------|------|
| 바이너리 | `~/.local/bin/nexus` |
| 설정 파일 | `~/.nexus-coder/config.json` |
| 인증 정보 | `~/.nexus-coder/auth.json` |
| 소스 저장소 | `~/.nexus-coder/repo/` |

---

## 사용법

### 기본 실행

```bash
nexus              # 대화형 모드 시작
nexus --verbose    # 상세 로깅
nexus --debug      # 디버그 모드
```

### Slash Commands (대화형 모드 내)

| Command | Description |
|---------|-------------|
| `/help` | 도움말 표시 |
| `/clear` | 대화 초기화 |
| `/compact` | 대화 압축 (컨텍스트 절약) |
| `/load` | 저장된 세션 불러오기 |
| `/model` | LLM 모델 전환 |
| `/settings` | 설정 메뉴 |
| `/usage` | 토큰 사용량 통계 |
| `/docs` | 문서 관리 |

### 키보드 단축키

| 키 | 기능 |
|----|------|
| `Ctrl+C` | 종료 |
| `ESC` | 현재 작업 중단 |
| `Tab` | Auto ↔ Supervised 모드 전환 |
| `@` | 파일 브라우저 |
| `/` | 명령어 자동완성 |

---

## Features

- **SSO 로그인**: Samsung DS GenAI Portal SSO 연동
- **중앙집중식 모델**: Admin이 등록한 LLM 모델 사용
- **Plan & Execute**: 자동 작업 분해 및 순차 실행
- **Supervised Mode**: 파일 수정 전 승인 요청
- **Session 관리**: 대화 히스토리 저장/복원
- **자동 업데이트**: 실행 시 최신 버전 자동 적용

---

## Troubleshooting

### "command not found: nexus"

PATH가 설정되지 않은 경우:

```bash
# 셸 설정 리로드
source ~/.bashrc   # bash 사용자
source ~/.zshrc    # zsh 사용자

# 또는 직접 실행
~/.local/bin/nexus
```

### SSO 로그인 실패

- 브라우저 팝업 차단 확인
- 네트워크 연결 상태 확인
- VPN 연결 여부 확인

### "Admin Server에서 모델을 가져올 수 없습니다"

- 사내 네트워크 연결 확인
- Admin Server 상태 확인: `curl http://a2g.samsungds.net:4090/v1/health`

### 업데이트 실패

수동으로 재설치:

```bash
rm -rf ~/.nexus-coder/repo
nexus
```

---

## 시스템 요구사항

- **OS**: Linux (x64)
- **네트워크**: 사내망 접속 가능
- **기타**: Node.js 설치 불필요

---

## 개발자용 설치 (npm)

Node.js 환경에서 직접 개발하려는 경우:

```bash
# 저장소 클론
git clone https://github.com/A2G-Dev-Space/Local-CLI.git
cd Local-CLI
git checkout nexus-coder

# 설치 및 빌드
npm install && npm run build

# 전역 링크
npm link

# 실행
nexus
```

### 바이너리 빌드 (관리자용)

```bash
# Bun 컴파일 + gzip 압축
npm run bun:build
gzip -c bin/nexus > bin/nexus.gz

# 배포 파일
# - bin/nexus.gz (39MB)
# - bin/yoga.wasm (87KB)
```

---

## Architecture

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
│   └────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Release Notes

### v2.6.1

| Feature | Description |
|---------|-------------|
| **바이너리 배포** | Node.js 없이 독립 실행 가능 |
| **자동 업데이트** | Git 기반 자동 버전 관리 |
| **PATH 자동 설정** | ~/.local/bin 자동 등록 |
| **Planning-Only Mode** | 모든 요청에 TODO 기반 계획 모드 적용 |

### v2.5.x

| Feature | Description |
|---------|-------------|
| **--eval mode** | Python 자동화 테스트용 (stdin JSON → stdout NDJSON) |
| **SSO 인증** | Samsung DS GenAI Portal SSO 연동 |
| **Admin Server 연동** | 중앙집중식 모델 관리 |

---

## License

Internal Use Only - Samsung DS

---

**Authors**: syngha.han, byeongju.lee, young87.kim
