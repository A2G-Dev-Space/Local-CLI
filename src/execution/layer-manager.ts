/**
 * Execution Layer Manager
 *
 * Orchestrates task execution across all available layers
 */

import {
  Task,
  ExecutionLayer,
  LayerExecutionResult,
  TaskAnalysis,
} from '../types/index.js';
import { LLMClient } from '../core/llm-client.js';
import { StandardToolLayer } from './standard-tools.js';
import { SDKLayer } from './sdk-layer.js';
import { SubAgentLayer } from './subagent-layer.js';
import { SkillsLayer } from './skills-layer.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ExecutionMetrics {
  task: string;
  layer: string;
  success: boolean;
  executionTime: number;
  complexity: number;
  timestamp: string;
  error?: string;
}

export interface LayerStatistics {
  layerName: string;
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  lastUsed: string;
}

export class ExecutionLayerManager {
  private layers: ExecutionLayer[] = [];
  private metrics: ExecutionMetrics[] = [];
  private metricsFile = './metrics/execution-metrics.json';
  private maxMetricsHistory = 1000;

  constructor(llmClient: LLMClient) {
    // Initialize layers in order of complexity
    this.layers = [
      new StandardToolLayer(),
      new SDKLayer(llmClient),
      new SubAgentLayer(llmClient),
      new SkillsLayer(llmClient)
    ];

    // Load historical metrics
    this.loadMetrics();
  }

  /**
   * Execute a task using the appropriate layer
   */
  async execute(task: Task): Promise<LayerExecutionResult> {
    const startTime = Date.now();

    // 1. Analyze task complexity
    const analysis = await this.analyzeTask(task);

    console.log(`📊 Task Analysis:
    - Complexity: ${analysis.complexity}/10
    - Estimated Time: ${analysis.estimatedTime}ms
    - Required Capabilities: ${analysis.requiredCapabilities.join(', ')}
    - Recommended Layer: ${analysis.recommendedLayer}`);

    // 2. Try to find suitable layer
    let result: LayerExecutionResult | null = null;
    let selectedLayer: ExecutionLayer | null = null;

    // First try recommended layer
    const recommendedLayer = this.layers.find(l => l.name === analysis.recommendedLayer);
    if (recommendedLayer && await recommendedLayer.canHandle(task)) {
      selectedLayer = recommendedLayer;
    } else {
      // Fall back to checking all layers
      for (const layer of this.layers) {
        if (await layer.canHandle(task)) {
          selectedLayer = layer;
          break;
        }
      }
    }

    if (!selectedLayer) {
      result = {
        success: false,
        error: 'No suitable execution layer found for task',
        layer: 'none',
        executionTime: Date.now() - startTime
      };
    } else {
      console.log(`🎯 Executing task with ${selectedLayer.name} layer`);

      // 3. Execute with monitoring
      result = await this.executeWithMonitoring(selectedLayer, task);
    }

    // 4. Record metrics
    await this.recordMetrics({
      task: task.id,
      layer: selectedLayer?.name || 'none',
      success: result.success,
      executionTime: result.executionTime || (Date.now() - startTime),
      complexity: analysis.complexity,
      timestamp: new Date().toISOString(),
      error: result.error ? String(result.error) : undefined
    });

    // 5. Log execution summary
    console.log(`\n📈 Execution Summary:
    - Layer: ${result.layer}
    - Success: ${result.success}
    - Execution Time: ${result.executionTime}ms
    ${result.error ? `- Error: ${result.error}` : ''}
    ${result.subtasks ? `- Subtasks: ${result.subtasks}` : ''}
    ${result.parallelism ? `- Parallelism: ${result.parallelism}` : ''}
    ${result.skillUsed ? `- Skill Used: ${result.skillUsed}` : ''}`);

    return result;
  }

  /**
   * Analyze task to determine complexity and requirements
   */
  private async analyzeTask(task: Task): Promise<TaskAnalysis> {
    const complexity = this.calculateComplexity(task);
    const estimatedTime = this.estimateTime(task);
    const requiredCapabilities = this.identifyCapabilities(task);
    const recommendedLayer = this.recommendLayer(task);

    return {
      complexity,
      estimatedTime,
      requiredCapabilities,
      recommendedLayer
    };
  }

  /**
   * Calculate task complexity (0-10 scale)
   */
  private calculateComplexity(task: Task): number {
    let complexity = 0;

    // Base complexity from task.complexity
    switch (task.complexity) {
      case 'simple': complexity = 2; break;
      case 'moderate': complexity = 5; break;
      case 'complex': complexity = 7; break;
      case 'meta': complexity = 9; break;
    }

    // Adjust based on requirements
    if (task.requiresDynamicCode) complexity += 2;
    if (task.requiresSystemAccess) complexity += 1;
    if (task.requiresParallelism) complexity += 2;
    if (task.requiresSkill) complexity += 1;
    if (task.requiresBehaviorChange) complexity += 2;

    // Adjust based on subtasks
    if (task.subtasks && task.subtasks.length > 0) {
      complexity += Math.min(task.subtasks.length * 0.5, 3);
    }

    // Adjust based on workflow complexity
    switch (task.workflowComplexity) {
      case 'high': complexity += 2; break;
      case 'medium': complexity += 1; break;
    }

    return Math.min(complexity, 10);
  }

  /**
   * Estimate execution time
   */
  private estimateTime(task: Task): number {
    let baseTime = 1000; // 1 second base

    // Adjust based on complexity
    const complexity = this.calculateComplexity(task);
    baseTime *= (1 + complexity * 0.5);

    // Adjust for specific requirements
    if (task.requiresDynamicCode) baseTime += 5000;
    if (task.requiresSystemAccess) baseTime += 2000;
    if (task.requiresParallelism) baseTime += 3000;
    if (task.subtasks) baseTime += task.subtasks.length * 1000;

    // Use task timeout if specified
    if (task.timeout) {
      baseTime = Math.min(baseTime, task.timeout);
    }

    return Math.round(baseTime);
  }

  /**
   * Identify required capabilities
   */
  private identifyCapabilities(task: Task): string[] {
    const capabilities: string[] = [];

    if (task.requiresTools.length > 0) {
      capabilities.push('tools');
    }
    if (task.requiresDynamicCode) {
      capabilities.push('code-generation');
    }
    if (task.requiresSystemAccess) {
      capabilities.push('system-access');
    }
    if (task.requiresParallelism) {
      capabilities.push('parallel-execution');
    }
    if (task.requiresSkill) {
      capabilities.push('behavior-modification');
    }

    return capabilities;
  }

  /**
   * Recommend the best layer for the task
   */
  private recommendLayer(task: Task): string {
    // Skills layer for meta tasks
    if (task.complexity === 'meta' || task.requiresSkill || task.requiresBehaviorChange) {
      return 'skills';
    }

    // SubAgent layer for complex parallel tasks
    if (task.complexity === 'complex' || task.requiresParallelism ||
        (task.subtasks && task.subtasks.length > 3)) {
      return 'subagent';
    }

    // SDK layer for dynamic code or system access
    if (task.requiresDynamicCode || task.requiresSystemAccess ||
        task.complexity === 'moderate') {
      return 'sdk-dynamic';
    }

    // Standard tools for simple tasks
    return 'standard-tools';
  }

  /**
   * Execute with monitoring and error handling
   */
  private async executeWithMonitoring(
    layer: ExecutionLayer,
    task: Task
  ): Promise<LayerExecutionResult> {
    const timeoutMs = task.timeout || 60000; // Default 60 seconds

    try {
      // Create execution promise with timeout
      const executionPromise = layer.execute(task);
      const timeoutPromise = new Promise<LayerExecutionResult>((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout')), timeoutMs);
      });

      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
        layer: layer.name,
        executionTime: timeoutMs
      };
    }
  }

  /**
   * Record execution metrics
   */
  private async recordMetrics(metric: ExecutionMetrics): Promise<void> {
    this.metrics.push(metric);

    // Keep only recent metrics in memory
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Save to file
    try {
      const metricsDir = path.dirname(this.metricsFile);
      await fs.mkdir(metricsDir, { recursive: true });
      await fs.writeFile(
        this.metricsFile,
        JSON.stringify(this.metrics, null, 2)
      );
    } catch (error) {
      console.warn('Failed to save metrics:', error);
    }
  }

  /**
   * Load historical metrics
   */
  private async loadMetrics(): Promise<void> {
    try {
      const content = await fs.readFile(this.metricsFile, 'utf-8');
      this.metrics = JSON.parse(content);
    } catch {
      // No existing metrics file
      this.metrics = [];
    }
  }

  /**
   * Get layer statistics
   */
  getLayerStatistics(): LayerStatistics[] {
    const stats = new Map<string, LayerStatistics>();

    // Initialize stats for all layers
    for (const layer of this.layers) {
      stats.set(layer.name, {
        layerName: layer.name,
        totalExecutions: 0,
        successRate: 0,
        averageExecutionTime: 0,
        lastUsed: 'never'
      });
    }

    // Calculate statistics from metrics
    for (const metric of this.metrics) {
      const layerStats = stats.get(metric.layer);
      if (layerStats) {
        layerStats.totalExecutions++;
        layerStats.lastUsed = metric.timestamp;

        // Update success rate
        const successCount = this.metrics
          .filter(m => m.layer === metric.layer && m.success)
          .length;
        layerStats.successRate = successCount / layerStats.totalExecutions;

        // Update average execution time
        const totalTime = this.metrics
          .filter(m => m.layer === metric.layer)
          .reduce((sum, m) => sum + m.executionTime, 0);
        layerStats.averageExecutionTime = totalTime / layerStats.totalExecutions;
      }
    }

    return Array.from(stats.values());
  }

  /**
   * Get recent execution history
   */
  getRecentExecutions(count: number = 10): ExecutionMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Clear metrics history
   */
  async clearMetrics(): Promise<void> {
    this.metrics = [];
    try {
      await fs.unlink(this.metricsFile);
    } catch {
      // File might not exist
    }
  }

  /**
   * Get available layers
   */
  getAvailableLayers(): { name: string; description: string }[] {
    return this.layers.map(layer => ({
      name: layer.name,
      description: this.getLayerDescription(layer.name)
    }));
  }

  /**
   * Get layer description
   */
  private getLayerDescription(layerName: string): string {
    const descriptions: Record<string, string> = {
      'standard-tools': 'Handles simple, structured API calls using predefined tools',
      'sdk-dynamic': 'Handles dynamic code generation and system access',
      'subagent': 'Handles complex tasks through parallel multi-agent execution',
      'skills': 'Provides prompt-based meta-tools that modify agent behavior'
    };

    return descriptions[layerName] || 'Unknown layer';
  }
}

export default ExecutionLayerManager;