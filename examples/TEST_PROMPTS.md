# Test Prompts for Plan & Execute Module

This document contains example prompts and questions you can use to test the Plan & Execute module.

## Quick Start

### Option 1: Run the Test Script (Recommended)

```bash
# Install dependencies if not already done
npm install

# Run the automated test script
npm run ts-node examples/test-plan-execute.ts

# Or using tsx
npx tsx examples/test-plan-execute.ts
```

### Option 2: Interactive Testing

Use the CLI in interactive mode and try the prompts below.

## Test Categories

### 1. Simple Sequential Tasks ✅

**Purpose**: Test basic sequential execution without errors

**Example Prompts**:

1. **Simple Calculator**
   ```
   Create a simple calculator with add, subtract, multiply, and divide functions
   ```
   **Expected**: 3-4 tasks (structure → implementation → tests)
   **Tests**: Sequential execution, context passing

2. **Todo List App**
   ```
   Build a simple todo list manager with add, remove, and list functions
   ```
   **Expected**: 3-4 tasks
   **Tests**: Basic task completion, result passing

3. **File Utility**
   ```
   Create a file utility module with read, write, and delete functions
   ```
   **Expected**: 3-4 tasks
   **Tests**: Task dependencies, history tracking

### 2. Tasks with Dependencies 🔗

**Purpose**: Test dependency management and context passing

**Example Prompts**:

4. **REST API with Database**
   ```
   Build a REST API with Express that includes: - Database connection - User model - CRUD endpoints - Error handling middleware
   ```
   **Expected**: 5-6 tasks with dependencies
   **Tests**: Dependency ordering, previous_context usage

5. **Authentication System**
   ```
   Create a complete authentication system with:
   - User registration
   - Login with JWT
   - Password hashing
   - Protected routes
   ```
   **Expected**: 4-5 tasks
   **Tests**: Complex dependencies, state management

### 3. Error Handling & Debug Mode 🐛

**Purpose**: Test error recovery and debug workflow

**Example Prompts**:

6. **Type-Safe API Client**
   ```
   Implement a type-safe HTTP client with:
   - Generic request/response types
   - Error handling
   - Retry logic
   - Request interceptors
   ```
   **Expected**: 4-5 tasks, may trigger debug mode
   **Tests**: Error detection, debug mode activation, retry logic

7. **Complex State Machine**
   ```
   Create a state machine for an order processing system with:
   - Multiple states (pending, processing, completed, failed)
   - State transitions with validation
   - Event handlers
   - Rollback support
   ```
   **Expected**: 5-6 tasks, likely to have initial errors
   **Tests**: Debug workflow, error_log population, recovery

### 4. Long Running Tasks ⏱️

**Purpose**: Test timeout handling and state persistence

**Example Prompts**:

8. **Full-Stack Application**
   ```
   Build a blog platform with:
   - Frontend (React components)
   - Backend API (Express)
   - Database schema (MongoDB)
   - Authentication
   - Post CRUD operations
   - Comments system
   ```
   **Expected**: 8-10 tasks
   **Tests**: Long execution, state persistence, memory management

### 5. Tasks with File Operations 📁

**Purpose**: Test file tracking in results

**Example Prompts**:

9. **Project Scaffolding**
   ```
   Create a TypeScript project template with:
   - Package.json with dependencies
   - tsconfig.json with strict settings
   - Source directory structure
   - Test setup with Jest
   - ESLint and Prettier configs
   ```
   **Expected**: 5-6 tasks, all with file_changed entries
   **Tests**: files_changed tracking, file operations logging

### 6. Logging Verification 📝

**Purpose**: Test log entry capture and structure

**Example Prompts**:

10. **CLI Tool**
    ```
    Create a command-line tool that:
    - Parses command-line arguments
    - Validates inputs
    - Performs file operations
    - Provides detailed logging
    - Handles errors gracefully
    ```
    **Expected**: 4-5 tasks with extensive logging
    **Tests**: log_entries structure, log levels, log accumulation

## Testing Checklist Items

### Section 1: Schema & I/O ✅

**Test with**: Any prompt above
**Verify**:
- [ ] Input has all fields: current_task, previous_context, error_log, history
- [ ] Output has all fields: status, result, log_entries
- [ ] Malformed responses are handled gracefully
- [ ] JSON in markdown code blocks is parsed

**How to verify**:
```typescript
// Add debugging to orchestrator.ts temporarily
console.log('LLM Input:', JSON.stringify(input, null, 2));
console.log('LLM Output:', JSON.stringify(output, null, 2));
```

### Section 2: Core Loop & State Management ✅

**Test with**: Prompts 1-5 (sequential tasks)
**Verify**:
- [ ] Tasks execute in dependency order
- [ ] last_step_result passed to next task
- [ ] history grows with each step
- [ ] Loop terminates when complete
- [ ] Loop terminates on max debug failures

**How to verify**:
```typescript
// Check state after execution
const state = orchestrator.getState();
console.log('History:', state.history);
console.log('Completed tasks:', state.completedTasks);
```

### Section 3: Plan → Execute → Debug Workflow ✅

**Test with**: Prompts 6-7 (error-prone tasks)
**Verify**:
- [ ] Normal tasks execute without debug overhead
- [ ] Errors populate error_log with message, details, stderr
- [ ] Debug mode is activated on failure
- [ ] After debug success, next task resumes
- [ ] Max debug attempts are respected

**How to verify**:
- Watch for "Debug attempt N" messages in console
- Check that execution continues after successful debug
- Verify error_log contains full error details

### Section 4: Logging Integration ✅

**Test with**: Prompt 10 (CLI tool)
**Verify**:
- [ ] LLM output contains log_entries array
- [ ] Each entry has level, message, timestamp
- [ ] Log entries are captured in state
- [ ] Logs accumulate across tasks

**How to verify**:
```typescript
const logs = orchestrator.getAllLogs();
console.log(`Total logs: ${logs.length}`);
logs.forEach(log => console.log(`[${log.level}] ${log.message}`));
```

## Expected Output Format

When testing, you should see output like:

```
================================================================================
TEST SCENARIO: Simple 3-step task
================================================================================
Description: Tests basic sequential execution
User Request: "Create a simple calculator..."

✓ Plan created with 3 tasks:
  1. Create calculator module structure
     Set up the basic file structure and exports
  2. Implement arithmetic operations
     Write functions for add, subtract, multiply, divide
  3. Write unit tests
     Create test cases for all operations

[Step 1] Starting: Create calculator module structure
✓ Completed: Create calculator module structure
  Result: Successfully created files...

[Step 2] Starting: Implement arithmetic operations
✗ Failed: Implement arithmetic operations
  Error: TypeScript compilation error

⚠ Debug attempt 1 for: Implement arithmetic operations
✓ Debug successful for: Implement arithmetic operations
✓ Completed: Implement arithmetic operations

[Step 3] Starting: Write unit tests
✓ Completed: Write unit tests

================================================================================
EXECUTION COMPLETED
================================================================================
Total Tasks: 3
Completed: 3
Failed: 0
Total Steps: 4
Duration: 1234ms
Success: ✓
```

## Manual Testing Tips

1. **Enable Verbose Logging**:
   ```typescript
   const orchestrator = new PlanExecuteOrchestrator(llmClient, {
     verbose: true,
     maxDebugAttempts: 3,
   });
   ```

2. **Monitor Events**:
   ```typescript
   orchestrator.on('todoStarted', (todo) => console.log('Started:', todo.title));
   orchestrator.on('todoCompleted', (todo) => console.log('Done:', todo.title));
   orchestrator.on('debugStarted', (todo, attempt) =>
     console.log(`Debug ${attempt}:`, todo.title)
   );
   ```

3. **Inspect State**:
   ```typescript
   const state = orchestrator.getState();
   console.log('Current step:', state.currentStep);
   console.log('Status:', state.status);
   console.log('History length:', state.history.length);
   ```

4. **Check Logs**:
   ```typescript
   const logs = orchestrator.getAllLogs();
   const errorLogs = logs.filter(l => l.level === 'error');
   console.log('Errors:', errorLogs);
   ```

## Integration with Existing CLI

To integrate P&E into your existing CLI:

```typescript
// In src/cli.ts or your main CLI file
import { PlanExecuteOrchestrator } from './plan-and-execute';

// When user requests plan & execute
if (userInput.startsWith('/plan-execute ') || shouldUsePlanExecute) {
  const orchestrator = new PlanExecuteOrchestrator(llmClient, {
    maxDebugAttempts: 3,
    verbose: process.env.DEBUG === 'true',
  });

  // Set up UI event listeners
  orchestrator.on('planCreated', (plan) => {
    displayPlan(plan); // Your UI function
  });

  orchestrator.on('todoStarted', (todo, step) => {
    updateProgress(step, todo); // Your UI function
  });

  // Execute
  const summary = await orchestrator.execute(userRequest);
  displaySummary(summary); // Your UI function
}
```

## Troubleshooting

**Problem**: Tests don't run
**Solution**: Ensure `npm install` was run and TypeScript is compiled

**Problem**: All tasks fail immediately
**Solution**: Check LLM client configuration and API key

**Problem**: Debug mode never activates
**Solution**: Verify LLM is returning proper status values ('failed' or 'needs_debug')

**Problem**: Context not passed between tasks
**Solution**: Check that `previous_context` is being populated in `buildLLMInput()`

## Next Steps

After testing:

1. Integrate into main CLI (`src/cli.ts`)
2. Add UI components for progress display (`src/ui/components/`)
3. Configure real LLM endpoints
4. Add production error handling
5. Implement state persistence to disk
6. Add metrics and monitoring

## Contributing

Found issues? Have suggestions?
Please check the implementation in `src/plan-and-execute/` and run tests with:
```bash
npm test -- test/plan-and-execute/
```
