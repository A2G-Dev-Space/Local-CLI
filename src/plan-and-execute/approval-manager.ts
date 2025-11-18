/**
 * Approval Manager
 *
 * Handles user approval requests for risky operations
 * in the Plan & Execute workflow.
 *
 * This manager uses a callback-based system to integrate with Ink UI
 * instead of directly prompting (which would conflict with Ink).
 */

import { RiskAssessment } from './risk-analyzer.js';
import { TodoItem } from '../types/index.js';

export type ApprovalAction =
  | 'approve'
  | 'reject'
  | 'approve_all'
  | 'reject_all'
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
}

export interface PlanApprovalRequest {
  todos: TodoItem[];
  userRequest: string;
}

/**
 * Callback function types for showing approval prompts in the UI
 */
export type PlanApprovalCallback = (
  request: PlanApprovalRequest
) => Promise<ApprovalAction>;

export type TaskApprovalCallback = (
  request: ApprovalRequest
) => Promise<ApprovalAction>;

/**
 * Approval Manager Class
 *
 * Uses callbacks to delegate UI rendering to the parent component (Ink)
 * This avoids conflicts between inquirer and Ink's stdin management
 */
export class ApprovalManager {
  private approveAllRemaining: boolean = false;
  private rejectAllRemaining: boolean = false;
  private planApprovalCallback: PlanApprovalCallback | null = null;
  private taskApprovalCallback: TaskApprovalCallback | null = null;

  constructor(
    planCallback?: PlanApprovalCallback,
    taskCallback?: TaskApprovalCallback
  ) {
    this.planApprovalCallback = planCallback || null;
    this.taskApprovalCallback = taskCallback || null;
  }

  /**
   * Set the callback for plan approval prompts
   */
  setPlanApprovalCallback(callback: PlanApprovalCallback): void {
    this.planApprovalCallback = callback;
  }

  /**
   * Set the callback for task approval prompts
   */
  setTaskApprovalCallback(callback: TaskApprovalCallback): void {
    this.taskApprovalCallback = callback;
  }

  /**
   * Request approval for the entire plan after planning phase
   */
  async requestPlanApproval(
    request: PlanApprovalRequest
  ): Promise<ApprovalResponse> {
    if (!this.planApprovalCallback) {
      throw new Error('Plan approval callback not set. Call setPlanApprovalCallback() first.');
    }

    const action = await this.planApprovalCallback(request);

    switch (action) {
      case 'approve':
        return { action: 'approve' };
      case 'reject':
        return { action: 'reject', reason: 'User rejected the plan' };
      case 'stop':
        return { action: 'stop', reason: 'User stopped execution' };
      default:
        return { action: 'reject', reason: 'Unknown choice' };
    }
  }

  /**
   * Request approval for a single risky task
   */
  async requestTaskApproval(
    request: ApprovalRequest
  ): Promise<ApprovalResponse> {
    // Check if user already approved/rejected all
    if (this.approveAllRemaining) {
      return { action: 'approve', reason: 'Auto-approved (approve all)' };
    }

    if (this.rejectAllRemaining) {
      return { action: 'reject', reason: 'Auto-rejected (reject all)' };
    }

    if (!this.taskApprovalCallback) {
      throw new Error('Task approval callback not set. Call setTaskApprovalCallback() first.');
    }

    const action = await this.taskApprovalCallback(request);

    switch (action) {
      case 'approve':
        return { action: 'approve' };

      case 'reject':
        return { action: 'reject', reason: 'User rejected this task' };

      case 'approve_all':
        this.approveAllRemaining = true;
        return { action: 'approve_all', reason: 'User approved all remaining' };

      case 'reject_all':
        this.rejectAllRemaining = true;
        return { action: 'reject_all', reason: 'User rejected all remaining' };

      case 'stop':
        return { action: 'stop', reason: 'User stopped execution' };

      default:
        return { action: 'reject', reason: 'Unknown choice' };
    }
  }

  /**
   * Reset the approve/reject all flags
   */
  reset(): void {
    this.approveAllRemaining = false;
    this.rejectAllRemaining = false;
  }

  /**
   * Cleanup resources
   */
  close(): void {
    this.reset();
  }
}
