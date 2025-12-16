/**
 * Orchestration Utilities
 *
 * Plan & Execute 워크플로우의 헬퍼 함수들
 */

import { TodoItem } from '../types/index.js';
import { BaseError } from '../errors/base.js';
import { logger } from '../utils/logger.js';

/**
 * 에러를 표시용 문자열로 포맷
 */
export function formatErrorMessage(error: unknown): string {
  logger.enter('formatErrorMessage');

  if (error instanceof BaseError) {
    let message = `❌ ${error.getUserMessage()}\n`;
    message += `\n📋 Error Code: ${error.code}`;

    if (error.details && Object.keys(error.details).length > 0) {
      message += `\n\n🔍 Details:`;
      for (const [key, value] of Object.entries(error.details)) {
        if (key === 'fullError') continue;
        if (typeof value === 'object') {
          message += `\n  • ${key}: ${JSON.stringify(value, null, 2)}`;
        } else {
          message += `\n  • ${key}: ${value}`;
        }
      }
    }

    if (error.isRecoverable) {
      message += `\n\n💡 이 오류는 복구 가능합니다. 다시 시도해보세요.`;
    }

    message += `\n\n🕐 시간: ${error.timestamp.toLocaleString('ko-KR')}`;
    logger.exit('formatErrorMessage', { isBaseError: true });
    return message;
  }

  if (error instanceof Error) {
    let message = `❌ Error: ${error.message}\n`;
    if (error.stack) {
      message += `\n📚 Stack Trace:\n${error.stack}`;
    }
    logger.exit('formatErrorMessage', { isError: true });
    return message;
  }

  logger.exit('formatErrorMessage', { isUnknown: true });
  return `❌ Unknown Error: ${String(error)}`;
}

/**
 * TODO 컨텍스트를 LLM용으로 빌드
 * 대화 기록에 저장되지 않고 LLM 호출시에만 추가됨
 */
export function buildTodoContext(todos: TodoItem[]): string {
  if (todos.length === 0) return '';

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
  const pendingCount = todos.filter(t => t.status === 'pending').length;

  const todoList = todos.map((todo, idx) => {
    const statusIcon = todo.status === 'completed' ? '✅' :
                       todo.status === 'in_progress' ? '🔄' :
                       todo.status === 'failed' ? '❌' : '⏳';
    const detail = todo.status === 'in_progress' || todo.status === 'pending'
      ? `\n   Description: ${todo.description || 'No description'}`
      : '';
    return `${idx + 1}. ${statusIcon} [${todo.status.toUpperCase()}] ${todo.title}${detail}`;
  }).join('\n');

  return `
---
## 📋 Current TODO List (${completedCount}/${todos.length} completed)

${todoList}

${pendingCount > 0 || inProgressCount > 0
  ? '**Continue working on the TODO list. Update status using update_todos tool.**'
  : '**All TODOs are completed! Provide a brief summary of what was accomplished.**'}
---`;
}

/**
 * 모든 TODO가 완료되었는지 확인
 * 빈 배열은 완료로 간주
 */
export function areAllTodosCompleted(todos: TodoItem[]): boolean {
  return todos.every(t => t.status === 'completed' || t.status === 'failed');
}

/**
 * 현재 진행중이거나 대기중인 TODO 찾기
 */
export function findActiveTodo(todos: TodoItem[]): TodoItem | undefined {
  return todos.find(t => t.status === 'in_progress') || todos.find(t => t.status === 'pending');
}

/**
 * TODO 통계 계산
 */
export function getTodoStats(todos: TodoItem[]): {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  inProgress: number;
} {
  return {
    total: todos.length,
    completed: todos.filter(t => t.status === 'completed').length,
    failed: todos.filter(t => t.status === 'failed').length,
    pending: todos.filter(t => t.status === 'pending').length,
    inProgress: todos.filter(t => t.status === 'in_progress').length,
  };
}
