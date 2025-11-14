# Plan and Execute Module - Codebase Analysis & Implementation Guide

## Executive Summary

The OPEN-CLI project is a sophisticated LLM-based CLI platform with an emerging Plan-and-Execute (P&E) architecture. The codebase already has solid foundations for the P&E module with:
- **Planning System** (PlanningLLM) - converts user requests into TODO lists
- **Execution System** (TodoExecutor + AgentLoopController) - executes tasks with iterative refinement
- **Verification System** (WorkVerifier) - validates work and provides feedback
- **Multi-layered Execution** - supports different execution strategies
- **Comprehensive Type System** - well-defined interfaces for P&E components
- **Modern UI** (Ink/React) - Plan-and-Execute visualization component

---

## 1. PROJECT ARCHITECTURE OVERVIEW

### Directory Structure
```
src/
├── cli.ts                     # Entry point (main CLI dispatcher)
├── index.ts                   # Library exports
├── core/                      # Core execution logic
│   ├── llm-client.ts         # OpenAI-compatible API client (main LLM integration)
│   ├── planning-llm.ts       # Converts user requests → TODO lists
│   ├── todo-executor.ts      # Executes TODO items sequentially
│   ├── agent-loop.ts         # Iterative execution loop (gather → act → verify → repeat)
│   ├── action-executor.ts    # Generates and executes actions
│   ├── work-verifier.ts      # Validates work completion
│   ├── context-gatherer.ts   # Gathers context for agent loop
│   ├── agent-framework-handler.ts  # Docs search + framework integration
│   ├── slash-command-handler.ts    # CLI meta commands
│   └── [other services]      # Config, session, docs, etc.
├── execution/                # Multi-layered execution system
│   ├── layer-manager.ts      # Orchestrates execution layers
│   ├── standard-tools.ts     # Basic file/bash operations
│   ├── sdk-layer.ts          # SDK-based execution
│   ├── subagent-layer.ts     # Sub-agent orchestration
│   └── skills-layer.ts       # Agent skills framework
├── ui/                       # React/Ink UI components
│   └── components/
│       ├── PlanExecuteApp.tsx    # Main P&E interactive interface
│       ├── TodoPanel.tsx         # TODO list display
│       ├── AgentLoopProgress.tsx # Progress visualization
│       └── [other components]
├── tools/                    # Available tools for LLM
│   └── file-tools.ts        # File system tools
├── types/                    # TypeScript interfaces
└── utils/                    # Logging, caching, etc.
```

### Technology Stack
- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **CLI Framework**: Commander.js
- **UI**: Ink (React for terminal)
- **LLM Integration**: OpenAI-compatible API (Axios)
- **Testing**: Jest
- **Logging**: Custom logger with JSON stream support

---

## 2. CORE COMPONENTS FOR PLAN & EXECUTE

### 2.1 LLM Integration (`llm-client.ts`)

**Purpose**: OpenAI-compatible LLM client
**Key Methods**:
```typescript
chatCompletion(options: LLMRequestOptions): Promise<LLMResponse>
chatCompletionWithTools(messages: Message[], tools: ToolDefinition[], maxIterations: number)
sendMessage(message: string, systemPrompt?: string): Promise<string>
sendMessageStream(message: string, systemPrompt?: string): AsyncGenerator<string>
```

**How LLM Calls Work**:
1. Configuration is loaded from `configManager` (endpoint URL, API key, model)
2. Messages are preprocessed for model-specific requirements (e.g., gpt-oss Harmony format)
3. HTTP request is sent via Axios with error handling
4. Tool calls are detected in response and executed iteratively
5. Results are integrated back into message history

**Important Details**:
- Supports streaming and non-streaming responses
- Tool-calling is recursive (LLM → tool execution → LLM response)
- Model-specific preprocessing (e.g., Harmony format for gpt-oss)
- Comprehensive error handling (NetworkError, APIError, TimeoutError, RateLimitError, TokenLimitError)
- JSON logging integration via `json-stream-logger`

### 2.2 Planning LLM (`planning-llm.ts`)

**Purpose**: Convert user requests into executable TODO lists
**Key Methods**:
```typescript
generateTODOList(userRequest: string): Promise<PlanningResult>
validateDependencies(todos: TodoItem[]): boolean
sortByDependencies(todos: TodoItem[]): TodoItem[]
```

**How It Works**:
1. Takes user request as input
2. Uses LLM with specific system prompt to break down into TODOs
3. Parses LLM response to extract JSON with:
   - `todos`: Array of TODO items with id, title, description, requiresDocsSearch, dependencies
   - `estimatedTime`: Total time estimate
   - `complexity`: 'simple' | 'moderate' | 'complex'
4. Creates TodoItem objects with 'pending' status
5. Validates and sorts by dependencies

**TODO Item Structure**:
```typescript
interface TodoItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  requiresDocsSearch: boolean;
  dependencies: string[];  // Other TODO ids
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}
```

### 2.3 Agent Loop Controller (`agent-loop.ts`)

**Purpose**: Implements the iterative "gather → act → verify → repeat" loop
**Key Methods**:
```typescript
executeTodoWithLoop(todo: TodoItem, messages: Message[], onProgress?): Promise<TodoExecutionResult>
executeMultipleTodos(todos: TodoItem[], initialMessages?, onProgress?): Promise<{results, messages}>
```

**Loop Workflow**:
```
While not complete AND iterations < maxIterations:
  1. Gather Context
     - File system exploration
     - Project configuration
     - Previous failure analysis
  
  2. Take Action
     - Generate action plan using LLM
     - Validate action safety
     - Execute action
  
  3. Verify Work
     - Rule-based verification
     - Project-specific rules
     - LLM-as-Judge verification
  
  4. Decide to Continue
     - If verification.isComplete: return success
     - Else: add feedback to context and retry
```

**Configuration Options**:
```typescript
interface AgentLoopConfig {
  maxIterations?: number;        // Default: 10
  verbose?: boolean;             // Detailed logging
  enableLLMJudge?: boolean;       // Use LLM for fuzzy verification
  timeout?: number;              // Milliseconds
}
```

**Progress Callback**:
```typescript
(update: ProgressUpdate) => {
  iteration: number;
  action: string;
  verification: VerificationResult;
  willRetry: boolean;
}
```

### 2.4 Action Executor (`action-executor.ts`)

**Purpose**: Generates and executes actions within the agent loop
**Key Methods**:
```typescript
execute(context: LoopContext, messages: Message[]): Promise<ExecutionResult>
```

**Action Execution Flow**:
1. Generate action plan using LLM with context-aware system prompt
2. Validate action for safety (prevents dangerous operations)
3. Execute action (file operations, bash commands, etc.)
4. Return execution result with output/error

**Available Tools**:
- `FILE_TOOLS`: read_file, write_file, list_files, find_files

### 2.5 Work Verifier (`work-verifier.ts`)

**Purpose**: Verifies that executed work meets TODO requirements
**Key Methods**:
```typescript
verify(action: ExecutionResult, todo: TodoItem, context: LoopContext): Promise<VerificationResult>
```

**Verification Strategies**:
1. **Basic Success Check**: Did the action execute without error?
2. **Rule-based Verification**: Check against deterministic rules (lint, test, build)
3. **Project Rules**: Check against OPEN_CLI.md configuration
4. **LLM-as-Judge**: For fuzzy criteria (uses `llmJudge`)

**Verification Result**:
```typescript
interface VerificationResult {
  isComplete: boolean;           // All checks passed
  feedback: VerificationFeedback[];
  summary: string;
  nextStepSuggestions?: string[];
}

interface VerificationFeedback {
  rule: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
  suggestions?: string[];
}
```

### 2.6 Context Gatherer (`context-gatherer.ts`)

**Purpose**: Collects comprehensive context for agent loop
**Key Methods**:
```typescript
gather(request: ContextRequest): Promise<LoopContext>
```

**Context Components**:
1. **File System Context**: Directory structure, relevant files, documentation mentions
2. **Project Config**: Loaded from OPEN_CLI.md (rules, dependencies, commands)
3. **Failure Analysis**: Patterns from previous failures with suggested fixes
4. **Previous Results**: Output from previous actions
5. **Feedback**: Verification feedback from last iteration

---

## 3. TODO EXECUTION FLOW

### 3.1 Sequential Execution (`todo-executor.ts`)

**Key Methods**:
```typescript
executeTodo(todo, messages, completedTodos): Promise<{messages, todo}>
executeTodoWithAgentLoop(todo, messages): Promise<TodoExecutionResult>
executeMultipleTodos(todos, initialMessages): Promise<{results, messages}>
```

**Single TODO Execution**:
1. Update TODO status to 'in_progress'
2. If `requiresDocsSearch`: Search documentation
3. Build context prompt with task description, docs, previous results
4. Call LLM with FILE_TOOLS (with iterative tool calling up to 5 times)
5. Update TODO status to 'completed' or 'failed'
6. Return updated messages and TODO

**Agent Loop Alternative**:
- If enabled, uses `AgentLoopController` instead
- Provides iterative refinement with verification feedback
- Better for complex tasks that need multiple attempts

**Multiple TODO Execution**:
1. Validates dependencies (topological sort)
2. Executes TODOs sequentially in order
3. Skips TODOs with unmet dependencies
4. Accumulates messages across TODOs
5. Returns aggregate results and final messages

---

## 4. EXISTING STATE MANAGEMENT & PATTERNS

### 4.1 Message History Pattern
```typescript
let messages: Message[] = [];

// Add user message
messages.push({ role: 'user', content: userInput });

// Call LLM
const result = await llmClient.chatCompletionWithTools(messages, tools);

// Update history with all messages (including tool calls/responses)
messages = result.allMessages;

// Auto-save session
sessionManager.autoSaveCurrentSession(messages);
```

### 4.2 Session Management (`session-manager.ts`)
```typescript
getCurrentSessionId(): string
autoSaveCurrentSession(messages: Message[]): void
loadSession(sessionId: string): Promise<SessionData>
listSessions(): Promise<Session[]>
```

**Session Structure**:
```typescript
interface SessionMemory {
  sessionId: string;
  tags: string[];
  messages: Message[];
  memory: Record<string, unknown>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    model: string;
    totalTokens: number;
  };
}
```

### 4.3 Configuration Management (`config-manager.ts`)
```typescript
getCurrentEndpoint(): EndpointConfig | undefined
getCurrentModel(): ModelInfo | undefined
getAllEndpoints(): EndpointConfig[]
createInitialEndpoint(endpoint: EndpointConfig): Promise<void>
```

### 4.4 Logging Infrastructure

**Logger Utility** (`utils/logger.ts`):
```typescript
enum LogLevel { ERROR, WARN, INFO, DEBUG, VERBOSE }

class Logger {
  enter(functionName, data): void        // Function entry logging
  exit(functionName, data): void         // Function exit logging
  flow(message): void                    // Flow tracking
  vars(variables): void                  // Variable logging
  error(message, error): void            // Error logging
  warn(message): void                    // Warning logging
  info(message): void                    // Info logging
  debug(message): void                   // Debug logging
  verbose(message): void                 // Verbose logging
  httpRequest(config): void              // HTTP request logging
  httpResponse(response): void           // HTTP response logging
}
```

**JSON Stream Logger** (`utils/json-stream-logger.ts`):
```typescript
initializeJsonStreamLogger(sessionId): Promise<void>
closeJsonStreamLogger(): Promise<void>
// Logs all activity to JSON streams for analysis
```

**Setting Log Levels**:
```
--verbose     # DEBUG level (detailed logging)
--debug       # VERBOSE level (maximum debugging with location tracking)
```

---

## 5. UI COMPONENTS FOR PLAN & EXECUTE

### 5.1 Main App Component (`PlanExecuteApp.tsx`)

**State Management**:
```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');
const [isProcessing, setIsProcessing] = useState(false);
const [todos, setTodos] = useState<TodoItem[]>([]);
const [currentTodoId, setCurrentTodoId] = useState<string | undefined>();
const [showTodoPanel, setShowTodoPanel] = useState(true);
const [executionPhase, setExecutionPhase] = useState<'idle' | 'planning' | 'executing'>('idle');
```

**Main Workflows**:
1. **Plan & Execute Flow**:
   - User input → PlanningLLM.generateTODOList()
   - Display TODO list
   - TodoExecutor.executeMultipleTodos() with progress callbacks
   - Update TODO panel as each completes

2. **Regular Chat Flow**:
   - User input → LLMClient.chatCompletionWithTools()
   - Display response

3. **Interactive Features**:
   - File browser (@-trigger)
   - Command browser (/-trigger)
   - Session browser
   - Slash command handling

### 5.2 Supporting Components

**TodoPanel.tsx**:
- Displays list of TODOs with status indicators
- Shows duration, results, errors
- Highlights current TODO

**AgentLoopProgress.tsx**:
- Shows iteration count and progress
- Displays current action
- Shows verification feedback

**StatusBar.tsx**:
- Model info, endpoint, tokens used
- Current mode (plan, execute, chat)

### 5.3 Keyboard Shortcuts

Within the Ink UI:
- `Tab` / `Shift+Tab`: Navigate sections
- `Enter`: Submit input
- `/` prefix: Slash commands
- `@` prefix: File references
- `Ctrl+C`: Exit

---

## 6. RECOMMENDED STRUCTURE FOR P&E MODULE

Based on the existing codebase, here's where the P&E module should live:

```
src/plan-and-execute/           # NEW: Plan & Execute Module
├── index.ts                    # Main exports
├── orchestrator.ts             # Main P&E orchestrator
│   ├── planPhase()            # Planning: user request → TODOs
│   ├── executePhase()         # Execution: TODOs → results
│   ├── debugPhase()           # Debug: error handling
│   ├── manage state          # Overall state management
│   └── event emissions       # Progress/completion events
├── state-manager.ts            # P&E state persistence
│   ├── save/load state       # Session management
│   ├── track history         # Execution history
│   └── TODO progress tracking
├── llm-schemas.ts              # LLM I/O schemas
│   ├── InputSchema           # For LLM input (current_task, context, etc.)
│   ├── OutputSchema          # For LLM output (status, result, log_entries)
│   └── Validation            # Schema validation
├── event-emitter.ts            # Progress events
│   ├── PlanCreated
│   ├── TodoStarted
│   ├── TodoCompleted
│   ├── DebugStarted
│   └── ExecutionCompleted
└── types.ts                    # P&E specific types
```

**Integration Points**:
- Uses existing `LLMClient` for LLM calls
- Builds on `TodoExecutor` + `AgentLoopController` for execution
- Extends `WorkVerifier` for validation
- Integrates with `ContextGatherer` for context
- Leverages `SessionManager` for persistence
- Uses `logger` for comprehensive logging

---

## 7. EXISTING PATTERNS YOU CAN BUILD UPON

### 7.1 Tool Integration Pattern
```typescript
// FILE_TOOLS is already defined and bound
const result = await llmClient.chatCompletionWithTools(
  messages,
  FILE_TOOLS,
  5 // maxIterations
);

// The LLM automatically:
// 1. Decides which tools to call
// 2. You execute them
// 3. Return results back to LLM
// 4. Repeat until done or maxIterations
```

### 7.2 LLM-Based Planning Pattern
```typescript
const planningLLM = new PlanningLLM(llmClient);
const result = await planningLLM.generateTODOList(userRequest);
// Returns: { todos, estimatedTime, complexity }
```

### 7.3 Iterative Execution with Feedback Pattern
```typescript
// The agent loop pattern is already implemented:
// 1. Gather context
// 2. Execute action
// 3. Verify result
// 4. If incomplete, add feedback and retry
```

### 7.4 Async UI Updates Pattern
```typescript
// React component with useState/useCallback
const [todos, setTodos] = useState([]);

// Update UI as execution progresses
executor.executeMultipleTodos(todos, messages, (todoIndex, update) => {
  // Update progress in real-time
  setTodos(prev => {
    prev[todoIndex] = { ...prev[todoIndex], status: 'completed' };
    return [...prev];
  });
});
```

---

## 8. KEY FILES TO EXAMINE WHEN IMPLEMENTING

1. **`src/core/llm-client.ts`** (33KB)
   - Understand how LLM calls work
   - Tool calling mechanism
   - Error handling

2. **`src/core/agent-loop.ts`** (10KB)
   - The core iteration pattern
   - How feedback is incorporated
   - How to structure a loop

3. **`src/core/planning-llm.ts`** (5KB)
   - How to structure planning prompts
   - JSON response parsing
   - Dependency validation

4. **`src/core/todo-executor.ts`** (7KB)
   - Sequential execution pattern
   - Message management
   - Context building

5. **`src/ui/components/PlanExecuteApp.tsx`** (20KB)
   - React/Ink component structure
   - State management
   - UI update patterns

6. **`src/types/index.ts`** (entire file)
   - All relevant TypeScript interfaces
   - Well-thought-out type definitions
   - Already has P&E types defined

---

## 9. LOGGING INFRASTRUCTURE

### Use the Logger for Debugging
```typescript
import { logger, LogLevel, setLogLevel } from './utils/logger.js';

// Set level
setLogLevel(LogLevel.DEBUG);  // or VERBOSE

// Log functions
logger.enter('myFunction', { param1: value });
logger.flow('Processing step 1');
logger.vars({ myVar: value });
logger.info('Something happened');
logger.error('Error message', error);
logger.exit('myFunction', { result });
```

### JSON Stream Logging
```typescript
import { 
  initializeJsonStreamLogger, 
  closeJsonStreamLogger 
} from './utils/json-stream-logger.js';

// At startup
const sessionId = sessionManager.getCurrentSessionId();
await initializeJsonStreamLogger(sessionId);

// At shutdown
process.on('SIGINT', async () => {
  await closeJsonStreamLogger();
  process.exit(0);
});
```

---

## 10. IMPORTANT ARCHITECTURAL NOTES

### 10.1 Message History is Critical
- Always maintain the full message history
- Tool calls and responses must be part of the history
- This allows the LLM to see what was tried before

### 10.2 LLM State Machine
The LLM response can be:
- **Finished normally**: finish_reason = 'stop'
- **Wants to call tool**: finish_reason = 'tool_calls'
- **Context exhausted**: finish_reason = 'length'

For tool_calls, you must:
1. Execute the tool
2. Add tool result to messages
3. Call LLM again
4. Repeat until finish_reason != 'tool_calls'

### 10.3 Error Recovery
- Implement retry logic with exponential backoff (already exists)
- Use WorkVerifier to check if task succeeded
- If not, modify context and retry
- After N failures, skip with error

### 10.4 Session Persistence
- All interactions are auto-saved
- TODOs can reference previous TODO results
- Session can be resumed and continued

### 10.5 Type Safety
- The types are extensive and well-designed
- Use them heavily to prevent bugs
- Leverage TypeScript compiler to catch issues

---

## 11. ENTRY POINTS AND FLOW

### Default Mode: Ink UI (Modern Plan & Execute)
```
cli.ts → PlanExecuteApp.tsx (main React component)
  ├── User input
  └─→ Detect mode:
      ├── Plan & Execute: PlanningLLM → TodoExecutor
      └── Regular Chat: LLMClient.chatCompletionWithTools()
```

### Classic Mode: Inquirer Interactive
```
cli.ts → inquirer prompt loop
  └─→ LLMClient.chatCompletionWithTools()
```

### Command Mode: Direct execution
```
cli.ts → specific command (chat, tools, docs, config, etc.)
```

---

## 12. TESTING PATTERNS

The project uses Jest with ts-jest. Key test files:
- `test/core/llm-client.test.ts` - LLM client mocking
- `test/core/agent-loop.test.ts` - Loop logic
- `test/execution/layer-manager.test.ts` - Execution layers

**Patterns to follow**:
1. Mock the LLMClient
2. Create test TODOs
3. Call methods
4. Assert state changes

---

## 13. NEXT STEPS FOR IMPLEMENTATION

1. **Create P&E Orchestrator** (`src/plan-and-execute/orchestrator.ts`)
   - Coordinates planning, execution, and debugging phases
   - Manages state transitions
   - Emits progress events

2. **Define LLM I/O Schemas** (`src/plan-and-execute/llm-schemas.ts`)
   - Input schema for LLM context
   - Output schema for LLM results
   - Validation logic

3. **State Manager** (`src/plan-and-execute/state-manager.ts`)
   - Persist execution state
   - Track history
   - Handle session resumption

4. **Event System** (`src/plan-and-execute/event-emitter.ts`)
   - Emit progress events
   - UI can listen and update

5. **Integration** (`src/plan-and-execute/index.ts`)
   - Export main interfaces
   - Tie everything together

6. **UI Integration** (modify `src/ui/components/PlanExecuteApp.tsx`)
   - Use new P&E orchestrator
   - Add debug phase UI
   - Better error reporting

7. **Tests** (`test/plan-and-execute/`)
   - Test orchestration flow
   - Test error handling
   - Test state management

---

## SUMMARY TABLE

| Component | File | Purpose | Key Exports |
|-----------|------|---------|-------------|
| LLM Client | `llm-client.ts` | API communication | `LLMClient`, `chatCompletion` |
| Planning | `planning-llm.ts` | Request → TODOs | `PlanningLLM`, `generateTODOList` |
| Execution | `todo-executor.ts` | Execute TODOs | `TodoExecutor`, `executeTodo` |
| Iteration Loop | `agent-loop.ts` | Gather→Act→Verify loop | `AgentLoopController`, `executeTodoWithLoop` |
| Actions | `action-executor.ts` | Generate & execute actions | `ActionExecutor`, `execute` |
| Verification | `work-verifier.ts` | Validate work | `WorkVerifier`, `verify` |
| Context | `context-gatherer.ts` | Gather context | `ContextGatherer`, `gather` |
| State | `session-manager.ts` | Save/load state | `sessionManager` |
| Logging | `logger.ts` | Structured logging | `logger`, `LogLevel` |
| UI | `PlanExecuteApp.tsx` | React component | `PlanExecuteApp` |

---

## QUICK REFERENCE: TYPE DEFINITIONS

```typescript
// Core types
TodoItem { id, title, description, status, requiresDocsSearch, dependencies, result, error, startedAt, completedAt }
Message { role, content, tool_calls, tool_call_id }
LoopContext { currentTodo, previousResults, fileSystemContext, projectConfig, feedback, iteration }
ExecutionResult { action, toolName, output, success, error, timestamp }
VerificationResult { isComplete, feedback, summary, nextStepSuggestions }
PlanningResult { todos, estimatedTime, complexity }
TodoExecutionResult { success, result, error, iterations, verificationReport }
```

