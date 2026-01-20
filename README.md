# LOCAL-CLI

[![GitHub release](https://img.shields.io/github/v/release/A2G-Dev-Space/Local-CLI)](https://github.com/A2G-Dev-Space/Local-CLI/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)

**OpenAI-Compatible CLI Coding Agent**

> 로컬/사내 LLM 환경에서 바로 사용할 수 있는 개발자용 코딩 에이전트입니다.  
> vLLM, Ollama, LM Studio 등 OpenAI 호환 API를 지원합니다.

https://github.com/user-attachments/assets/77cc96c9-cb22-4411-8744-3a006b00c580

---

## 이 툴로 할 수 있는 것

- **코드 읽기/검색/수정/생성**: 파일 단위로 안전하게 수정합니다.
- **Plan & Execute**: 작업을 TODO로 분해하고 단계적으로 실행합니다.
- **Supervised Mode**: 파일 변경 전 사용자 승인 기반 작업.
- **브라우저 자동화**: Chrome/Edge CDP 제어(탭 이동, 클릭, 스크린샷 등).
- **Office 자동화**: PowerShell/COM 기반 Excel/Word/PowerPoint 제어.
- **세션 관리**: 대화 및 작업 히스토리 저장/복원.
- **자동 재시도/에러 복구**: 도구 호출 실패 시 자동 재시도.

---

## Quick Start

```bash
# 1. Install
git clone https://github.com/A2G-Dev-Space/Local-CLI.git
cd Local-CLI
npm install && npm run build

# 2. Run
node dist/cli.js       # 또는 npm link 후 'lcli'
```

첫 실행 시 LLM 엔드포인트 설정 마법사가 자동으로 열립니다.

---

## 주요 기능 하이라이트

### Supervised Mode
파일 수정 도구 실행 전에 승인 요청:

```
┌─────────────────────────────────────────────────────────────┐
│  🔧 edit_file                                                │
│  ─────────────────────────────────────────────────────────   │
│  📁 file_path: /src/utils/helper.ts                          │
│  📝 diff: + added lines ...                                  │
│  ─────────────────────────────────────────────────────────   │
│  ▸ [1] ✅ Approve                                            │
│    [2] ❌ Reject                                             │
└─────────────────────────────────────────────────────────────┘
```

- **Tab**: Auto ↔ Supervised 모드 전환
- **파일 수정 도구만** 승인 필요
- **Reject** 시 피드백을 반영해 재시도

### Plan & Execute
요청을 TODO로 분해해 순차 실행:

```
You: 로깅 시스템 추가해줘

┌────────────────────────────────────────────────┐
│ 📋 TODO List                            1/3    │
│ ████████░░░░░░░░░░░░░░░░░ 33%                  │
│ ├─ ☑ logger.ts 생성                          │
│ ├─ ⣾ 기존 코드에 import 추가                 │
│ └─ ☐ 에러 핸들링 적용                         │
└────────────────────────────────────────────────┘
```

### 최신 자동화 확장
- **브라우저 자동화**: PowerShell/Chrome CDP 기반, 별도 서버 없음
- **Office 자동화**: PowerShell/COM 기반, Excel/Word/PowerPoint 직접 제어

---

## 명령어 & 단축키

### Slash Commands
| Command | 설명 |
|---------|------|
| `/help` | 도움말 |
| `/clear` | 대화 초기화 |
| `/compact` | 대화 압축 |
| `/load` | 세션 불러오기 |
| `/model` | 모델 전환 |
| `/settings` | 설정 메뉴 |
| `/usage` | 토큰 사용량 |
| `/docs` | 문서 관리 |
| `/tool` | 선택 기능 토글 (browser/office) |

### Keyboard Shortcuts
- `Ctrl+C` 종료
- `ESC` 작업 중단
- `Tab` Auto ↔ Supervised
- `@` 파일 브라우저
- `/` 명령어 자동완성

---

## Configuration

```bash
lcli            # 최초 실행 시 설정 마법사
/settings       # 실행 중 설정 메뉴
```

OpenAI 호환 API라면 대부분 연결 가능합니다:
vLLM, Ollama, LM Studio, Azure OpenAI, 사내 LLM 서버 등.

---

## Requirements

- Node.js v20+
- npm v10+
- Git (문서/리포 사용 시)

---

## 문의
  
Email: **gkstdmgk2731@naver.com**

---

## Documentation

- [Developer Guide](docs/01_DEVELOPMENT.md)
- [Logging System](docs/02_LOGGING.md)
- [Testing Guide](docs/03_TESTING.md)
- [Roadmap](docs/04_ROADMAP.md)

---

## License

MIT License

---

**GitHub**: https://github.com/A2G-Dev-Space/Local-CLI
