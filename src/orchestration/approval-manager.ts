/**
 * Approval Manager
 *
 * Handles user approval requests for risky operations
 * in the Plan & Execute workflow.
 *
 * Phase 2: 승인 모드
 * - 승인: 이 작업 실행
 * - 승인 (항상 허용): 이 패턴 항상 허용
 * - 거부 + 코멘트: 피드백과 함께 거부
 */

import { RiskAssessment } from './risk-analyzer.js';
import { TodoItem } from '../types/index.js';
import { logger } from '../utils/logger.js';

export type ApprovalAction =
  | 'approve'
  | 'approve_always'
  | 'reject_with_comment'
  | 'stop';

export interface ApprovalRequest {
  taskId: string;
  taskDescription: string;
  risk: RiskAssessment;
  context?: string;
}

export interface ApprovalResponse {
  action: ApprovalAction;
  reason?: string;
  comment?: string;
}

export interface PlanApprovalRequest {
  todos: TodoItem[];
  userRequest: string;
}

/**
 * Callback function types for showing approval prompts in the UI
 * Returns action string that may include comment: "reject_with_comment:user comment here"
 */
export type PlanApprovalCallback = (
  request: PlanApprovalRequest
) => Promise<ApprovalAction | string>;

export type TaskApprovalCallback = (
  request: ApprovalRequest
) => Promise<ApprovalAction | string>;

/**
 * Parse approval response that may include comment
 * Format: "action" or "action:comment"
 */
function parseApprovalResponse(response: string): { action: ApprovalAction; comment?: string } {
  const colonIndex = response.indexOf(':');
  if (colonIndex === -1) {
    return { action: response as ApprovalAction };
  }

  const action = response.substring(0, colonIndex) as ApprovalAction;
  const comment = response.substring(colonIndex + 1);
  return { action, comment };
}

/**
 * Approval Manager Class
 *
 * Uses callbacks to delegate UI rendering to the parent component (Ink)
 * This avoids conflicts between inquirer and Ink's stdin management
 */
export class ApprovalManager {
  private approvedPatterns: Set<string> = new Set();
  private planApprovalCallback: PlanApprovalCallback | null = null;
  private taskApprovalCallback: TaskApprovalCallback | null = null;

  constructor(
    planCallback?: PlanApprovalCallback,
    taskCallback?: TaskApprovalCallback
  ) {
    logger.enter('ApprovalManager.constructor');
    this.planApprovalCallback = planCallback || null;
    this.taskApprovalCallback = taskCallback || null;
    logger.exit('ApprovalManager.constructor');
  }

  /**
   * Set the callback for plan approval prompts
   */
  setPlanApprovalCallback(callback: PlanApprovalCallback): void {
    logger.flow('Setting plan approval callback');
    this.planApprovalCallback = callback;
  }

  /**
   * Set the callback for task approval prompts
   */
  setTaskApprovalCallback(callback: TaskApprovalCallback): void {
    logger.flow('Setting task approval callback');
    this.taskApprovalCallback = callback;
  }

  /**
   * Request approval for the entire plan after planning phase
   */
  async requestPlanApproval(
    request: PlanApprovalRequest
  ): Promise<ApprovalResponse> {
    logger.enter('ApprovalManager.requestPlanApproval', { todoCount: request.todos.length });

    if (!this.planApprovalCallback) {
      throw new Error('Plan approval callback not set. Call setPlanApprovalCallback() first.');
    }

    const rawResponse = await this.planApprovalCallback(request);
    const { action, comment } = parseApprovalResponse(rawResponse);

    logger.vars(
      { name: 'action', value: action },
      { name: 'hasComment', value: !!comment }
    );

    switch (action) {
      case 'approve':
        logger.exit('ApprovalManager.requestPlanApproval', { action: 'approve' });
        return { action: 'approve' };

      case 'approve_always':
        // Store pattern for future auto-approval
        const planPattern = this.generatePlanPattern(request);
        this.approvedPatterns.add(planPattern);
        logger.info('Plan pattern added to approved list', { pattern: planPattern });
        logger.exit('ApprovalManager.requestPlanApproval', { action: 'approve_always' });
        return { action: 'approve_always', reason: 'Pattern approved for future use' };

      case 'reject_with_comment':
        logger.exit('ApprovalManager.requestPlanApproval', { action: 'reject_with_comment' });
        return {
          action: 'reject_with_comment',
          reason: 'User rejected with feedback',
          comment: comment,
        };

      case 'stop':
        logger.exit('ApprovalManager.requestPlanApproval', { action: 'stop' });
        return { action: 'stop', reason: 'User stopped execution' };

      default:
        logger.exit('ApprovalManager.requestPlanApproval', { action: 'unknown' });
        return { action: 'reject_with_comment', reason: 'Unknown choice' };
    }
  }

  /**
   * Request approval for a single risky task
   */
  async requestTaskApproval(
    request: ApprovalRequest
  ): Promise<ApprovalResponse> {
    logger.enter('ApprovalManager.requestTaskApproval', { taskId: request.taskId });

    // Check if this pattern is already approved
    const taskPattern = this.generateTaskPattern(request);
    if (this.approvedPatterns.has(taskPattern)) {
      logger.info('Task auto-approved by pattern', { pattern: taskPattern });
      return { action: 'approve', reason: 'Auto-approved (pattern match)' };
    }

    if (!this.taskApprovalCallback) {
      throw new Error('Task approval callback not set. Call setTaskApprovalCallback() first.');
    }

    const rawResponse = await this.taskApprovalCallback(request);
    const { action, comment } = parseApprovalResponse(rawResponse);

    logger.vars(
      { name: 'action', value: action },
      { name: 'hasComment', value: !!comment }
    );

    switch (action) {
      case 'approve':
        logger.exit('ApprovalManager.requestTaskApproval', { action: 'approve' });
        return { action: 'approve' };

      case 'approve_always':
        // Store pattern for future auto-approval
        this.approvedPatterns.add(taskPattern);
        logger.info('Task pattern added to approved list', { pattern: taskPattern });
        logger.exit('ApprovalManager.requestTaskApproval', { action: 'approve_always' });
        return { action: 'approve_always', reason: 'Pattern approved for future use' };

      case 'reject_with_comment':
        logger.exit('ApprovalManager.requestTaskApproval', { action: 'reject_with_comment' });
        return {
          action: 'reject_with_comment',
          reason: 'User rejected with feedback',
          comment: comment,
        };

      case 'stop':
        logger.exit('ApprovalManager.requestTaskApproval', { action: 'stop' });
        return { action: 'stop', reason: 'User stopped execution' };

      default:
        logger.exit('ApprovalManager.requestTaskApproval', { action: 'unknown' });
        return { action: 'reject_with_comment', reason: 'Unknown choice' };
    }
  }

  /**
   * Generate a pattern string for plan-level approval
   */
  private generatePlanPattern(request: PlanApprovalRequest): string {
    // Simple pattern: based on todo count and first todo type
    const firstTodo = request.todos[0];
    return `plan:${request.todos.length}:${firstTodo?.title?.substring(0, 20) || 'unknown'}`;
  }

  /**
   * Generate a pattern string for task-level approval
   */
  private generateTaskPattern(request: ApprovalRequest): string {
    // Pattern based on risk category and level
    return `task:${request.risk.category}:${request.risk.level}`;
  }

  /**
   * Check if a pattern is already approved
   */
  isPatternApproved(pattern: string): boolean {
    return this.approvedPatterns.has(pattern);
  }

  /**
   * Get all approved patterns
   */
  getApprovedPatterns(): string[] {
    return Array.from(this.approvedPatterns);
  }

  /**
   * Reset the approval state
   */
  reset(): void {
    logger.flow('Resetting approval manager state');
    // Note: We keep approved patterns across resets for "항상 허용" functionality
  }

  /**
   * Clear all approved patterns
   */
  clearApprovedPatterns(): void {
    logger.flow('Clearing all approved patterns');
    this.approvedPatterns.clear();
  }

  /**
   * Cleanup resources
   */
  close(): void {
    logger.flow('Closing approval manager');
    this.reset();
  }
}
