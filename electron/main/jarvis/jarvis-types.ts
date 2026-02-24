/**
 * Jarvis Mode - Types
 *
 * Jarvis는 자율적으로 동작하는 비서 모드.
 * ONCE TODO + FREE 업무기록을 주기적으로 확인하고,
 * Manager LLM이 자율 판단하여 작업을 실행/보고/질문한다.
 */

// =============================================================================
// Config
// =============================================================================

export interface JarvisConfig {
  /** 마스터 토글 (default: false) */
  enabled: boolean;
  /** 체크 주기 - 분 단위 (default: 30, range: 5~120) */
  pollIntervalMinutes: number;
  /** Windows 부팅 시 자동 시작 (default: true when enabled) */
  autoStartOnBoot: boolean;
  /** Jarvis 전용 모델 ID (미설정 시 Electron 현재 모델 공유) */
  modelId?: string;
  /** Jarvis 전용 엔드포인트 ID (미설정 시 Electron 현재 엔드포인트 공유) */
  endpointId?: string;
}

export const DEFAULT_JARVIS_CONFIG: JarvisConfig = {
  enabled: false,
  pollIntervalMinutes: 30,
  autoStartOnBoot: true,
};

// =============================================================================
// Manager LLM Tool Types
// =============================================================================

/** Manager가 Planner에게 위임하는 작업 */
export interface DelegationResult {
  success: boolean;
  response: string;
  toolCalls: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: string;
    success: boolean;
  }>;
  iterations: number;
  error?: string;
}

/** Manager의 사용자 커뮤니케이션 — report (비동기, 대기 없음) */
export interface JarvisReport {
  type: 'report';
  message: string;
}

/** Manager의 사용자 커뮤니케이션 — 승인 요청 (blocking) */
export interface JarvisApprovalRequest {
  type: 'approval';
  id: string;
  message: string;
}

export interface JarvisApprovalResponse {
  approved: boolean;
}

/** Manager의 사용자 커뮤니케이션 — 질문 (blocking) */
export interface JarvisQuestion {
  type: 'question';
  id: string;
  question: string;
  options?: string[];
}

export interface JarvisQuestionResponse {
  answer: string;
}

// =============================================================================
// Memory (Layer 1 — 영구 기억)
// =============================================================================

export interface JarvisMemoryEntry {
  id: string;
  key: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface JarvisMemory {
  entries: JarvisMemoryEntry[];
  lastGreeting: string;
  lastPollTime: string;
}

export const DEFAULT_JARVIS_MEMORY: JarvisMemory = {
  entries: [],
  lastGreeting: '',
  lastPollTime: '',
};

// =============================================================================
// Service State
// =============================================================================

export type JarvisStatus = 'idle' | 'polling' | 'analyzing' | 'executing' | 'waiting_user';

export interface JarvisState {
  status: JarvisStatus;
  isRunning: boolean;
  lastPollTime: string | null;
  nextPollTime: string | null;
  currentTask: string | null;
}

// =============================================================================
// Chat Message (Jarvis UI용)
// =============================================================================

export type JarvisChatMessageType =
  | 'jarvis'           // Jarvis 말풍선
  | 'user'             // 사용자 말풍선
  | 'approval_request' // 승인 요청 카드
  | 'question'         // 질문 카드
  | 'execution_status' // 실행 상태 표시
  | 'system';          // 시스템 메시지

export interface JarvisChatMessage {
  id: string;
  type: JarvisChatMessageType;
  content: string;
  timestamp: number;
  /** approval/question 용 */
  requestId?: string;
  options?: string[];
  /** 사용자 응답 완료 여부 */
  resolved?: boolean;
  resolvedValue?: string;
}
