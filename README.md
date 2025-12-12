# Nexus Coder v2.1.2

**Enterprise AI Coding Assistant**

> SSO 인증 기반 사내 AI 코딩 어시스턴트

---

## 설치

```bash
# 1. 저장소 클론
git clone https://github.com/A2G-Dev-Space/Local-CLI.git
cd Local-CLI
git checkout nexus-coder

# 2. 의존성 설치 및 빌드
npm install && npm run build

# 3. 전역 설치
npm link

# 4. 실행
nexus
```

첫 실행 시 자동으로 브라우저에서 SSO 로그인 창이 열립니다.

---

## 사용법

```bash
nexus              # 대화형 모드 시작
nexus --verbose    # 상세 로깅
nexus --debug      # 디버그 모드
```

### Slash Commands

| Command | 설명 |
|---------|------|
| `/help` | 도움말 |
| `/clear` | 대화 초기화 |
| `/compact` | 대화 압축 (컨텍스트 절약) |
| `/model` | 모델 선택 |
| `/settings` | 설정 |
| `/usage` | 토큰 사용량 |
| `/load` | 저장된 세션 로드 |
| `/docs` | 문서 관리 |

### 단축키

| 키 | 기능 |
|----|------|
| `Ctrl+C` | 종료 |
| `ESC` | 현재 작업 중단 |
| `Tab` | Auto ↔ Supervised 모드 전환 |
| `@` | 파일 브라우저 |
| `/` | 명령어 자동완성 |

---

## 주요 기능

- **SSO 로그인**: Samsung DS GenAI Portal SSO 연동
- **중앙집중식 모델**: Admin이 등록한 LLM 모델 사용
- **Plan & Execute**: 작업 자동 분해 및 순차 실행
- **Supervised Mode**: 파일 수정 전 승인 요청
- **Session 관리**: 대화 히스토리 저장/복원

---

## 사용자 데이터

```
~/.nexus-coder/
├── config.json    # 설정 파일
├── auth.json      # 인증 정보 (자동 저장)
├── docs/          # 다운로드된 문서
├── backups/       # 백업 파일
└── projects/      # 프로젝트별 세션
```

---

## 문제 해결

### "Admin Server에서 모델을 가져올 수 없습니다"
- 네트워크 연결 확인
- Admin 담당자에게 서버 상태 문의

### SSO 로그인 실패
- 브라우저 팝업 차단 확인
- 다시 `nexus` 실행

### 세션 만료
- 자동으로 재로그인 요청됨
- 안되면 `~/.nexus-coder/auth.json` 삭제 후 재시도

---

## 요구사항

- Node.js v20+
- npm v10+

---

## License

Internal Use Only - Samsung DS

---

**Authors**: syngha.han, byeongju.lee, young87.kim
