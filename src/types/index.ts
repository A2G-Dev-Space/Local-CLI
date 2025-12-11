/**
 * OPEN-CLI Type Definitions
 *
 * 프로젝트 전체에서 사용되는 TypeScript 타입 정의
 */

/**
 * 엔드포인트 설정
 */
export interface EndpointConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: ModelInfo[];
  healthCheckInterval?: number;
  priority?: number;
  fallbackTo?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 모델 정보
 */
export interface ModelInfo {
  id: string;
  name: string;
  maxTokens: number;
  costPerMToken?: number;
  enabled: boolean;
  lastHealthCheck?: Date;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * LLM 메시지
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'error';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * Tool Call
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * LLM 요청 옵션
 */
export interface LLMRequestOptions {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
}

/**
 * LLM Response
 */
export interface LLMResponse {
  choices: {
    message: {
      role: 'assistant' | 'system' | 'user';
      content: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'function_call';
    index?: number;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

/**
 * Tool 정의
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * 세션 메모리
 */
export interface SessionMemory {
  sessionId: string;
  tags: string[];
  messages: Message[];
  memory: Record<string, unknown>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    model: string;
    totalTokens: number;
    directories: string[];
    includedFiles: string[];
  };
}

/**
 * 설정 파일 구조
 */
export interface OpenConfig {
  version: string;
  currentEndpoint?: string;
  currentModel?: string;
  endpoints: EndpointConfig[];
  settings: {
    autoApprove: boolean;
    debugMode: boolean;
    streamResponse: boolean;
    autoSave: boolean;
    autoUpdate?: AutoUpdateConfig;
  };
}

/**
 * GitHub Release information
 */
export interface ReleaseInfo {
  version: string;
  releaseDate: string;
  downloadUrl: string;
  changelog: string;
  assets: {
    name: string;
    url: string;
    size: number;
  }[];
}

/**
 * Update check result
 */
export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseInfo?: ReleaseInfo;
  error?: string;
}

/**
 * Auto-update configuration
 */
export interface AutoUpdateConfig {
  enabled: boolean;
  checkOnStartup: boolean;
  autoInstall: boolean;
  channel: 'stable' | 'beta' | 'nightly';
  skipVersion?: string;
}

/**
 * TODO Item type for Plan-and-Execute Architecture
 */
export interface TodoItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  requiresDocsSearch: boolean;
  dependencies: string[]; // Other TODO ids
  result?: string;
  error?: string;
  startedAt?: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
}

/**
 * Planning result from Planning LLM
 */
export interface PlanningResult {
  todos: TodoItem[];
  estimatedTime?: string;
  complexity: 'simple' | 'moderate' | 'complex';
}

/**
 * TODO status type
 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Agent Loop Context for Claude Code methodology
 */
export interface LoopContext {
  currentTodo: TodoItem;
  previousResults: ExecutionResult[];
  fileSystemContext: FileSystemContext;
  projectConfig?: ProjectConfig;
  feedback: VerificationFeedback[];
  iteration?: number;
  failureAnalysis?: FailureAnalysis;
}

/**
 * Execution result from Agent Loop action
 */
export interface ExecutionResult {
  action: string;
  toolName?: string;
  output: any;
  success: boolean;
  error?: Error;
  timestamp: string;
}

/**
 * Verification feedback for work validation
 */
export interface VerificationFeedback {
  rule: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
  suggestions?: string[];
}

/**
 * File system exploration context
 */
export interface FileSystemContext {
  structure?: string;
  relevantFiles?: string[];
  relevantMentions?: string;
  currentDirectory?: string;
}

/**
 * Project configuration from OPEN_CLI.md
 */
export interface ProjectConfig {
  name?: string;
  description?: string;
  rules?: string[];
  dependencies?: string[];
  testCommand?: string;
  buildCommand?: string;
}

/**
 * Failure analysis from previous iterations
 */
export interface FailureAnalysis {
  commonPatterns: string[];
  suggestedFixes: string[];
  rootCause?: string;
}

/**
 * Verification result from Work Verifier
 */
export interface VerificationResult {
  isComplete: boolean;
  feedback: VerificationFeedback[];
  summary: string;
  nextStepSuggestions?: string[];
}

/**
 * TODO execution result with Agent Loop
 */
export interface TodoExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  iterations: number;
  verificationReport?: VerificationResult;
  lastVerification?: VerificationFeedback;
}

/**
 * Action plan from LLM
 */
export interface ActionPlan {
  description: string;
  toolName?: string;
  parameters?: Record<string, any>;
  reasoning?: string;
}

/**
 * Progress update for UI
 */
export interface ProgressUpdate {
  iteration: number;
  action: string;
  verification?: VerificationResult;
  willRetry: boolean;
}

// ============== Multi-Layered Execution Architecture ==============

/**
 * Task for multi-layered execution
 */
export interface Task {
  id: string;
  description: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'meta';
  requiresTools: string[];
  requiresDynamicCode?: boolean;
  requiresSystemAccess?: boolean;
  requiresParallelism?: boolean;
  requiresSkill?: boolean | string;
  requiresBehaviorChange?: boolean;
  workflowComplexity?: 'low' | 'medium' | 'high';
  targetLanguage?: string;
  requirements?: string[];
  context?: ExecutionContext;
  timeout?: number;
  memoryLimit?: string;
  commands?: string[];
  constraints?: string[];
  subtasks?: SubTaskDescription[];
  preferredModel?: string;
  synthesisStrategy?: 'simple-merge' | 'intelligent-merge' | 'llm-synthesis';
  expectedOutputSchema?: any;
  toolName?: string;
  parameters?: Record<string, any>;
}

/**
 * Execution layer interface
 */
export interface ExecutionLayer {
  name: string;
  canHandle(task: Task): Promise<boolean>;
  execute(task: Task): Promise<LayerExecutionResult>;
}

/**
 * Layer execution result
 */
export interface LayerExecutionResult {
  success: boolean;
  output?: any;
  error?: string | string[];
  layer: string;
  executionTime?: number;
  generatedCode?: string;
  sandbox?: string;
  logs?: string[];
  commands?: string[];
  subtasks?: number;
  parallelism?: number;
  executionPlan?: ExecutionPlan;
  skillUsed?: string;
  contextModifications?: ContextModification[];
}

/**
 * SubTask description for parallel execution
 */
export interface SubTaskDescription {
  description: string;
  dependencies?: string[];
}

/**
 * SubAgent task
 */
export interface SubAgentTask {
  id: string;
  description: string;
  assignedAgent: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

/**
 * Execution plan with batches
 */
export interface ExecutionPlan {
  executionBatches: SubAgentTask[][];
  totalTasks: number;
  estimatedTime?: number;
}

/**
 * SubTask result
 */
export interface SubTaskResult {
  taskId: string;
  success: boolean;
  output?: any;
  error?: string;
  executionTime: number;
  agentId: string;
}

/**
 * Synthesis request
 */
export interface SynthesisRequest {
  task: Task;
  subtaskResults: SubTaskResult[];
  synthesisStrategy: 'simple-merge' | 'intelligent-merge' | 'llm-synthesis';
}

/**
 * Synthesis result
 */
export interface SynthesisResult {
  success: boolean;
  output: any;
  conflicts?: number;
  resolutionStrategy?: string;
  validation?: {
    valid: boolean;
    errors?: string[];
  };
}

/**
 * Agent skill definition
 */
export interface AgentSkill {
  name: string;
  description: string;
  promptExpansion: string;
  requiredTools?: string[];
  modelOverride?: string;
  contextModifications?: ContextModification[];
}

/**
 * Context modification
 */
export interface ContextModification {
  type: 'add-instruction' | 'set-parameter' | 'enable-feature';
  key?: string;
  value?: any;
  feature?: string;
}

/**
 * Enhanced execution context
 */
export interface ExecutionContext {
  systemPrompt: string;
  availableTools: string[];
  model: string;
  additionalInstructions: string[];
  parameters: Record<string, any>;
  features: Record<string, boolean>;
}

/**
 * Task analysis result
 */
export interface TaskAnalysis {
  complexity: number;
  estimatedTime: number;
  requiredCapabilities: string[];
  recommendedLayer: string;
}

// ============== Internal Monologue & Scratchpad System ==============

/**
 * Thought in the thinking process
 */
export interface Thought {
  type: 'analysis' | 'answer' | 'synthesis' | 'evaluation';
  content: string;
  confidence: number;
  question?: string;
  timestamp: number;
}

/**
 * Question for decomposition
 */
export interface Question {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  answered: boolean;
  answer?: string;
}

/**
 * Evaluation of an approach option
 */
export interface Evaluation {
  option: string;
  score: number;
  pros: string[];
  cons: string[];
  risks: string[];
  recommendation: boolean;
}

/**
 * Plan from thinking session
 */
export interface Plan {
  steps: string[];
  estimatedTime: number;
  confidence: number;
  alternatives: string[];
}

/**
 * Thinking session
 */
export interface ThinkingSession {
  id: string;
  thoughts: Thought[];
  questions: Question[];
  evaluations: Evaluation[];
  finalPlan: Plan | null;
  duration: number;
  tokenCount: number;
}

/**
 * Scratchpad content
 */
export interface ScratchpadContent {
  sessionId: string;
  created: number;
  updated: number;
  sections: ScratchpadSection[];
}

/**
 * Scratchpad section
 */
export interface ScratchpadSection {
  type: 'todo-list' | 'note' | 'code' | 'diagram';
  title?: string;
  content: string;
  created: number;
  items?: ScratchpadTodoItem[];
}

/**
 * Scratchpad TODO item
 */
export interface ScratchpadTodoItem {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  notes?: string;
  subtasks?: ScratchpadSubtask[];
  createdAt: number;
  updatedAt?: number;
}

/**
 * Scratchpad subtask
 */
export interface ScratchpadSubtask {
  id: string;
  title: string;
  completed: boolean;
}

/**
 * Custom command from project config
 */
export interface CustomCommand {
  name: string;
  description: string;
  script: string;
  args?: string[];
}

/**
 * Style guide from project config
 */
export interface StyleGuide {
  name: string;
  rules: string[];
}

/**
 * Tool configuration from project config
 */
export interface ToolConfig {
  name: string;
  config: Record<string, any>;
}

/**
 * Constraint from project config
 */
export interface Constraint {
  type: 'file' | 'code' | 'pattern';
  rule: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Project metadata
 */
export interface ProjectMetadata {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  license?: string;
}

/**
 * Project configuration from OPEN_CLI.md
 */
export interface ProjectConfiguration {
  instructions: string[];
  commands: CustomCommand[];
  styleGuides: StyleGuide[];
  tools: ToolConfig[];
  constraints: Constraint[];
  metadata: ProjectMetadata;
}

// ============== TDD Workflow & Verification System ==============

/**
 * TDD Request
 */
export interface TDDRequest {
  requirement: string;
  testFramework?: string;
  language?: string;
  maxIterations?: number;
  timeout?: number;
}

/**
 * Test case
 */
export interface Test {
  id: string;
  name: string;
  code: string;
  description?: string;
  type: 'unit' | 'integration' | 'e2e';
}

/**
 * Implementation
 */
export interface Implementation {
  code: string;
  language: string;
  timestamp: number;
  files?: { path: string; content: string }[];
}

/**
 * Test result
 */
export interface TestResult {
  passed: number;
  failed: number;
  total: number;
  failures: TestFailure[];
  duration: number;
  coverage?: number;
}

/**
 * Test failure
 */
export interface TestFailure {
  testName: string;
  message: string;
  stack?: string;
  expected?: any;
  actual?: any;
}

/**
 * TDD Iteration
 */
export interface TDDIteration {
  number: number;
  implementation: Implementation;
  testResult: TestResult;
  timestamp: number;
}

/**
 * TDD Session
 */
export interface TDDSession {
  id: string;
  request: TDDRequest;
  tests: Test[];
  implementations: Implementation[];
  iterations: TDDIteration[];
  status: 'in_progress' | 'completed' | 'failed';
  failureAnalysis?: string;
}

/**
 * TDD Result
 */
export interface TDDResult {
  success: boolean;
  session: TDDSession;
  finalImplementation?: Implementation;
  iterations?: number;
  error?: string;
}

/**
 * Implementation context
 */
export interface ImplementationContext {
  tests: Test[];
  previousAttempts: Implementation[];
  failures?: TestFailure[];
  language?: string;
}

/**
 * Verification criteria
 */
export interface VerificationCriteria {
  rules?: VerificationRule[];
  visual?: VisualCriteria;
  fuzzy?: string[];
}

/**
 * Visual criteria for UI verification
 */
export interface VisualCriteria {
  url?: string;
  screenshots?: string[];
  expectedElements?: string[];
  viewport?: { width: number; height: number };
}

/**
 * Verification outcome
 */
export interface VerificationOutcome {
  rule: string;
  passed: boolean;
  output?: any;
  message: string;
  suggestions: string[];
  severity: 'info' | 'warning' | 'error';
}

/**
 * Work output for verification
 */
export interface WorkOutput {
  code?: string;
  files?: { path: string; content: string }[];
  artifacts?: any[];
  metadata?: Record<string, any>;
}

/**
 * Verification rule for deterministic checking
 */
export interface VerificationRule {
  name: string;
  type: 'lint' | 'test' | 'build' | 'custom';
  description: string;
  testPattern?: string;
  command?: string;
  expectedOutput?: string | RegExp;
  validator?: (output: any) => boolean;
  failureMessage: string;
  suggestions: string[];
}
