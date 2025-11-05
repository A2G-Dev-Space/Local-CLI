# OPEN-CLI New Features - Detailed Design

**5가지 신규 기능 상세 설계 문서**

이 문서는 PROGRESS.md Section 2.7-2.11의 상세 구현 가이드입니다.

---

## 📑 목차

1. [2.7 ESC로 LLM Interrupt](#27-esc로-llm-interrupt-생성-중지)
2. [2.8 YOLO Mode vs Ask Mode](#28-yolo-mode-vs-ask-mode-전환)
3. [2.9 File Edit Tool 개선](#29-file-edit-tool-개선-replace-방식)
4. [2.10 Config Init 개선](#210-config-init-개선-및-model-management)
5. [2.11 TODO 자동 Save](#211-todo-완료-시-자동-save)

---

## 2.7 ESC로 LLM Interrupt (생성 중지)

### 목표
사용자가 ESC 키를 눌러 LLM 응답 생성을 즉시 중단할 수 있는 기능

### 배경
- 긴 응답이나 잘못된 방향으로 진행 중일 때 즉시 중단 필요
- 스트리밍 중에도 실시간으로 중단 가능해야 함
- 중단 시 현재까지 생성된 내용은 보존
- 깔끔한 종료 (메모리 누수 방지)

### Architecture

**전체 구조**:
```
User presses ESC
    ↓
Ink useInput hook captures ESC key
    ↓
Set abortController.abort() flag
    ↓
LLM streaming loop checks abort flag
    ↓
Stop fetching, save partial response
    ↓
Display "⚠️ Generation interrupted by user"
    ↓
Return to input prompt
```

**핵심 컴포넌트**:
- AbortController (Web API 표준)
- Streaming response reader
- UI interrupt indicator
- Partial response handler

### Implementation

**Dependencies**:
```bash
npm install node-abort-controller
```

**파일**: `src/core/llm-client.ts`

```typescript
import { AbortController } from 'node-abort-controller';
import axios, { AxiosInstance } from 'axios';

export class LLMClient {
  private axiosInstance: AxiosInstance;
  private currentAbortController: AbortController | null = null;

  /**
   * 현재 진행 중인 요청을 중단
   */
  interrupt(): void {
    if (this.currentAbortController) {
      console.log('[LLMClient] Interrupting current request...');
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  /**
   * Chat Completion Stream (Abort 지원)
   */
  async chatCompletionStream(
    options: Partial<LLMRequestOptions>,
    onChunk: (chunk: string) => void,
    onComplete: () => void
  ): Promise<void> {
    // AbortController 생성
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    try {
      const requestBody = {
        model: options.model || this.model,
        messages: options.messages || [],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
        stream: true,
        ...(options.tools && { tools: options.tools }),
      };

      const response = await this.axiosInstance.post(
        '/chat/completions',
        requestBody,
        {
          responseType: 'stream',
          signal, // ← Abort signal 전달
        }
      );

      const stream = response.data;

      // Abort 이벤트 리스너
      signal.addEventListener('abort', () => {
        console.log('[LLMClient] Abort signal received, destroying stream');
        stream.destroy();
      });

      // 스트림 읽기
      for await (const chunk of stream) {
        // Abort 체크
        if (signal.aborted) {
          console.log('[LLMClient] Stream aborted');
          break;
        }

        const lines = chunk.toString().split('\n').filter(Boolean);

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;

              if (content) {
                onChunk(content);
              }
            } catch (error) {
              console.error('[LLMClient] Stream parsing error:', error);
            }
          }
        }
      }

      // 정상 완료
      onComplete();
    } catch (error: any) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        // 정상적인 abort → 에러가 아님
        console.log('[LLMClient] Stream aborted by user');
        onComplete();
      } else {
        // 실제 에러
        throw error;
      }
    } finally {
      this.currentAbortController = null;
    }
  }
}
```

**파일**: `src/ui/InteractiveApp.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { LLMClient } from '../core/llm-client.js';
import { Message } from '../types/index.js';

export const InteractiveApp: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [wasInterrupted, setWasInterrupted] = useState(false);
  const llmClient = new LLMClient();

  // ESC 키 핸들러
  useInput((input, key) => {
    if (key.escape && isGenerating) {
      // ESC 누름 → LLM 중단
      console.log('[UI] ESC pressed, interrupting LLM...');
      llmClient.interrupt();
      setIsGenerating(false);
      setWasInterrupted(true);

      // 2초 후 인터럽트 메시지 숨김
      setTimeout(() => setWasInterrupted(false), 2000);
    }
  });

  // LLM 응답 생성
  const handleSubmit = async (userInput: string) => {
    setIsGenerating(true);
    setWasInterrupted(false);

    const userMessage: Message = { role: 'user', content: userInput };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    let assistantMessage = '';
    const assistantMessageObj: Message = { role: 'assistant', content: '' };

    try {
      await llmClient.chatCompletionStream(
        { messages: updatedMessages },
        (chunk) => {
          // 실시간 업데이트
          assistantMessage += chunk;
          assistantMessageObj.content = assistantMessage;
          setMessages([...updatedMessages, assistantMessageObj]);
        },
        () => {
          // 완료
          setIsGenerating(false);
        }
      );
    } catch (error) {
      setIsGenerating(false);
      console.error('[UI] Error during generation:', error);
    }
  };

  return (
    <Box flexDirection="column">
      {/* Messages */}
      <MessageList messages={messages} />

      {/* Interrupt Indicator */}
      {wasInterrupted && (
        <Box borderStyle="round" borderColor="yellow" paddingX={1} marginY={1}>
          <Text color="yellow">⚠️ Generation interrupted by user (ESC)</Text>
        </Box>
      )}

      {/* Input */}
      <InputBox
        onSubmit={handleSubmit}
        disabled={isGenerating}
        placeholder={
          isGenerating
            ? 'Generating... (Press ESC to stop)'
            : 'Type your message...'
        }
      />
    </Box>
  );
};
```

### UI States

**State 1: 정상 생성 중**
```
You: Hello

🤖 Assistant: Hello! How can I help you tod█

Type your message... (Press ESC to stop)
```

**State 2: ESC 누름 (중단)**
```
You: Hello

🤖 Assistant: Hello! How can I help you tod

┌──────────────────────────────────────────┐
│ ⚠️ Generation interrupted by user (ESC)  │
└──────────────────────────────────────────┘

Type your message...
```

**State 3: 부분 응답 보존**
```
You: Explain quantum computing in detail

🤖 Assistant: Quantum computing is a revolutionary technology that
leverages the principles of quantum mechanics to process inform
[interrupted]

You: _
```

### Testing Scenarios

- [ ] **짧은 응답 중단**: "Hello" 입력 → 응답 시작 → ESC → 부분 응답 보존 확인
- [ ] **긴 응답 중단**: "Explain quantum computing in 1000 words" → 중간에 ESC → 부분 응답 확인
- [ ] **Tool 호출 중 중단**: "Read package.json" → Tool 실행 중 ESC → 깔끔한 종료
- [ ] **연속 중단**: 여러 번 ESC 누름 → 메모리 누수 없는지 확인
- [ ] **중단 후 재시작**: ESC로 중단 → 새 메시지 입력 → 정상 작동 확인

---

## 2.8 YOLO Mode vs Ask Mode 전환

### 목표
사용자가 Tab 키로 두 가지 실행 모드를 전환할 수 있는 기능

### 배경
- **YOLO Mode**: LLM이 자율적으로 모든 작업 수행 (사용자 확인 없이)
- **Ask Mode** (기본값): 위험한 작업(파일 쓰기, 삭제 등) 전에 사용자 확인
- Tab 키로 실시간 전환 가능
- 현재 모드를 UI에 명확히 표시

### Mode Definitions

**YOLO Mode** (You Only Live Once):
```
특징:
- LLM이 모든 Tool을 자유롭게 호출
- 파일 쓰기, 수정, 삭제도 확인 없이 실행
- 빠른 작업 속도
- 신뢰할 수 있는 작업에 적합

위험도: ⚠️ 높음 (실수 시 파일 손실 가능)

사용 시나리오:
- 테스트 프로젝트
- 백업이 있는 경우
- LLM을 완전히 신뢰하는 경우
```

**Ask Mode** (기본값):
```
특징:
- 위험한 작업 전에 사용자에게 확인 요청
- 파일 쓰기/수정/삭제 전에 Y/n 프롬프트
- 안전한 작업 보장
- 초보자 및 중요 프로젝트에 적합

위험도: ✅ 낮음 (모든 변경사항 확인 가능)

사용 시나리오:
- 프로덕션 코드
- 중요한 파일 작업
- LLM 행동 확인하고 싶을 때
```

### Architecture

**모드 전환 흐름**:
```
User presses Tab
    ↓
Toggle mode: YOLO ↔ Ask
    ↓
Update UI indicator
    ↓
Save mode preference to config
```

**Tool 실행 흐름** (Ask Mode):
```
LLM wants to call write_file
    ↓
Check current mode
    ↓
If Ask Mode:
    ├─ Show confirmation prompt
    ├─ User input (Y/n)
    └─ Execute if Y, skip if n
    ↓
If YOLO Mode:
    └─ Execute immediately
```

### Implementation

**파일**: `src/types/index.ts`

```typescript
export type ExecutionMode = 'yolo' | 'ask';

export interface AppState {
  mode: ExecutionMode;
  messages: Message[];
  isGenerating: boolean;
}
```

**파일**: `src/core/config-manager.ts`

```typescript
export interface Config {
  models: ModelConfig[];
  currentModel: string;
  executionMode: ExecutionMode; // ← 추가
  autoUpdate: AutoUpdateConfig;
}

export class ConfigManager {
  /**
   * 실행 모드 가져오기
   */
  getExecutionMode(): ExecutionMode {
    const config = this.loadConfig();
    return config.executionMode || 'ask'; // 기본값: ask
  }

  /**
   * 실행 모드 설정
   */
  setExecutionMode(mode: ExecutionMode): void {
    const config = this.loadConfig();
    config.executionMode = mode;
    this.saveConfig(config);
    console.log(`[ConfigManager] Execution mode set to: ${mode}`);
  }
}
```

**파일**: `src/ui/InteractiveApp.tsx`

```typescript
import { useInput } from 'ink';
import { useState, useEffect } from 'react';
import { configManager } from '../core/config-manager.js';
import { ExecutionMode } from '../types/index.js';

export const InteractiveApp: React.FC = () => {
  const [mode, setMode] = useState<ExecutionMode>(
    configManager.getExecutionMode()
  );
  const [isGenerating, setIsGenerating] = useState(false);

  // Tab 키로 모드 전환, ESC 키로 중단
  useInput((input, key) => {
    // Tab: 모드 전환
    if (key.tab && !isGenerating) {
      const newMode: ExecutionMode = mode === 'yolo' ? 'ask' : 'yolo';
      setMode(newMode);
      configManager.setExecutionMode(newMode);
      console.log(`[UI] Mode switched to: ${newMode.toUpperCase()}`);
    }

    // ESC: LLM 중단 (기존)
    if (key.escape && isGenerating) {
      llmClient.interrupt();
      setIsGenerating(false);
    }
  });

  return (
    <Box flexDirection="column">
      {/* Header with Mode Indicator */}
      <Header mode={mode} />

      {/* Messages */}
      <MessageList messages={messages} />

      {/* Input with Mode Display */}
      <InputBox
        mode={mode}
        placeholder={`[${mode.toUpperCase()}] Type your message... (Tab to switch mode, ESC to stop)`}
        onSubmit={handleSubmit}
        disabled={isGenerating}
      />
    </Box>
  );
};
```

**파일**: `src/ui/components/Header.tsx`

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import { ExecutionMode } from '../../types/index.js';

interface HeaderProps {
  mode: ExecutionMode;
  model?: string;
  workingDir?: string;
}

export const Header: React.FC<HeaderProps> = ({ mode, model, workingDir }) => {
  const modeColor = mode === 'yolo' ? 'red' : 'green';
  const modeLabel = mode.toUpperCase();
  const otherMode = mode === 'yolo' ? 'Ask' : 'YOLO';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginBottom={1}
    >
      <Box justifyContent="space-between">
        <Text bold>OPEN-CLI Interactive Mode</Text>
        <Box>
          <Text>[</Text>
          <Text color={modeColor} bold>{modeLabel} MODE</Text>
          <Text>] Tab↔{otherMode}</Text>
        </Box>
      </Box>
      <Box>
        <Text dimColor>Model: {model || 'unknown'} | {workingDir || '~'}</Text>
      </Box>
    </Box>
  );
};
```

**파일**: `src/core/tool-executor.ts`

```typescript
import { ExecutionMode } from '../types/index.js';
import inquirer from 'inquirer';

export class ToolExecutor {
  private mode: ExecutionMode;

  constructor(mode: ExecutionMode) {
    this.mode = mode;
  }

  /**
   * 모드 업데이트
   */
  setMode(mode: ExecutionMode): void {
    this.mode = mode;
  }

  /**
   * Tool 실행 (모드에 따라 확인 요청)
   */
  async executeTool(toolName: string, args: any): Promise<any> {
    // 위험한 Tool인지 확인
    const dangerousTools = [
      'write_file',
      'edit_file',
      'delete_file',
      'execute_command',
      'create_directory',
      'move_file',
    ];

    const isDangerous = dangerousTools.includes(toolName);

    // Ask Mode이고 위험한 Tool이면 확인 요청
    if (this.mode === 'ask' && isDangerous) {
      console.log('\n'); // 줄바꿈

      const confirmed = await this.askConfirmation(toolName, args);

      if (!confirmed) {
        return {
          success: false,
          message: `Operation cancelled by user (Ask Mode)`,
        };
      }
    }

    // Tool 실행
    return await this.executeToolInternal(toolName, args);
  }

  /**
   * 사용자 확인 요청
   */
  private async askConfirmation(toolName: string, args: any): Promise<boolean> {
    console.log(`⚠️  ${toolName} will be executed with:`);
    console.log(JSON.stringify(args, null, 2));
    console.log('');

    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed with this operation?',
        default: true,
      },
    ]);

    return answer.proceed;
  }

  /**
   * Tool 실행 (내부)
   */
  private async executeToolInternal(toolName: string, args: any): Promise<any> {
    // 실제 Tool 실행 로직
    // (기존 코드 유지)
    switch (toolName) {
      case 'write_file':
        return await writeFile(args);
      case 'edit_file':
        return await editFile(args);
      // ...
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }
}
```

### UI Design

**Mode Indicator (Header)**:

YOLO Mode:
```
┌────────────────────────────────────────────────────────────┐
│ OPEN-CLI Interactive Mode          [YOLO MODE] Tab↔Ask    │
│ Model: gemini-2.0-flash | ~/project                       │
└────────────────────────────────────────────────────────────┘
```

Ask Mode:
```
┌────────────────────────────────────────────────────────────┐
│ OPEN-CLI Interactive Mode          [ASK MODE] Tab↔YOLO    │
│ Model: gemini-2.0-flash | ~/project                       │
└────────────────────────────────────────────────────────────┘
```

**Confirmation Prompt (Ask Mode)**:
```
🤖 Assistant: I'll create a new file for you.

⚠️  write_file will be executed with:
{
  "file_path": "./new-file.txt",
  "content": "Hello World"
}

? Proceed with this operation? (Y/n) _
```

**YOLO Mode (No Prompt)**:
```
🤖 Assistant: I'll create a new file for you.

✓ write_file executed: ./new-file.txt (23 bytes written)
```

### Testing Scenarios

- [ ] **Tab 전환**: Ask Mode → Tab → YOLO Mode → Tab → Ask Mode 확인
- [ ] **Ask Mode 확인**: write_file 호출 → 프롬프트 표시 → Y 입력 → 실행
- [ ] **Ask Mode 거부**: write_file 호출 → 프롬프트 표시 → n 입력 → 취소
- [ ] **YOLO Mode 즉시 실행**: write_file 호출 → 프롬프트 없이 즉시 실행
- [ ] **모드 저장**: 모드 전환 → CLI 재시작 → 이전 모드 유지 확인
- [ ] **Read-only Tool**: read_file 호출 → 모든 모드에서 즉시 실행 (확인 없음)

---

## 2.9 File Edit Tool 개선 (Replace 방식)

### 목표
기존 edit_file을 개선하여 original content 검증 및 replace 방식으로 변경

### 배경
- 현재 edit_file은 정확한 문자열 매칭이 어려움
- LLM이 원본 내용을 정확히 제공하지 않으면 실패
- 원본 내용 검증 후 재시도 유도 필요
- Line numbers와 content를 함께 제공하여 정확도 향상

### Current Issues

**기존 방식의 문제점**:
```typescript
// 기존 edit_file
{
  file_path: 'src/app.ts',
  old_content: 'console.log("hello")',  // ← 정확히 일치해야 함
  new_content: 'console.log("world")'
}

문제:
1. 공백, 탭, 줄바꿈이 정확히 일치해야 함
2. LLM이 원본을 완벽히 기억하지 못함
3. 실패 시 재시도 방법이 불명확
4. 여러 곳을 수정할 때 비효율적
```

### New Design: Replace with Line Numbers

**새로운 edit_file 스키마**:
```typescript
{
  file_path: string;
  original_lines: {
    start: number;  // 시작 라인 번호 (1-based)
    end: number;    // 종료 라인 번호 (inclusive)
    content: string; // 원본 내용 (검증용)
  };
  replace_lines: {
    content: string; // 새로운 내용
  };
}
```

**실행 흐름**:
```
1. 파일 읽기
2. original_lines.start ~ end의 실제 내용 추출
3. original_lines.content와 비교
4. 일치하면 → replace_lines.content로 교체
5. 불일치하면 → 에러 반환 + 실제 내용 제공 + 재시도 요청
```

### Implementation

**파일**: `src/tools/file-tools.ts`

```typescript
import fs from 'fs';
import path from 'path';

/**
 * Edit File Tool (새로운 방식)
 */
export const EDIT_FILE_TOOL = {
  type: 'function',
  function: {
    name: 'edit_file',
    description: `Edit a file by replacing specific lines with new content.

IMPORTANT INSTRUCTIONS:
1. First, ALWAYS read the file with read_file to see the current content and line numbers
2. Identify the exact lines you want to modify (count carefully, 1-based indexing)
3. Copy the EXACT original content (including all whitespace, tabs, newlines)
4. Provide the new content to replace those lines
5. If you get an "Original content mismatch" error:
   - Read the actual_content from the error response
   - Retry edit_file with the EXACT content provided

Example:
  File has 10 lines, you want to change lines 5-7:
  {
    "file_path": "src/app.ts",
    "original_lines": {
      "start": 5,
      "end": 7,
      "content": "function hello() {\\n  console.log('hello');\\n}"
    },
    "replace_lines": {
      "content": "function hello() {\\n  console.log('Hello, World!');\\n}"
    }
  }`,
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file to edit (relative or absolute)',
        },
        original_lines: {
          type: 'object',
          description: 'The original lines to be replaced (for verification)',
          properties: {
            start: {
              type: 'number',
              description: 'Start line number (1-based, inclusive)',
            },
            end: {
              type: 'number',
              description: 'End line number (1-based, inclusive)',
            },
            content: {
              type: 'string',
              description: 'Exact original content of these lines (must match exactly, including whitespace)',
            },
          },
          required: ['start', 'end', 'content'],
        },
        replace_lines: {
          type: 'object',
          description: 'The new content to replace the original lines',
          properties: {
            content: {
              type: 'string',
              description: 'New content (can be multiple lines, use \\n for line breaks)',
            },
          },
          required: ['content'],
        },
      },
      required: ['file_path', 'original_lines', 'replace_lines'],
    },
  },
};

/**
 * Edit File 실행 로직
 */
export async function editFile(args: {
  file_path: string;
  original_lines: {
    start: number;
    end: number;
    content: string;
  };
  replace_lines: {
    content: string;
  };
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  actual_content?: string;
}> {
  const { file_path, original_lines, replace_lines } = args;

  try {
    // 1. 파일 존재 확인
    const absPath = path.resolve(file_path);

    if (!fs.existsSync(absPath)) {
      return {
        success: false,
        error: `File not found: ${file_path}`,
      };
    }

    // 2. 파일 읽기
    const fileContent = fs.readFileSync(absPath, 'utf-8');
    const lines = fileContent.split('\n');

    // 3. 라인 번호 검증
    if (original_lines.start < 1) {
      return {
        success: false,
        error: `Line numbers must be >= 1. You provided start: ${original_lines.start}`,
      };
    }

    if (original_lines.end > lines.length) {
      return {
        success: false,
        error: `Line numbers out of range. File has ${lines.length} lines, but you requested end line: ${original_lines.end}`,
      };
    }

    if (original_lines.start > original_lines.end) {
      return {
        success: false,
        error: `Invalid line range: start (${original_lines.start}) > end (${original_lines.end})`,
      };
    }

    // 4. 원본 내용 추출 (0-based indexing으로 변환)
    const actualContent = lines
      .slice(original_lines.start - 1, original_lines.end)
      .join('\n');

    // 5. 원본 내용 검증
    if (actualContent !== original_lines.content) {
      return {
        success: false,
        error: `Original content mismatch. The actual content of lines ${original_lines.start}-${original_lines.end} doesn't match what you provided.`,
        actual_content: actualContent,
        message: `Please retry with the correct original content:

Lines ${original_lines.start}-${original_lines.end} (actual content):
\`\`\`
${actualContent}
\`\`\`

Retry edit_file with this EXACT content in the original_lines.content field.`,
      };
    }

    // 6. 내용 교체
    const replaceLines = replace_lines.content.split('\n');
    const newLines = [
      ...lines.slice(0, original_lines.start - 1),
      ...replaceLines,
      ...lines.slice(original_lines.end),
    ];

    // 7. 파일 쓰기
    fs.writeFileSync(absPath, newLines.join('\n'), 'utf-8');

    const bytesWritten = Buffer.byteLength(newLines.join('\n'), 'utf-8');

    return {
      success: true,
      message: `Successfully edited ${file_path}:
- Replaced lines ${original_lines.start}-${original_lines.end} (${original_lines.end - original_lines.start + 1} lines)
- New content: ${replaceLines.length} lines
- File size: ${bytesWritten} bytes`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to edit file: ${error.message}`,
    };
  }
}
```

### LLM Usage Example

**Scenario 1: 성공적인 수정**

Step 1: Read file first
```json
{
  "tool": "read_file",
  "arguments": {
    "file_path": "src/app.ts"
  }
}
```

Response:
```
     1  import express from 'express';
     2
     3  const app = express();
     4
     5  function hello() {
     6    console.log('hello');
     7  }
     8
     9  app.listen(3000);
    10
```

Step 2: Edit with correct line numbers
```json
{
  "tool": "edit_file",
  "arguments": {
    "file_path": "src/app.ts",
    "original_lines": {
      "start": 5,
      "end": 7,
      "content": "function hello() {\n  console.log('hello');\n}"
    },
    "replace_lines": {
      "content": "function hello() {\n  console.log('Hello, World!');\n}"
    }
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Successfully edited src/app.ts:\n- Replaced lines 5-7 (3 lines)\n- New content: 3 lines\n- File size: 145 bytes"
}
```

---

**Scenario 2: 원본 내용 불일치 → 재시도**

LLM call (잘못된 원본):
```json
{
  "tool": "edit_file",
  "arguments": {
    "file_path": "src/app.ts",
    "original_lines": {
      "start": 5,
      "end": 7,
      "content": "function hello(){\nconsole.log('hello');}"  // ← 공백 틀림
    },
    "replace_lines": {
      "content": "function hello() {\n  console.log('Hello, World!');\n}"
    }
  }
}
```

Error response:
```json
{
  "success": false,
  "error": "Original content mismatch. The actual content of lines 5-7 doesn't match what you provided.",
  "actual_content": "function hello() {\n  console.log('hello');\n}",
  "message": "Please retry with the correct original content:\n\nLines 5-7 (actual content):\n```\nfunction hello() {\n  console.log('hello');\n}\n```\n\nRetry edit_file with this EXACT content in the original_lines.content field."
}
```

LLM retries with correct content:
```json
{
  "original_lines": {
    "start": 5,
    "end": 7,
    "content": "function hello() {\n  console.log('hello');\n}"  // ← 정확
  },
  "replace_lines": {
    "content": "function hello() {\n  console.log('Hello, World!');\n}"
  }
}
```

Success!

### System Prompt Update

**LLM에게 주는 지침** (`src/prompts/system-prompt.ts`):

```typescript
export const SYSTEM_PROMPT = `You are a helpful AI assistant with access to file system tools.

**IMPORTANT RULES for edit_file:**
1. ALWAYS read the file first with read_file before editing
2. Count line numbers carefully (1-based indexing: first line is 1, not 0)
3. Copy the EXACT original content including:
   - All spaces and tabs
   - All newlines (use \\n in JSON)
   - All special characters
4. If you get an "Original content mismatch" error:
   - Carefully read the actual_content from the error response
   - Copy it EXACTLY and retry edit_file
   - Do NOT try to guess or approximate the content
5. For large files, edit small sections at a time (5-10 lines max)
6. After editing, you can read the file again to verify changes

**Example workflow:**
1. read_file("src/app.ts") → see lines 1-100
2. Identify lines to change (e.g., lines 25-28)
3. Copy EXACT content of lines 25-28
4. Call edit_file with original_lines and replace_lines
5. If error, read actual_content and retry
6. Success!

Available tools: read_file, write_file, edit_file, list_files, find_files, execute_command
`;
```

### Testing Scenarios

- [ ] **정상 수정**: 파일 읽기 → 정확한 라인 번호로 수정 → 성공
- [ ] **원본 불일치**: 틀린 원본 제공 → 에러 + actual_content → 재시도 → 성공
- [ ] **라인 번호 초과**: end > 파일 라인 수 → 에러 메시지
- [ ] **파일 없음**: 존재하지 않는 파일 → 에러 메시지
- [ ] **여러 줄 수정**: 10줄 → 3줄로 축소 → 성공
- [ ] **한 줄 수정**: start == end → 한 줄만 교체 → 성공

---

## 2.10 Config Init 개선 및 Model Management

### 목표
open config init 제거, 최초 실행 시 자동 설정, 모델 관리 명령어 추가

### 배경
- 현재: `open config init` → `open` (2단계 불편)
- 개선: `open` 한 번에 모든 설정 완료
- /addmodel, /deletemodel, /model, /reset 명령어 추가
- 저장된 모델이 없으면 안내 메시지

### New Flow

**기존 플로우** (불편):
```bash
$ open config init
? Enter endpoint name: local
? Enter base URL: http://localhost:8000/v1
? Enter API key: (optional)
? Enter model ID: gemini-2.0-flash

✅ Config saved!

$ open
(CLI 시작)
```

**새로운 플로우** (간편):
```bash
$ open

(모델 없음 감지)

┌────────────────────────────────────────────┐
│ Welcome to OPEN-CLI! 🚀                    │
│                                            │
│ No models configured yet.                 │
│ Let's set up your first model.            │
└────────────────────────────────────────────┘

? Model name (e.g., local-gemini): local
? Base URL: http://localhost:8000/v1
? API Key (optional):
? Model ID: gemini-2.0-flash

✅ Model 'local' saved!

Starting OPEN-CLI...

You: _
```

### Model Management Commands

**새로운 메타 명령어들**:

#### 1. /addmodel - 새 모델 추가

```
You: /addmodel

? Model name: openrouter
? Base URL: https://openrouter.ai/api/v1
? API Key: sk-or-v1-...
? Model ID: anthropic/claude-3.5-sonnet

✅ Model 'openrouter' added!
Use /model to switch between models.
```

#### 2. /deletemodel - 모델 삭제

```
You: /deletemodel

Available models:
  1. local (current)
  2. openrouter
  3. deepinfra

? Select model to delete: 2

⚠️  Delete model 'openrouter'? This cannot be undone. (y/N): y

✅ Model 'openrouter' deleted!
```

#### 3. /model - 모델 전환

```
You: /model

Available models:
  1. local (current) - gemini-2.0-flash
  2. openrouter - anthropic/claude-3.5-sonnet
  3. deepinfra - meta-llama/Llama-3.3-70B

? Select model: 2

✅ Switched to 'openrouter'
Model: anthropic/claude-3.5-sonnet
Base URL: https://openrouter.ai/api/v1

Restarting conversation with new model...
```

#### 4. /reset - 모든 설정 초기화

```
You: /reset

⚠️  WARNING: This will delete ALL configurations, models, and sessions.
This action cannot be undone.

? Are you sure you want to reset everything? (y/N): y

✅ All configurations reset!

OPEN-CLI will now exit. Run 'open' to set up again.

(프로세스 종료)
```

### Config Structure

**새로운 config.json 구조**:

```json
{
  "models": [
    {
      "name": "local",
      "baseUrl": "http://localhost:8000/v1",
      "apiKey": "",
      "modelId": "gemini-2.0-flash",
      "isDefault": true,
      "createdAt": "2025-11-05T10:30:00Z"
    },
    {
      "name": "openrouter",
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "sk-or-v1-...",
      "modelId": "anthropic/claude-3.5-sonnet",
      "isDefault": false,
      "createdAt": "2025-11-05T11:15:00Z"
    }
  ],
  "currentModel": "local",
  "executionMode": "ask",
  "autoUpdate": {
    "enabled": true,
    "checkOnStartup": true,
    "autoInstall": false
  }
}
```

### Implementation

**파일**: `src/types/index.ts`

```typescript
export interface ModelConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  isDefault: boolean;
  createdAt: string;
}

export interface Config {
  models: ModelConfig[];
  currentModel: string;
  executionMode: ExecutionMode;
  autoUpdate: AutoUpdateConfig;
}
```

**파일**: `src/core/config-manager.ts`

```typescript
import fs from 'fs';
import path from 'path';
import os from 'os';

export class ConfigManager {
  private configPath: string;

  constructor() {
    const configDir = path.join(os.homedir(), '.open-cli');
    this.configPath = path.join(configDir, 'config.json');

    // 디렉토리 생성
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  /**
   * 모델 존재 여부 확인
   */
  hasModels(): boolean {
    const config = this.loadConfig();
    return config.models && config.models.length > 0;
  }

  /**
   * 모든 모델 가져오기
   */
  getAllModels(): ModelConfig[] {
    const config = this.loadConfig();
    return config.models || [];
  }

  /**
   * 모델 추가
   */
  addModel(model: Omit<ModelConfig, 'createdAt'>): void {
    const config = this.loadConfig();

    if (!config.models) {
      config.models = [];
    }

    // 이름 중복 체크
    if (config.models.some((m) => m.name === model.name)) {
      throw new Error(`Model '${model.name}' already exists. Use a different name.`);
    }

    // 모델 추가 (타임스탬프 추가)
    const newModel: ModelConfig = {
      ...model,
      createdAt: new Date().toISOString(),
    };

    // 첫 모델이면 자동으로 current로 설정
    if (config.models.length === 0) {
      newModel.isDefault = true;
      config.currentModel = newModel.name;
    }

    config.models.push(newModel);
    this.saveConfig(config);

    console.log(`[ConfigManager] Model '${model.name}' added`);
  }

  /**
   * 모델 삭제
   */
  deleteModel(modelName: string): void {
    const config = this.loadConfig();

    const index = config.models.findIndex((m) => m.name === modelName);
    if (index === -1) {
      throw new Error(`Model '${modelName}' not found.`);
    }

    // 현재 사용 중인 모델은 삭제 불가
    if (config.currentModel === modelName) {
      throw new Error(
        `Cannot delete the current model '${modelName}'. Switch to another model first using /model.`
      );
    }

    // 마지막 남은 모델은 삭제 불가
    if (config.models.length === 1) {
      throw new Error(
        `Cannot delete the only model. Add another model first using /addmodel.`
      );
    }

    config.models.splice(index, 1);
    this.saveConfig(config);

    console.log(`[ConfigManager] Model '${modelName}' deleted`);
  }

  /**
   * 모델 전환
   */
  switchModel(modelName: string): void {
    const config = this.loadConfig();

    const model = config.models.find((m) => m.name === modelName);
    if (!model) {
      throw new Error(`Model '${modelName}' not found.`);
    }

    config.currentModel = modelName;
    this.saveConfig(config);

    console.log(`[ConfigManager] Switched to model: ${modelName}`);
  }

  /**
   * 현재 모델 가져오기
   */
  getCurrentModel(): ModelConfig | null {
    const config = this.loadConfig();

    if (!config.currentModel || !config.models) {
      return null;
    }

    return config.models.find((m) => m.name === config.currentModel) || null;
  }

  /**
   * 모든 설정 초기화
   */
  reset(): void {
    const defaultConfig: Config = {
      models: [],
      currentModel: '',
      executionMode: 'ask',
      autoUpdate: {
        enabled: true,
        checkOnStartup: true,
        autoInstall: false,
      },
    };

    this.saveConfig(defaultConfig);

    // 세션 디렉토리도 삭제
    const sessionsDir = path.join(path.dirname(this.configPath), 'sessions');
    if (fs.existsSync(sessionsDir)) {
      fs.rmSync(sessionsDir, { recursive: true, force: true });
    }

    console.log('[ConfigManager] All configurations reset');
  }

  /**
   * Config 로드
   */
  private loadConfig(): Config {
    if (!fs.existsSync(this.configPath)) {
      return {
        models: [],
        currentModel: '',
        executionMode: 'ask',
        autoUpdate: { enabled: true, checkOnStartup: true },
      };
    }

    return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
  }

  /**
   * Config 저장
   */
  private saveConfig(config: Config): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }
}

export const configManager = new ConfigManager();
```

**파일**: `src/cli.ts`

```typescript
#!/usr/bin/env node

import { program } from 'commander';
import { configManager } from './core/config-manager.js';
import inquirer from 'inquirer';
import { checkAndUpdate } from './core/auto-updater.js';

async function main() {
  // 1. Auto-update check
  await checkAndUpdate();

  // 2. 모델 존재 여부 확인
  if (!configManager.hasModels()) {
    await runFirstTimeSetup();
  }

  // 3. CLI 시작
  program
    .name('open')
    .description('Offline Enterprise AI-Powered CLI Platform')
    .version('0.2.0')
    .option('--no-update', 'Skip auto-update check')
    .action(async () => {
      // Interactive mode 시작
      const { startInteractiveMode } = await import('./modes/interactive.js');
      await startInteractiveMode();
    });

  program.parse();
}

/**
 * 최초 설정 (모델 없을 때)
 */
async function runFirstTimeSetup() {
  console.log('\n┌────────────────────────────────────────────┐');
  console.log('│ Welcome to OPEN-CLI! 🚀                    │');
  console.log('│                                            │');
  console.log('│ No models configured yet.                 │');
  console.log('│ Let\'s set up your first model.            │');
  console.log('└────────────────────────────────────────────┘\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Model name (e.g., local-gemini):',
      default: 'local',
      validate: (input) => {
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Model name must contain only lowercase letters, numbers, and hyphens';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL:',
      default: 'http://localhost:8000/v1',
      validate: (input) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key (optional, press Enter to skip):',
      default: '',
    },
    {
      type: 'input',
      name: 'modelId',
      message: 'Model ID:',
      default: 'gemini-2.0-flash',
    },
  ]);

  configManager.addModel({
    name: answers.name,
    baseUrl: answers.baseUrl,
    apiKey: answers.apiKey,
    modelId: answers.modelId,
    isDefault: true,
  });

  console.log(`\n✅ Model '${answers.name}' saved!`);
  console.log('Starting OPEN-CLI...\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**파일**: `src/modes/interactive.ts` (메타 명령어 추가)

```typescript
import inquirer from 'inquirer';
import { configManager } from '../core/config-manager.js';

export async function startInteractiveMode() {
  // ... existing code ...

  // 사용자 입력 처리
  const userInput = await promptUser();

  // 메타 명령어 처리
  if (userInput.startsWith('/')) {
    const command = userInput.slice(1).split(' ')[0];

    switch (command) {
      case 'addmodel':
        await handleAddModel();
        continue;

      case 'deletemodel':
        await handleDeleteModel();
        continue;

      case 'model':
        await handleSwitchModel();
        continue;

      case 'reset':
        await handleReset();
        process.exit(0); // 종료

      case 'exit':
      case 'quit':
        console.log('\nGoodbye! 👋\n');
        process.exit(0);

      // ... existing commands ...

      default:
        console.log(`Unknown command: /${command}`);
        console.log('Type /help to see available commands');
        continue;
    }
  }

  // 일반 메시지 처리
  // ...
}

/**
 * /addmodel 핸들러
 */
async function handleAddModel() {
  console.log('\n📝 Add New Model\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Model name:',
      validate: (input) => {
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Model name must contain only lowercase letters, numbers, and hyphens';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL:',
      validate: (input) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key (optional):',
      default: '',
    },
    {
      type: 'input',
      name: 'modelId',
      message: 'Model ID:',
    },
  ]);

  try {
    configManager.addModel({
      name: answers.name,
      baseUrl: answers.baseUrl,
      apiKey: answers.apiKey,
      modelId: answers.modelId,
      isDefault: false,
    });

    console.log(`\n✅ Model '${answers.name}' added!`);
    console.log('Use /model to switch between models.\n');
  } catch (error: any) {
    console.error(`\n❌ ${error.message}\n`);
  }
}

/**
 * /deletemodel 핸들러
 */
async function handleDeleteModel() {
  const models = configManager.getAllModels();

  if (models.length === 0) {
    console.log('\n❌ No models configured.\n');
    return;
  }

  console.log('\n🗑️  Delete Model\n');
  console.log('Available models:');
  models.forEach((model, index) => {
    const current = configManager.getCurrentModel()?.name === model.name;
    console.log(`  ${index + 1}. ${model.name}${current ? ' (current)' : ''}`);
  });

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'modelIndex',
      message: 'Select model to delete:',
      choices: models.map((model, index) => ({
        name: `${model.name} - ${model.modelId}`,
        value: index,
      })),
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: (answers) => {
        const modelName = models[answers.modelIndex].name;
        return `Delete model '${modelName}'? This cannot be undone.`;
      },
      default: false,
    },
  ]);

  if (answer.confirm) {
    const modelName = models[answer.modelIndex].name;

    try {
      configManager.deleteModel(modelName);
      console.log(`\n✅ Model '${modelName}' deleted!\n`);
    } catch (error: any) {
      console.error(`\n❌ ${error.message}\n`);
    }
  } else {
    console.log('\n❌ Cancelled.\n');
  }
}

/**
 * /model 핸들러
 */
async function handleSwitchModel() {
  const models = configManager.getAllModels();
  const currentModel = configManager.getCurrentModel();

  if (models.length === 0) {
    console.log('\n❌ No models configured.\n');
    return;
  }

  console.log('\n🔄 Switch Model\n');
  console.log('Available models:');
  models.forEach((model, index) => {
    const current = currentModel?.name === model.name;
    console.log(
      `  ${index + 1}. ${model.name}${current ? ' (current)' : ''} - ${model.modelId}`
    );
  });

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'modelIndex',
      message: 'Select model:',
      choices: models.map((model, index) => ({
        name: `${model.name} - ${model.modelId}`,
        value: index,
      })),
    },
  ]);

  const selectedModel = models[answer.modelIndex];

  if (selectedModel.name === currentModel?.name) {
    console.log(`\n✅ Already using model '${selectedModel.name}'\n`);
    return;
  }

  configManager.switchModel(selectedModel.name);

  console.log(`\n✅ Switched to model '${selectedModel.name}'`);
  console.log(`Model: ${selectedModel.modelId}`);
  console.log(`Base URL: ${selectedModel.baseUrl}`);
  console.log('\nRestarting conversation with new model...\n');

  // 메시지 히스토리 초기화 (선택사항)
  // messages = [];
}

/**
 * /reset 핸들러
 */
async function handleReset() {
  console.log('\n⚠️  RESET ALL CONFIGURATIONS\n');

  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message:
        'This will delete ALL configurations, models, and sessions. This action cannot be undone. Are you sure?',
      default: false,
    },
  ]);

  if (answer.confirm) {
    configManager.reset();
    console.log('\n✅ All configurations reset!');
    console.log('\nOPEN-CLI will now exit. Run \'open\' to set up again.\n');
    process.exit(0);
  } else {
    console.log('\n❌ Reset cancelled.\n');
  }
}
```

### Testing Scenarios

- [ ] **최초 실행**: 모델 없음 → 설정 프롬프트 → 모델 추가 → CLI 시작
- [ ] **/addmodel**: 새 모델 추가 → 성공 메시지
- [ ] **/addmodel 중복**: 동일 이름 추가 → 에러 메시지
- [ ] **/deletemodel**: 모델 선택 → 확인 → 삭제
- [ ] **/deletemodel 현재 모델**: 현재 사용 중인 모델 삭제 시도 → 에러
- [ ] **/model**: 모델 선택 → 전환 → 대화 재시작
- [ ] **/reset**: 전체 초기화 확인 → 리셋 → 프로그램 종료
- [ ] **기존 config init 제거**: `open config init` 명령어 없음 확인

---

## 2.11 TODO 완료 시 자동 Save

### 목표
Plan-and-Execute 모드에서 각 TODO 완료 시 자동으로 세션 저장

### 배경
- TODO가 완료될 때마다 진행 상황을 저장
- 중단되어도 완료된 TODO는 보존
- 재시작 시 마지막 완료 시점부터 재개
- 데이터 손실 방지
- 사용자가 수동으로 저장하지 않아도 자동으로 백업

### Architecture

**자동 저장 트리거**:
```
TODO 실행 시작
    ↓
TODO 진행 중 (in_progress)
    ↓
LLM 작업 수행...
    ↓
TODO 완료 (completed)
    ↓
✅ Auto-save session ← 여기서 자동 저장
    ↓
다음 TODO 실행
```

**저장 내용**:
- 완료된 TODO 목록 (status, result, timestamps)
- 현재 TODO 상태
- 대화 메시지 히스토리
- 메타데이터 (타임스탬프, 모델 정보, 진행률)

**저장 빈도**:
- 각 TODO 완료 시마다 (증분 저장)
- TODO 실패 시에도 저장 (에러 정보 포함)
- 사용자가 /save 입력 시 수동 저장 가능

### Implementation

**파일**: `src/types/index.ts`

```typescript
export interface TodoItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  requiresDocsSearch: boolean;
  dependencies: string[];
  result?: string;
  error?: string;
  startedAt?: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
}

export interface SessionData {
  sessionId: string;
  messages: Message[];
  todos?: TodoItem[]; // ← Plan-and-Execute mode
  timestamp: string;
  metadata: {
    model: string;
    mode: ExecutionMode;
    completedTodos?: number;
    totalTodos?: number;
    lastTodoCompleted?: string; // TODO title
  };
}
```

**파일**: `src/core/todo-executor.ts`

```typescript
import { sessionManager } from './session-manager.js';
import { LLMClient } from './llm-client.js';
import { Message, TodoItem } from '../types/index.js';
import { executeDocsSearchAgent } from './docs-search-agent.js';

export class TodoExecutor {
  private llmClient: LLMClient;
  private sessionId: string;

  constructor(llmClient: LLMClient, sessionId: string) {
    this.llmClient = llmClient;
    this.sessionId = sessionId;
  }

  /**
   * TODO 실행
   */
  async executeTodo(
    todo: TodoItem,
    messages: Message[],
    allTodos: TodoItem[]
  ): Promise<{ messages: Message[]; todo: TodoItem }> {
    // 1. TODO 상태 변경: pending → in_progress
    todo.status = 'in_progress';
    todo.startedAt = new Date().toISOString();

    // 진행 상황 저장 (선택사항)
    await this.autoSave(messages, allTodos);

    try {
      // 2. Docs Search (선행)
      if (todo.requiresDocsSearch) {
        console.log(`[TodoExecutor] Running Docs Search for TODO: ${todo.title}`);
        const searchResult = await executeDocsSearchAgent(
          this.llmClient,
          todo.description
        );

        if (searchResult.success) {
          // 검색 결과를 메시지에 추가
          messages.push({
            role: 'system',
            content: `Docs Search Result:\n${searchResult.result}`,
          });
        }
      }

      // 3. Main LLM 실행 (Tools 포함)
      console.log(`[TodoExecutor] Executing TODO: ${todo.title}`);

      const result = await this.llmClient.chatCompletionWithTools(
        { messages },
        FILE_TOOLS,
        10 // max iterations
      );

      // 4. TODO 완료
      todo.status = 'completed';
      todo.completedAt = new Date().toISOString();
      todo.result = result.content;

      // Assistant 메시지 추가
      messages.push({
        role: 'assistant',
        content: result.content,
      });

      // ✅ 5. 자동 저장 (중요!)
      console.log(`[TodoExecutor] TODO completed, auto-saving session...`);
      await this.autoSave(messages, allTodos);

      return { messages, todo };
    } catch (error: any) {
      // 에러 발생 시에도 저장
      todo.status = 'failed';
      todo.error = error.message;
      todo.completedAt = new Date().toISOString();

      console.error(`[TodoExecutor] TODO failed: ${error.message}`);
      await this.autoSave(messages, allTodos);

      throw error;
    }
  }

  /**
   * 자동 저장 (증분 저장)
   */
  private async autoSave(messages: Message[], todos: TodoItem[]): Promise<void> {
    try {
      const completedTodos = todos.filter((t) => t.status === 'completed').length;
      const lastCompleted = todos
        .filter((t) => t.status === 'completed')
        .pop();

      await sessionManager.saveSession(this.sessionId, {
        sessionId: this.sessionId,
        messages,
        todos,
        timestamp: new Date().toISOString(),
        metadata: {
          model: this.llmClient.model,
          mode: 'ask', // 현재 모드
          completedTodos,
          totalTodos: todos.length,
          lastTodoCompleted: lastCompleted?.title,
        },
      });

      console.log(
        `[TodoExecutor] Session auto-saved (${completedTodos}/${todos.length} todos completed)`
      );
    } catch (error: any) {
      console.error(`[TodoExecutor] Auto-save failed: ${error.message}`);
      // 에러 발생해도 계속 진행 (저장 실패가 실행을 막으면 안 됨)
    }
  }
}
```

**파일**: `src/core/session-manager.ts`

```typescript
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SessionData, TodoItem, Message } from '../types/index.js';

export class SessionManager {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = path.join(os.homedir(), '.open-cli', 'sessions');
    fs.mkdirSync(this.sessionsDir, { recursive: true });
  }

  /**
   * 세션 저장 (증분 저장)
   */
  async saveSession(sessionId: string, data: SessionData): Promise<void> {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    try {
      // 기존 데이터와 병합 (incremental save)
      let existingData: SessionData | null = null;
      if (fs.existsSync(sessionPath)) {
        existingData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      }

      const mergedData: SessionData = {
        ...existingData,
        ...data,
        timestamp: new Date().toISOString(), // 항상 최신 타임스탬프
      };

      fs.writeFileSync(sessionPath, JSON.stringify(mergedData, null, 2), 'utf-8');

      console.log(`[SessionManager] Session saved: ${sessionId}`);
    } catch (error: any) {
      console.error(`[SessionManager] Failed to save session: ${error.message}`);
      throw error;
    }
  }

  /**
   * 세션 불러오기
   */
  async loadSession(sessionId: string): Promise<SessionData | null> {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    if (!fs.existsSync(sessionPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    } catch (error: any) {
      console.error(`[SessionManager] Failed to load session: ${error.message}`);
      return null;
    }
  }

  /**
   * 세션 복구 (TODO 포함)
   */
  async recoverSession(sessionId: string): Promise<{
    messages: Message[];
    todos: TodoItem[];
    nextTodoIndex: number;
  } | null> {
    const session = await this.loadSession(sessionId);

    if (!session || !session.todos) {
      return null;
    }

    // 다음 실행할 TODO 찾기 (pending 또는 failed)
    const nextTodoIndex = session.todos.findIndex(
      (t) => t.status === 'pending' || t.status === 'failed'
    );

    return {
      messages: session.messages,
      todos: session.todos,
      nextTodoIndex: nextTodoIndex === -1 ? session.todos.length : nextTodoIndex,
    };
  }

  /**
   * 모든 세션 목록
   */
  async listSessions(): Promise<
    Array<{ sessionId: string; timestamp: string; metadata?: any }>
  > {
    try {
      const files = fs.readdirSync(this.sessionsDir);
      const sessions = files
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
          const sessionPath = path.join(this.sessionsDir, file);
          const data: SessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
          return {
            sessionId: data.sessionId,
            timestamp: data.timestamp,
            metadata: data.metadata,
          };
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return sessions;
    } catch (error: any) {
      console.error(`[SessionManager] Failed to list sessions: ${error.message}`);
      return [];
    }
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
      console.log(`[SessionManager] Session deleted: ${sessionId}`);
    }
  }
}

export const sessionManager = new SessionManager();
```

### Session Recovery Flow

**CLI 시작 시 세션 감지**:

```typescript
// src/cli.ts

async function main() {
  // ...

  // 이전 세션 감지
  const sessions = await sessionManager.listSessions();
  const latestSession = sessions[0];

  if (latestSession && latestSession.metadata?.todos) {
    const completed = latestSession.metadata.completedTodos || 0;
    const total = latestSession.metadata.totalTodos || 0;

    if (completed < total) {
      // 미완료 TODO가 있음
      console.log('\n┌────────────────────────────────────────────┐');
      console.log(`│ 💾 Session found: ${latestSession.sessionId.slice(0, 20)}...  │`);
      console.log('│                                            │');
      console.log(`│ Progress: ${completed}/${total} TODO completed              │`);
      console.log(`│ Last TODO: "${latestSession.metadata.lastTodoCompleted?.slice(0, 30)}..." │`);
      console.log('│                                            │');
      console.log('└────────────────────────────────────────────┘');

      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'resume',
          message: 'Resume this session?',
          default: true,
        },
      ]);

      if (answer.resume) {
        // 세션 복구
        const recovered = await sessionManager.recoverSession(latestSession.sessionId);

        if (recovered) {
          console.log('\n✅ Session recovered! Resuming from TODO #' + (recovered.nextTodoIndex + 1) + '\n');

          // InteractiveMode에 복구된 데이터 전달
          await startInteractiveMode({
            messages: recovered.messages,
            todos: recovered.todos,
            resumeFromIndex: recovered.nextTodoIndex,
          });

          return;
        }
      } else {
        console.log('\nStarting fresh session...\n');
      }
    }
  }

  // 정상 시작
  await startInteractiveMode();
}
```

**복구 후 UI**:

```
📋 TODO List (3/5 completed)
├──────────────────────────────────────────┤
│ ✓ 1. TypeScript 프로젝트 설정 조사         │
│ ✓ 2. Express.js 설치 및 초기 설정         │
│ ✓ 3. 기본 라우트 구조 생성                │
│ → 4. API 엔드포인트 구현 (resuming...)    │
│ ☐ 5. 테스트 코드 작성                     │
└────────────────────────────────────────────┘

Resuming TODO 4: API 엔드포인트 구현

🤖 Assistant: Let's implement the API endpoints...
```

### UI Feedback (선택사항)

**저장 인디케이터** (StatusBar):

```
┌────────────────────────────────────────────────────────────┐
│ Model: gemini-2.0-flash | 💾 Saved 2s ago | Context: 12.5K │
└────────────────────────────────────────────────────────────┘
```

또는 TODO 완료 시 알림:

```
✓ 3. 기본 라우트 구조 생성 (completed) 💾 Auto-saved
```

### Testing Scenarios

- [ ] **TODO 완료 → 저장**: TODO 완료 → 세션 파일 생성/업데이트 확인
- [ ] **중단 → 복구**: TODO 3개 중 2개 완료 → 프로그램 종료 → 재시작 → 복구 프롬프트 → TODO 3부터 재개
- [ ] **여러 TODO 연속**: 5개 TODO → 각각 완료 시마다 저장 → 세션 파일에 todos 배열 확인
- [ ] **TODO 실패 → 저장**: TODO 실패 (에러) → 에러 정보 포함하여 저장
- [ ] **복구 거부**: 복구 프롬프트 → n 입력 → 새 세션 시작
- [ ] **세션 목록**: /sessions 명령어 → 저장된 세션 목록 표시

---

**Last Updated**: 2025-11-05
**Document Version**: 1.0
