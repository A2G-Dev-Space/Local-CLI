/**
 * SubAgent Parallel Architecture
 *
 * Handles complex tasks through parallel multi-agent execution
 */

import {
  Task,
  ExecutionLayer,
  LayerExecutionResult,
  SubAgentTask,
  ExecutionPlan,
  SubTaskResult,
  SynthesisRequest,
  SynthesisResult,
  SubTaskDescription,
} from '../types/index.js';
import { LLMClient } from '../core/llm-client.js';
import { EventEmitter } from 'events';

export interface Agent {
  id: string;
  status: 'idle' | 'busy' | 'error';
  currentTask?: string;
  model: string;
}

export interface AgentPoolConfig {
  count: number;
  model: string;
  isolated: boolean;
}

export class TaskQueue {
  private queue: SubAgentTask[] = [];
  private completed: Map<string, SubTaskResult> = new Map();

  add(task: SubAgentTask): void {
    this.queue.push(task);
  }

  getReady(): SubAgentTask[] {
    return this.queue.filter(task => {
      if (task.status !== 'pending') return false;

      // Check if all dependencies are completed
      return task.dependencies.every(dep =>
        this.completed.has(dep)
      );
    });
  }

  markCompleted(taskId: string, result: SubTaskResult): void {
    this.completed.set(taskId, result);
    const taskIndex = this.queue.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      this.queue[taskIndex]!.status = 'completed';
      this.queue[taskIndex]!.result = result.output;
    }
  }

  getCompleted(): SubTaskResult[] {
    return Array.from(this.completed.values());
  }
}

export class AgentPool extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private availableAgents: Set<string> = new Set();
  private taskAssignments: Map<string, string> = new Map(); // taskId -> agentId

  async initialize(config: AgentPoolConfig): Promise<Agent[]> {
    const agents: Agent[] = [];

    for (let i = 0; i < config.count; i++) {
      const agent: Agent = {
        id: `agent-${i}`,
        status: 'idle',
        model: config.model
      };

      this.agents.set(agent.id, agent);
      this.availableAgents.add(agent.id);
      agents.push(agent);
    }

    return agents;
  }

  async getAvailable(): Promise<Agent> {
    // Wait for an available agent
    while (this.availableAgents.size === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const agentId = this.availableAgents.values().next().value;
    this.availableAgents.delete(agentId);

    const agent = this.agents.get(agentId)!;
    agent.status = 'busy';

    return agent;
  }

  release(agent: Agent): void {
    agent.status = 'idle';
    agent.currentTask = undefined;
    this.availableAgents.add(agent.id);
    this.emit('agent-available', agent.id);
  }

  assignTask(agentId: string, taskId: string): void {
    this.taskAssignments.set(taskId, agentId);
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.currentTask = taskId;
    }
  }

  getAgentForTask(taskId: string): Agent | undefined {
    const agentId = this.taskAssignments.get(taskId);
    return agentId ? this.agents.get(agentId) : undefined;
  }
}

export class ResultSynthesizer {
  constructor(private llmClient: LLMClient) {}

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const { subtaskResults, synthesisStrategy } = request;

    switch (synthesisStrategy) {
      case 'simple-merge':
        return this.simpleMerge(subtaskResults);

      case 'intelligent-merge':
        return await this.intelligentMerge(subtaskResults, request.task);

      case 'llm-synthesis':
        return await this.llmSynthesis(subtaskResults, request.task);

      default:
        return this.simpleMerge(subtaskResults);
    }
  }

  private simpleMerge(results: SubTaskResult[]): SynthesisResult {
    // Collect all outputs into an array
    const outputs = results.map(r => r.output);
    const allSuccessful = results.every(r => r.success);

    return {
      success: allSuccessful,
      output: outputs,
      resolutionStrategy: 'simple'
    };
  }

  private async intelligentMerge(
    results: SubTaskResult[],
    originalTask: Task
  ): Promise<SynthesisResult> {
    // 1. Detect conflicts
    const conflicts = this.detectConflicts(results);

    // 2. Resolve conflicts
    const resolved = await this.resolveConflicts(conflicts, results);

    // 3. Merge non-conflicting results
    const merged = this.mergeResults(results, resolved);

    // 4. Validate against original task
    const validation = await this.validateSynthesis(merged, originalTask);

    return {
      success: validation.valid,
      output: merged,
      conflicts: conflicts.length,
      resolutionStrategy: 'intelligent',
      validation
    };
  }

  private async llmSynthesis(
    results: SubTaskResult[],
    originalTask: Task
  ): Promise<SynthesisResult> {
    // Use LLM to synthesize results
    const prompt = `Synthesize these subtask results into a coherent response for the original task:

Original Task: ${originalTask.description}

Subtask Results:
${results.map((r, i) => `${i + 1}. Task ${r.taskId}: ${JSON.stringify(r.output)}`).join('\n')}

Provide a synthesized result that combines all subtask outputs appropriately.`;

    const response = await this.llmClient.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a result synthesizer. Combine subtask results into coherent outputs.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const synthesizedOutput = response.choices[0]?.message.content;

    return {
      success: true,
      output: synthesizedOutput,
      resolutionStrategy: 'llm-synthesis'
    };
  }

  private detectConflicts(results: SubTaskResult[]): any[] {
    const conflicts: any[] = [];

    // Simple conflict detection based on overlapping keys in outputs
    if (results.length < 2) return conflicts;

    for (let i = 0; i < results.length - 1; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const r1 = results[i];
        const r2 = results[j];

        if (r1 && r2 && typeof r1.output === 'object' && typeof r2.output === 'object') {
          const keys1 = Object.keys(r1.output);
          const keys2 = Object.keys(r2.output);
          const overlapping = keys1.filter(k => keys2.includes(k));

          for (const key of overlapping) {
            if (r1.output[key] !== r2.output[key]) {
              conflicts.push({
                key,
                task1: r1.taskId,
                value1: r1.output[key],
                task2: r2.taskId,
                value2: r2.output[key]
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  private async resolveConflicts(conflicts: any[], _results: SubTaskResult[]): Promise<any> {
    const resolutions: any = {};

    // Simple resolution: take the value from the first task
    for (const conflict of conflicts) {
      resolutions[conflict.key] = conflict.value1;
    }

    return resolutions;
  }

  private mergeResults(results: SubTaskResult[], resolutions: any): any {
    const merged: any = {};

    // Merge all results
    for (const result of results) {
      if (result.output && typeof result.output === 'object') {
        Object.assign(merged, result.output);
      }
    }

    // Apply conflict resolutions
    Object.assign(merged, resolutions);

    return merged;
  }

  private async validateSynthesis(
    _merged: any,
    _originalTask: Task
  ): Promise<{ valid: boolean; errors?: string[] }> {
    // Simple validation - could be enhanced
    return { valid: true };
  }
}

export class SubAgentLayer implements ExecutionLayer {
  name = 'subagent';
  private taskQueue: TaskQueue;
  private agentPool: AgentPool;
  private resultSynthesizer: ResultSynthesizer;
  private planningLLM: LLMClient;
  private config = {
    maxAgents: 5
  };

  constructor(llmClient: LLMClient) {
    this.taskQueue = new TaskQueue();
    this.agentPool = new AgentPool();
    this.resultSynthesizer = new ResultSynthesizer(llmClient);
    this.planningLLM = llmClient;
  }

  async canHandle(task: Task): Promise<boolean> {
    return task.complexity === 'complex' ||
           task.requiresParallelism ||
           (task.subtasks && task.subtasks.length > 3) ||
           false;
  }

  async execute(task: Task): Promise<LayerExecutionResult> {
    const startTime = Date.now();

    try {
      // 1. Decompose into subtasks
      const subtasks = await this.decomposeTask(task);

      // 2. Create execution plan with dependencies
      const executionPlan = this.createExecutionPlan(subtasks);

      // 3. Initialize agent pool
      const agents = await this.agentPool.initialize({
        count: Math.min(subtasks.length, this.config.maxAgents),
        model: task.preferredModel || 'default',
        isolated: true
      });

      // 4. Execute in parallel with dependency management
      const results = await this.executeParallel(executionPlan, agents);

      // 5. Synthesize results
      const synthesized = await this.resultSynthesizer.synthesize({
        task: task,
        subtaskResults: results,
        synthesisStrategy: task.synthesisStrategy || 'intelligent-merge'
      });

      return {
        success: synthesized.success,
        output: synthesized.output,
        layer: this.name,
        subtasks: results.length,
        parallelism: agents.length,
        executionPlan: executionPlan,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        layer: this.name,
        executionTime: Date.now() - startTime
      };
    }
  }

  private async decomposeTask(task: Task): Promise<SubAgentTask[]> {
    // Use provided subtasks or decompose using LLM
    if (task.subtasks && task.subtasks.length > 0) {
      return task.subtasks.map((st, idx) => ({
        id: `subtask-${idx}`,
        description: st.description,
        assignedAgent: '',
        dependencies: st.dependencies || [],
        status: 'pending' as const
      }));
    }

    // Use LLM to decompose
    const prompt = `Decompose this task into parallel subtasks:
Task: ${task.description}
Constraints: ${task.constraints?.join(', ') || 'none'}

Provide subtasks in JSON format:
[{"description": "...", "dependencies": []}]`;

    const response = await this.planningLLM.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a task decomposition expert. Break down complex tasks into parallelizable subtasks.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    try {
      const content = response.choices[0]?.message.content || '[]';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const decomposed = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');

      return decomposed.map((st: any, idx: number) => ({
        id: `subtask-${idx}`,
        description: st.description,
        assignedAgent: '',
        dependencies: st.dependencies || [],
        status: 'pending' as const
      }));
    } catch {
      // Fallback to single task
      return [{
        id: 'subtask-0',
        description: task.description,
        assignedAgent: '',
        dependencies: [],
        status: 'pending' as const
      }];
    }
  }

  private createExecutionPlan(subtasks: SubAgentTask[]): ExecutionPlan {
    // Group tasks by dependency level
    const batches: SubAgentTask[][] = [];
    const processed = new Set<string>();

    while (processed.size < subtasks.length) {
      const batch: SubAgentTask[] = [];

      for (const task of subtasks) {
        if (processed.has(task.id)) continue;

        // Check if all dependencies are processed
        if (task.dependencies.every(dep => processed.has(dep))) {
          batch.push(task);
        }
      }

      if (batch.length === 0 && processed.size < subtasks.length) {
        // Circular dependency or error - add remaining tasks
        for (const task of subtasks) {
          if (!processed.has(task.id)) {
            batch.push(task);
          }
        }
      }

      if (batch.length > 0) {
        batches.push(batch);
        batch.forEach(t => processed.add(t.id));
      }
    }

    return {
      executionBatches: batches,
      totalTasks: subtasks.length,
      estimatedTime: batches.length * 5000 // Rough estimate
    };
  }

  private async executeParallel(
    plan: ExecutionPlan,
    agents: Agent[]
  ): Promise<SubTaskResult[]> {
    const results: SubTaskResult[] = [];

    for (const batch of plan.executionBatches) {
      // Execute batch in parallel
      const batchPromises = batch.map(async (subtask) => {
        // Get available agent
        const agent = await this.agentPool.getAvailable();
        this.agentPool.assignTask(agent.id, subtask.id);

        try {
          // Execute subtask (simplified - would use actual agent execution)
          const result = await this.executeSubtask(subtask, agent);
          this.taskQueue.markCompleted(subtask.id, result);
          return result;
        } finally {
          // Release agent back to pool
          this.agentPool.release(agent);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  private async executeSubtask(
    subtask: SubAgentTask,
    agent: Agent
  ): Promise<SubTaskResult> {
    const startTime = Date.now();

    try {
      // Simulate subtask execution (in real implementation, would use agent)
      const response = await this.planningLLM.chatCompletion({
        messages: [
          {
            role: 'system',
            content: `You are agent ${agent.id}. Execute this subtask and provide the result.`
          },
          { role: 'user', content: subtask.description }
        ],
        model: agent.model,
        temperature: 0.5,
        max_tokens: 500
      });

      return {
        taskId: subtask.id,
        success: true,
        output: response.choices[0]?.message.content,
        executionTime: Date.now() - startTime,
        agentId: agent.id
      };
    } catch (error: any) {
      return {
        taskId: subtask.id,
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
        agentId: agent.id
      };
    }
  }
}

export default SubAgentLayer;