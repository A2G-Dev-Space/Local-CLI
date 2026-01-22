# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Local-CLI is an OpenAI-compatible local CLI coding agent for offline enterprise environments. It works with any OpenAI-compatible API (vLLM, Ollama, LM Studio, Azure OpenAI, Google Gemini).

## Build, Test, and Lint Commands

```bash
# Build
npm run build          # Compile TypeScript
npm run watch          # Watch mode compilation
npm run dev            # Run with ts-node (development)
npm run start          # Run compiled dist/cli.js

# Test
npm run test           # Full pytest suite (tests/test_eval.py)
npm run test:quick     # Quick tests (skip slow tests)

# Code Quality
npm run lint           # Run ESLint on src/**/*.ts
npm run lint:fix       # Auto-fix ESLint issues
npm run format         # Format with Prettier
npm run prepr          # Pre-PR check: lint + build

# Electron (optional desktop app)
npm run electron:dev   # Electron development mode
npm run electron:build # Build Electron app
npm run electron:package # Package for Windows (creates app.asar)
```

## Electron Build & Deploy (IMPORTANT)

**빌드 후 Windows 배포 시 반드시 확인:**

1. `npm run electron:build` - renderer/main/preload 빌드 (dist-electron/)
2. `npm run electron:package` - app.asar 생성 (release/win-unpacked/resources/)
3. `cp release/win-unpacked/resources/app.asar /mnt/c/LOCAL-CLI/resources/` - Windows에 배포

**주의사항:**
- `electron:build`만 실행하면 app.asar가 업데이트되지 않음
- Windows의 app.asar 파일 시간을 확인해서 최신 빌드인지 반드시 검증
- CSS 변경이 반영 안되면 app.asar 배포 여부 먼저 확인
- **IMPORTANT**: `npm run electron:package`는 WSL에서 wine 오류가 발생하지만, app.asar는 오류 전에 이미 생성됨. wine 오류는 서명 단계에서 발생하므로 무시해도 됨
- **절대 금지**: `npx asar pack`으로 수동 패키징하면 node_modules 의존성이 빠져서 앱이 실행 안됨. 반드시 electron-builder가 생성한 app.asar 사용

## WSL에서 Windows Electron 앱 실행하기 (IMPORTANT)

**잘못된 방법 (절대 사용 금지):**
```bash
# 이 방법들은 모두 실패함:
cmd.exe /c "start C:\LOCAL-CLI\..."      # UNC 경로 오류
cmd.exe /c 'C:\LOCAL-CLI\...'            # 작업 디렉토리가 WSL UNC 경로라서 실패
"/mnt/c/LOCAL-CLI/앱이름.exe" &          # 백그라운드에서 조용히 실패
```

**왜 실패하는가:**
- WSL에서 cmd.exe를 실행하면 현재 작업 디렉토리가 `\\wsl.localhost\Ubuntu-22.04\...` (UNC 경로)로 설정됨
- CMD.EXE는 UNC 경로를 작업 디렉토리로 지원하지 않음
- 경로에 공백이 있으면 이스케이핑이 복잡해져서 추가 오류 발생

**올바른 방법:**
```bash
# PowerShell 사용 (권장)
powershell.exe -Command "& 'C:\LOCAL-CLI\LOCAL-CLI PowerShell UI.exe'"

# 또는 Start-Process 사용
powershell.exe -Command "Start-Process 'C:\LOCAL-CLI\LOCAL-CLI PowerShell UI.exe'"
```

**앱 실행 확인:**
```bash
# 프로세스 확인
tasklist.exe | grep -i "LOCAL-CLI\|Electron"
```

**주의:** 앱이 실행 후 바로 종료되면 앱 자체의 초기화 오류일 가능성이 높음. 로그 확인 필요.

## Architecture

### Plan & Execute Pattern

The core execution model automatically breaks user requests into TODO lists and executes them sequentially:

```
User Input → Planning LLM (generates TODOs) → Plan Executor → Per-task Agent → Tool Execution → Result
```

Key files:
- `src/orchestration/plan-executor.ts` - Core execution logic (React-independent pure logic)
- `src/agents/planner/` - TODO list generation from user requests
- `src/ui/components/PlanExecuteApp.tsx` - Main interactive UI component

### Tool System (6 Categories)

Tools are registered in `src/tools/registry.ts` with multi-category support:

| Category | Description |
|----------|-------------|
| LLM Simple | Called via tool_calls, no sub-LLM (file ops, bash) |
| LLM Agent | Called via tool_calls, uses sub-LLM (docs search) |
| System Simple | Auto-triggered by logic, no sub-LLM |
| System Agent | Auto-triggered by logic, uses sub-LLM |
| User Commands | Slash commands (/help, /settings, etc.) |
| MCP Tools | Model Context Protocol tools |

### Directory Structure

```
src/
├── cli.ts                    # CLI entry point (Commander.js)
├── constants.ts              # Global paths (~/.local-cli/)
├── core/
│   ├── llm/llm-client.ts    # OpenAI-compatible API wrapper (Axios)
│   ├── config/              # Settings file management
│   ├── session/             # Session persistence
│   └── compact/             # Auto-context compression at 80% capacity
├── agents/
│   ├── planner/             # TODO list generation
│   └── docs-search/         # LLM-based documentation search
├── orchestration/
│   └── plan-executor.ts     # Main Plan & Execute logic
├── prompts/                  # Centralized prompt management
│   ├── shared/              # Language/tool/codebase rules
│   └── agents/              # Agent-specific prompts
├── tools/
│   ├── llm/simple/          # File, bash, user interaction tools
│   ├── browser/             # Chrome/Edge automation (optional)
│   └── office/              # Word, Excel, PowerPoint (optional, Windows)
├── ui/
│   ├── components/          # Ink React components
│   └── hooks/               # Custom React hooks
├── errors/                   # Typed error classes
└── utils/
    ├── logger.ts            # JSON stream logging
    └── platform-utils.ts    # OS detection (Windows, WSL, macOS, Linux)
```

### LLM Client

`src/core/llm/llm-client.ts` handles all API communication:
- OpenAI-compatible endpoint support
- Streaming and non-streaming responses
- Auto-retry logic (up to 3 attempts)
- Model-specific preprocessing for reasoning LLMs
- 10-minute timeout for long requests

### Configuration

- Home directory: `~/.local-cli/`
- Config file: `~/.local-cli/config.json`
- Managed by: `src/core/config/config-manager.ts`

## Adding New Tools

1. Create tool in appropriate directory under `src/tools/`
2. Export tool definition with `name`, `description`, `parameters`, and `execute` function
3. Register in `src/tools/registry.ts` with appropriate categories
4. Tools requiring approval: set `requiresApproval: true`

Tool definition pattern:
```typescript
export default [{
  name: 'tool_name',
  description: 'What the tool does',
  parameters: { /* JSON Schema */ },
  execute: async (params, context) => { /* implementation */ }
}];
```

## Adding Slash Commands

Slash commands are handled in `src/core/slash-command-handler.ts`. Register new commands there following the existing pattern.

## Debugging

CLI flags:
- `--verbose` - Verbose output
- `--debug` - Debug mode
- `--llm-log` - Log LLM requests/responses
- `--eval` - Evaluation mode (NDJSON event streaming)

JSON stream logs are written by `src/utils/logger.ts` for analysis.

## Platform Notes

- **WSL2**: Browser and Office tools work via network mirroring to Windows host
- **Windows**: Office tools use COM automation (requires installed Office)
- **Browser tools**: Require Chrome or Edge installed

## Key Patterns

- Single tool execution per LLM invocation (enforced)
- Prompts centralized in `src/prompts/` (no scattered prompts)
- Plan executor is React-independent for testability
- TypeScript strict mode enabled with ESM modules
- Path alias: `@/*` maps to `src/*`
