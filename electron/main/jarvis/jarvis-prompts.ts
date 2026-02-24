/**
 * Jarvis Mode - Manager LLM Prompts
 *
 * Manager LLM은 '매니저'로서 직접 코드를 작성하지 않고,
 * Planner/Executor에게 일을 위임하고 결과를 관리한다.
 */

import type { JarvisMemoryEntry } from './jarvis-types';

// =============================================================================
// Manager LLM System Prompt
// =============================================================================

export const JARVIS_SYSTEM_PROMPT = `You are Jarvis, the user's autonomous personal assistant.

## Your Role
You are a MANAGER. You do NOT write code, create files, or execute commands directly.
You delegate work to the Planner/Executor system and manage the results.

## Your Tools

[Execution]
- delegate_to_planner: Send a detailed task description to the Planner. The Planner will create TODOs, and the Executor will use tools (file operations, shell commands, browser, etc.) to complete the task. This is BLOCKING — you wait for the full result.
  - Be as specific and detailed as possible in the task description.
  - Include context, file paths, expected outcomes.

[User Communication — 3 types, choose appropriately]
- report_to_user: Report to the user (greetings, status updates, completion notices). NON-BLOCKING — you continue immediately.
- request_approval: Ask the user for approval before proceeding. BLOCKING — you wait for OK/Cancel.
- ask_to_user: Ask the user a question. BLOCKING — you wait for their answer.

[Memory Management]
- add_memory: Add a new entry to persistent memory.
- update_memory: Update an existing memory entry by ID.
- delete_memory: Remove an outdated/incorrect memory entry by ID.

## Rules
1. You MUST use a tool every turn. Responses without tool calls are errors.
2. ONCE TODO list may have many items. Prioritize by: deadline urgency → feasibility → importance.
3. Be autonomous. Don't ask the user unnecessary questions. Decide and act.
4. After completing a task, ALWAYS review your memory and add/update/delete as needed.
5. When greeting the user, be warm and concise. Mention what you plan to work on today.
6. If the sub-LLM (Planner/Executor) asks you a question, try to answer from your memory and context first. Only escalate to the user via ask_to_user if you truly cannot answer.
7. Communicate in Korean (한국어) when talking to the user.
8. When delegating tasks, write instructions in Korean for clarity.
9. **Always provide tangible, user-visible deliverables — never just say "done".** If files were created, include the file path or open them directly. If information was retrieved, summarize the key content as text. If there are links, include them. A report the user cannot visually verify is not a report.`;

// =============================================================================
// Manager LLM Tool Definitions
// =============================================================================

export const JARVIS_MANAGER_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'delegate_to_planner',
      description: 'Planner/Executor에게 작업을 위임합니다. 최대한 구체적으로 작성하세요. Blocking — 실행 완료까지 대기합니다.',
      parameters: {
        type: 'object',
        properties: {
          task_description: {
            type: 'string',
            description: '구체적인 작업 지시. 컨텍스트, 파일 경로, 기대 결과를 포함하세요.',
          },
          working_directory: {
            type: 'string',
            description: '작업 디렉토리 경로 (선택). 기본값은 현재 디렉토리.',
          },
        },
        required: ['task_description'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'report_to_user',
      description: '사용자에게 보고합니다 (인사, 상태, 결과 알림). 비동기 — 응답 대기 없이 다음 동작.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: '사용자에게 보낼 메시지 (한국어)',
          },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'request_approval',
      description: '사용자에게 승인을 요청합니다. Blocking — OK/Cancel 응답까지 대기.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: '승인 요청 메시지 (한국어). 무엇을 할 것인지 명확히.',
          },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'ask_to_user',
      description: '사용자에게 질문합니다. Blocking — 응답까지 대기.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: '질문 내용 (한국어)',
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: '선택지 목록 (선택). 제공하면 사용자가 선택 가능.',
          },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_memory',
      description: '영구 기억에 새 항목을 추가합니다.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: '기억의 키/제목 (예: "kickoff_doc_completed", "user_prefers_markdown")',
          },
          content: {
            type: 'string',
            description: '기억 내용',
          },
        },
        required: ['key', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_memory',
      description: '기존 영구 기억을 수정합니다.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '수정할 기억의 ID',
          },
          content: {
            type: 'string',
            description: '새로운 내용',
          },
        },
        required: ['id', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_memory',
      description: '오래되었거나 부정확한 영구 기억을 삭제합니다.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '삭제할 기억의 ID',
          },
        },
        required: ['id'],
      },
    },
  },
];

// =============================================================================
// Context Builder
// =============================================================================

/**
 * Manager LLM에게 전달할 user prompt 구성
 */
export function buildManagerUserPrompt(params: {
  trigger: 'poll' | 'user_message' | 'greeting';
  userMessage?: string;
  memory: JarvisMemoryEntry[];
  onceTodos: string;
  freeWorkItems: string;
  recentConversation: string;
  currentTime: string;
  pendingMessages?: string[];
}): string {
  const parts: string[] = [];

  // 1. Jarvis Memory (Layer 1)
  if (params.memory.length > 0) {
    parts.push('<JARVIS_MEMORY>');
    for (const entry of params.memory) {
      parts.push(`[${entry.id}] ${entry.key}: ${entry.content} (updated: ${entry.updatedAt})`);
    }
    parts.push('</JARVIS_MEMORY>');
    parts.push('');
  }

  // 2. Current Data
  parts.push('<CURRENT_DATA>');
  parts.push(`현재 시각: ${params.currentTime}`);
  parts.push('');
  parts.push('ONCE TODO (할 일 목록):');
  parts.push(params.onceTodos || '(조회 실패 또는 할 일 없음)');
  parts.push('');
  parts.push('오늘 FREE 업무기록:');
  parts.push(params.freeWorkItems || '(조회 실패 또는 기록 없음)');
  parts.push('</CURRENT_DATA>');
  parts.push('');

  // 3. Recent Conversation (Layer 2)
  if (params.recentConversation) {
    parts.push('<RECENT_CONVERSATION>');
    parts.push(params.recentConversation);
    parts.push('</RECENT_CONVERSATION>');
    parts.push('');
  }

  // 4. Pending messages (실행 중 대기열에 쌓인 사용자 메시지)
  if (params.pendingMessages && params.pendingMessages.length > 0) {
    parts.push('<PENDING_USER_MESSAGES>');
    for (const msg of params.pendingMessages) {
      parts.push(`- ${msg}`);
    }
    parts.push('</PENDING_USER_MESSAGES>');
    parts.push('');
  }

  // 5. Trigger context
  if (params.trigger === 'greeting') {
    parts.push('앱이 방금 시작되었습니다. 사용자에게 인사하고 오늘 할 일을 확인해주세요.');
  } else if (params.trigger === 'poll') {
    parts.push('주기적 체크 시간입니다. 할 일 목록과 업무기록을 분석하고, 필요한 작업이 있으면 진행하세요.');
  } else if (params.trigger === 'user_message' && params.userMessage) {
    parts.push(`사용자 메시지: "${params.userMessage}"`);
  }

  return parts.join('\n');
}
