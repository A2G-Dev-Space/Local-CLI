# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Local CLI** — OpenAI-compatible local CLI coding agent for offline enterprise environments. Works with any OpenAI-compatible API (vLLM, Ollama, LM Studio, Azure OpenAI, Google Gemini).

## Branding

| 항목 | 값 |
|------|-----|
| npm 패키지명 | `local-cli-agent` |
| CLI 바이너리 | `local-cli` |
| Electron 앱 이름 | `LOCAL BOT` |
| Electron appId | `com.local-bot.windows` |
| CLI 홈 디렉토리 | `~/.local-cli/` |
| Electron 데이터 경로 | `%APPDATA%\local-bot\` (Windows), `~/.local-bot/` (Linux) |
| Setup 파일명 | `LOCAL-BOT-Setup-{version}.exe` |

## Build, Test, and Lint Commands

```bash
# Build
npm run build          # inject-version.js + tsc
npm run watch          # Watch mode compilation
npm run dev            # ts-node development mode

# Test
npm run test           # Full pytest suite
npm run test:quick     # Skip slow tests

# Code Quality
npm run lint           # ESLint
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier
npm run prepr          # Pre-PR: lint + build

# Electron
npm run electron:dev       # Dev mode
npm run electron:build     # Build (dist-electron/)
npm run electron:package   # Windows NSIS installer

# Release
npm run release:npm    # build + npm publish
```

## Deployment

### CLI (npm)

```bash
# 1. 버전 bump
npm version patch --no-git-tag-version

# 2. 빌드 + 배포
npm run release:npm    # = npm run build && npm publish

# 3. 설치 확인
npm install -g local-cli-agent
local-cli --version
```

| 항목 | 값 |
|------|-----|
| npm | `npm install -g local-cli-agent` |
| 실행 | `local-cli` |
| 레지스트리 | https://www.npmjs.com/package/local-cli-agent |

### Electron (GitHub Release)

```bash
# 1. Electron vite 빌드 (WSL에서)
npm run electron:build

# 2. Windows 경로로 복사
rsync -av --delete --exclude='node_modules' --exclude='.git' --exclude='release' \
  ~/Project/Hanseol\(local-cli-git\)/ /mnt/c/temp/local-bot-build/

# 3. Windows에서 NSIS 빌드
cmd.exe /c "cd /d C:\\temp\\local-bot-build && npm install && npx electron-builder --win nsis"
# → release/LOCAL-BOT-Setup-{version}.exe 생성

# 4. GitHub Release에 업로드 (Setup.exe + latest.yml for auto-update)
gh release create v{version} \
  "release/LOCAL-BOT-Setup-{version}.exe" \
  "release/latest.yml" \
  --title "v{version}" --notes "Release v{version}"
```

> **Setup.exe와 latest.yml은 반드시 GitHub Release에 함께 업로드.** `bin/` 디렉토리에 바이너리를 넣지 않는다.

### 버전 관리

- **매 배포 시 반드시 버전 bump.** 같은 버전 재배포 금지.
- `npm run build`가 `inject-version.js`를 자동 실행 → `constants.ts` APP_VERSION 동기화
- 빌드 후 검증: `grep APP_VERSION dist/constants.js` — package.json 버전과 일치해야 함

### Auto-Update

- **CLI**: npm registry에서 최신 버전 확인 → `npm update -g local-cli-agent`
- **Electron**: GitHub Release의 `latest.yml`에서 확인 → NSIS 자동 업데이트
  - `electron-updater`가 `A2G-Dev-Space/Local-CLI` GitHub Release에서 `latest.yml` 확인
  - 앱 시작 5초 후 + 4시간마다 자동 체크
  - 새 버전 발견 시 사용자에게 알림 → 승인 후 다운로드/설치
  - **Release 업로드 시 `latest.yml` 반드시 포함** (electron-builder가 자동 생성)

## Electron Build Notes

- `npm run electron:package`는 WSL에서 wine 오류 발생하지만, app.asar는 오류 전에 생성됨. wine 오류는 무시.
- `npx asar pack`으로 수동 패키징 **절대 금지** — node_modules 의존성 누락됨
- WSL에서 Electron 실행 시 반드시 `powershell.exe -Command "Start-Process ..."` 사용

## Architecture

### Plan & Execute Pattern

```
User Input → Planning LLM (generates TODOs) → Plan Executor → Per-task Agent → Tool Execution → Result
```

Key files:
- `src/orchestration/plan-executor.ts` - Core execution logic (React-independent)
- `src/agents/planner/` - TODO list generation
- `src/ui/components/PlanExecuteApp.tsx` - Main interactive UI

### Tool System (6 Categories)

Registered in `src/tools/registry.ts`:

| Category | Description |
|----------|-------------|
| LLM Simple | Called via tool_calls, no sub-LLM (file ops, bash) |
| LLM Agent | Called via tool_calls, uses sub-LLM (docs search) |
| System Simple | Auto-triggered by logic, no sub-LLM |
| System Agent | Auto-triggered by logic, uses sub-LLM |
| User Commands | Slash commands (/help, /settings, etc.) |
| MCP Tools | Model Context Protocol tools |

### Configuration

- CLI Home: `~/.local-cli/`
- CLI Config: `~/.local-cli/config.json`
- Electron Data: `%APPDATA%\local-bot\` (Windows)

## Adding New Tools

1. Create in `src/tools/` under appropriate subdirectory
2. Export: `name`, `description`, `parameters`, `execute`
3. Register in `src/tools/registry.ts`
4. Set `requiresApproval: true` for file modification tools

## Debugging

CLI flags: `--verbose`, `--debug`, `--llm-log`, `--eval`

## ⚠️ Cherry-pick 시 주의사항

**이 저장소는 오픈소스(A2G-Dev-Space/Local-CLI)입니다.**

Hanseol(main/main-dev)에서 cherry-pick할 때 반드시 확인:
- 외부 서비스 도구(ONCE_TOOLS, FREE_TOOLS 등) import/registration 추가 금지
- Dashboard URL, ONCE_URL, FREE_URL, CREDENTIALS_FILE_PATH 등 enterprise 상수 추가 금지
- OAuth 로그인, Dashboard 인증, credentials.json 관련 코드 추가 금지
- `hanseol`, `한설`, `nexus-coder` 등 enterprise 브랜딩 유입 금지
- PROD/DEV IP(3.39.170.84, 52.78.246.50) 노출 금지

### Cherry-pick 시 브랜딩 유지 파일

| 파일 | 유지할 값 (Local CLI / LOCAL BOT) |
|------|--------------------|
| `package.json` | `name: local-cli-agent`, `bin: { local-cli }`, `productName: LOCAL BOT` |
| `src/constants.ts` | `APP_NAME: local-cli`, `LOCAL_HOME_DIR: .local-cli` |
| `electron/main/constants.ts` | `LOCAL_HOME_DIR: .local-cli` |
| `electron/main/index.ts` | `setAppUserModelId('com.local-bot.windows')` |
| Electron 파일들 | `local-bot`, `.local-bot` (NOT `LOCAL-CLI-UI`, `.local-cli-ui`) |

## Platform Notes

- **WSL2**: Browser and Office tools work via network mirroring to Windows host
- **Windows**: Office tools use COM automation (requires installed Office)
- **Browser tools**: Require Chrome or Edge installed

## LLM Provider System (local-cli-git 전용)

**이 기능은 local-cli-git에만 존재합니다.** Hanseol(main/main-dev/nexus-coder)에는 없습니다.

Dashboard를 경유하는 main/main-dev는 Dashboard proxy가 provider별 비호환 파라미터를 제거해주지만,
local-cli-git은 직접 LLM API를 호출하므로 클라이언트 측에서 provider별 파라미터를 조정해야 합니다.

### 구현 파일

| 파일 | 역할 |
|------|------|
| `src/core/llm/providers.ts` | Provider 타입/설정 정의 (CLI) |
| `electron/main/core/llm/providers.ts` | Provider 타입/설정 정의 (Electron, 동일 내용) |
| `src/core/llm/llm-client.ts` | Provider 기반 파라미터 필터링 (CLI) |
| `electron/main/core/llm/llm-client.ts` | Provider 기반 파라미터 필터링 (Electron) |
| `src/ui/components/dialogs/SettingsDialog.tsx` | CLI TUI에서 provider 선택 |
| `electron/renderer/src/components/Settings.tsx` | Electron GUI에서 provider 드롭다운 |

### Provider별 호환성

| Provider | `parallel_tool_calls` | `tool_choice: 'required'` |
|----------|----------------------|--------------------------|
| OpenAI | ✅ | ✅ |
| Anthropic | ✅ | ✅ |
| x.ai (Grok) | ✅ | ✅ |
| Gemini | ❌ | ✅ |
| DeepSeek | ❌ | ✅ |
| Qwen | ✅ | ❌ (auto로 대체) |
| Z.AI (GLM) | ❌ | ❌ (auto로 대체) |
| Ollama | ❌ | ❌ |
| LM Studio | ❌ | ❌ |
| Other | ❌ | ❌ (안전한 기본값) |

### main/main-dev와의 차이점

| 항목 | local-cli-git | main/main-dev |
|------|---------------|---------------|
| LLM 호출 | **직접 API 호출** | Dashboard proxy 경유 |
| `X-Service-Id` 헤더 | **없음** (v5.0.6에서 제거) | Dashboard 인증에 필요 |
| `SERVICE_ID` 상수 | **없음** (v5.0.6에서 제거) | `constants.ts`에 존재 |
| Provider 선택 | **사용자가 endpoint 등록시 선택** | 불필요 (Dashboard가 처리) |
| 파라미터 필터링 | **클라이언트(llm-client.ts)에서 처리** | Dashboard proxy에서 처리 |
| `providers.ts` | **존재** | 없음 |

### cherry-pick 시 주의

main/main-dev → local-cli-git cherry-pick 시:
- `llm-client.ts`의 `X-Service-Id` 헤더가 다시 들어오지 않도록 주의
- `constants.ts`의 `SERVICE_ID` 상수가 다시 들어오지 않도록 주의
- Provider 관련 import/로직이 유지되는지 확인

## Key Patterns

- Single tool execution per LLM invocation (enforced)
- Prompts centralized in `src/prompts/` (no scattered prompts)
- Plan executor is React-independent for testability
- TypeScript strict mode with ESM modules
- Path alias: `@/*` → `src/*`
