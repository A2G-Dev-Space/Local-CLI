# OPEN-CLI Roadmap

> **문서 버전**: 6.0.0 (v1.2.3)
> **최종 수정일**: 2025-12-12
> **작성자**: Development Team

## 목차

1. [개요](#1-개요)
2. [v1.0.0 완료 기능](#2-v100-완료-기능)
3. [Phase 5: Supervised Mode (실행 모드)](#3-phase-5-supervised-mode-실행-모드)
4. [Phase 6: Codebase RAG](#4-phase-6-codebase-rag)
5. [Phase 7: MCP 기능 지원](#5-phase-7-mcp-기능-지원)
6. [Phase 8: Tool Selector](#6-phase-8-tool-selector)
7. [우선순위 매트릭스](#7-우선순위-매트릭스)

---

## 1. 개요

### 1.1 현재 아키텍처 (v1.2.x)

| 항목 | 상태 |
|------|------|
| 실행 모드 | **Auto Mode** (자율 실행) |
| Plan-Execute | **자동 요청 분류 + TODO 기반 실행** |
| 도구 분류 | **6가지 분류 시스템** |
| 사용량 추적 | **세션/일별/월별 통계** |
| 문서 관리 | **/docs download agno, adk** |
| Git Auto-Update | **자동 업데이트 + spinner 애니메이션** |

---

## 2. v1.0.0 완료 기능

### 2.1 Phase 1: Plan-Execute Auto Mode ✅

- ✅ 요청 분류 시스템 (simple_response / requires_todo)
- ✅ `update-todo-list` LLM Tool
- ✅ `get-todo-list` LLM Tool
- ✅ ESC 키 Human Interrupt
- ✅ Plan 승인 제거 (자동 실행)

### 2.2 Phase 2: ask-to-user Tool ✅

- ✅ `ask-to-user` LLM Tool (2-4개 선택지 + "Other")
- ✅ AskUserDialog UI 컴포넌트
- ✅ LLM이 사용자에게 질문/확인 가능

### 2.3 Phase 3: 사용량 추적 ✅

- ✅ `/usage` 명령어
- ✅ 세션 레벨 토큰 취합
- ✅ Claude Code 스타일 상태바
  - `✶ ~하는 중… (esc to interrupt · 2m 7s · ↑ 3.6k tokens)`
- ✅ 일별/월별/전체 통계
- ✅ `~/.open-cli/usage.json` 저장

### 2.4 Phase 4: 문서 다운로드 내재화 ✅

- ✅ `/docs` 명령어 (정보 표시)
- ✅ `/docs download <source>` (agno, adk)
- ✅ 설치 상태 표시 (✅/⬜)
- ✅ sparse checkout으로 docs 폴더만 다운로드
- ✅ 개발팀 사전 정의 소스만 지원 (보안)

---

## 3. Phase 5: Supervised Mode (실행 모드) ✅

> **목표**: 사용자가 AI의 파일 수정 Tool 실행을 승인/거부할 수 있는 모드
> **우선순위**: 🔴 높음
> **상태**: ✅ 완료 (v1.2.x)

### 3.1 개요

두 가지 실행 모드를 제공하여 사용자가 AI 자율성 수준을 선택할 수 있습니다.

| 모드 | 설명 | Tool 실행 |
|------|------|-----------|
| **Auto Mode** | 자율 실행 | 모든 도구 자동 실행 |
| **Supervised Mode** | 파일 수정 시 승인 필요 | `create_file`, `edit_file`만 승인 필요 |

### 3.2 모드 전환

```
Tab 키           → Auto ↔ Supervised 토글
상태바           → 현재 모드 표시 [Auto] 또는 [Supervised]
```

### 3.3 승인이 필요한 도구

| 도구 | 승인 필요 | 설명 |
|------|----------|------|
| `create_file` | ✅ | 새 파일 생성 |
| `edit_file` | ✅ | 기존 파일 수정 |
| `read_file` | ❌ | 파일 읽기 |
| `list_files` | ❌ | 디렉토리 목록 |
| `find_files` | ❌ | 파일 검색 |
| `tell_to_user` | ❌ | 메시지 전달 |
| `ask_user` | ❌ | 사용자에게 질문 |

### 3.4 승인 다이얼로그

```
┌─────────────────────────────────────────────────────────────┐
│  🔧 create_file                                              │
│  ───────────────────────────────────────────────────────    │
│  📁 file_path: /src/utils/helper.ts                          │
│  📝 content: export function helper() { ... }                │
│  ───────────────────────────────────────────────────────    │
│  ▸ [1] ✅ Approve                                            │
│    [2] ❌ Reject                                             │
│  ───────────────────────────────────────────────────────    │
│  ↑↓ 이동 | Enter 선택 | 1-2 번호 선택                          │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 거부 시 코멘트 흐름

```
Reject 선택
    ↓
┌─────────────────────────────────────────────┐
│  💬 AI에게 전달할 코멘트를 입력하세요:        │
│  > 이 파일 대신 existing-helper.ts를 수정해줘 │
└─────────────────────────────────────────────┘
    ↓
코멘트가 AI의 다음 메시지로 전달
    ↓
AI가 피드백 반영하여 재시도
```

### 3.6 구현 완료 항목

- [x] `ExecutionMode` 타입 정의 (`'auto' | 'supervised'`)
- [x] `executionMode` 상태 (PlanExecuteApp)
- [x] `ApprovalDialog` UI 컴포넌트
- [x] Tab 키 모드 토글
- [x] 상태바 모드 표시
- [x] Tool 실행 전 승인 체크 로직 (콜백 시스템)
- [x] 거부 시 코멘트 → AI 메시지 전달
- [x] Static Log에 승인/거부 로그 표시

### 3.7 추가 구현 사항 (v1.2.x)

- [x] `parallel_tool_calls: false` API 파라미터로 단일 Tool 실행 강제
- [x] Context 표시 형식 변경: `Context (1.3K / 13%)`
- [x] maxIterations 제한 제거 (무제한 Tool 실행)
- [x] 코드베이스 이해 우선 지시문 추가

---

## 4. Phase 6: Codebase RAG

> **목표**: 대규모 코드베이스를 LLM이 이해하기 쉽게 인덱싱
> **우선순위**: 🟡 중간

### 4.1 `/indexing` User Command

```
/indexing                 # 도움말
/indexing start           # 코드베이스 인덱싱 시작
/indexing status          # 인덱싱 상태 확인
/indexing refresh         # 변경된 파일만 재인덱싱
```

### 4.2 인덱스 구조

```typescript
interface CodebaseIndex {
  projectPath: string;
  lastIndexed: string;
  structure: {
    entryPoints: string[];      // 진입점 파일
    configFiles: string[];      // 설정 파일
    modules: ModuleSummary[];   // 모듈별 요약
  };
  files: {
    [path: string]: {
      type: 'code' | 'config' | 'docs' | 'test';
      summary: string;          // LLM 생성 요약
      exports?: string[];       // 내보내는 함수/클래스
      dependencies?: string[];  // 의존성
    };
  };
}
```

### 4.3 구현 항목

- [ ] `/indexing` 명령어 구현
- [ ] 코드 구조 분석기
- [ ] LLM 기반 코드 요약
- [ ] 인덱스 저장/로드
- [ ] 증분 인덱싱

---

## 5. Phase 7: MCP 기능 지원

> **목표**: Model Context Protocol 통합
> **우선순위**: 🟡 중간

### 5.1 MCP Client 구현

- [ ] MCP 프로토콜 구현 (JSON-RPC)
- [ ] stdio 전송 지원
- [ ] SSE 전송 지원
- [ ] 서버 연결/해제 관리

### 5.2 `/mcp` User Command

```
/mcp                      # 도움말
/mcp list                 # 연결된 서버 목록
/mcp add <config>         # 서버 추가
/mcp remove <server>      # 서버 제거
/mcp enable <tool>        # 도구 활성화
/mcp disable <tool>       # 도구 비활성화
```

### 5.3 MCP Tool 통합

- [ ] MCP Tool을 LLM Tool로 자동 등록
- [ ] Tool Selector와 연동 (Phase 8)

---

## 6. Phase 8: Tool Selector

> **목표**: LLM Tool이 많아질 경우 성능 저하 방지
> **우선순위**: 🟢 낮음 (Tool이 많아진 후 구현)

### 6.1 문제 정의

```
현재: 모든 LLM Tool을 프롬프트에 포함
문제: Tool 수 증가 → 프롬프트 길이 증가 → 성능 저하
```

### 6.2 해결 방안

```
User 요청
    ↓
┌─────────────────────────────────┐
│  Tool Selector (경량 LLM 호출)   │
│  "이 요청에 필요한 도구 선택"     │
└─────────────────────────────────┘
    ↓
선택된 Tool만 포함하여 메인 LLM 호출
```

### 6.3 구현 항목

- [ ] `tools/selector/` 폴더 구조 생성
- [ ] Tool 메타데이터 정의 (name, description, keywords)
- [ ] Tool Selector 인터페이스 정의

---

## 7. 우선순위 매트릭스

### 7.1 구현 순서

| Phase | 항목 | 상태 | 우선순위 |
|-------|------|------|----------|
| 1 | Plan-Execute Auto Mode 강화 | ✅ 완료 | - |
| 2 | ask-to-user Tool | ✅ 완료 | - |
| 3 | 사용량 추적 | ✅ 완료 | - |
| 4 | 문서 다운로드 내재화 | ✅ 완료 | - |
| 5 | **Supervised Mode (실행 모드)** | ✅ 완료 | - |
| 6 | Codebase RAG | 🔲 예정 | 🔴 높음 |
| 7 | MCP 기능 지원 | 🔲 예정 | 🟡 중간 |
| 8 | Tool Selector | 🔲 예정 | 🟢 낮음 |

### 7.2 권장 구현 순서

```
Phase 6 → Phase 7 → Phase 8
   ↓         ↓         ↓
 코드      외부      최적화
 분석      연동     (나중에)
```

---

*이 문서는 프로젝트 진행에 따라 지속적으로 업데이트됩니다.*
