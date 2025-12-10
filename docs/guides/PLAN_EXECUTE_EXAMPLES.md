# Plan & Execute Examples

This directory contains examples and test scripts for the Plan & Execute module.

## Quick Start

### 1. Simple Demo (Recommended for First Time)

The easiest way to see P&E in action:

```bash
npm run ts-node examples/simple-demo.ts
```

**What it does**:
- Creates a simple 3-task plan
- Executes tasks sequentially
- Shows event-driven progress
- Displays execution logs
- Demonstrates the complete workflow

**Expected output**:
```
🚀 Plan & Execute - Simple Demo

📋 Plan created with 3 tasks:

   1. Setup project structure
   2. Implement core functionality
   3. Add tests

⚙️  [1] Setup project structure...
✅ Setup project structure - Done!

⚙️  [2] Implement core functionality...
✅ Implement core functionality - Done!

⚙️  [3] Add tests...
✅ Add tests - Done!

────────────────────────────────────────────────────────────
🎉 Execution Complete!

   Total Tasks: 3
   Completed: 3
   Duration: 123ms
────────────────────────────────────────────────────────────
```

### 2. Real LLM Test Suite ⚡ (NEW!)

Test with your **actual LLM endpoint** - makes real API calls:

```bash
# Quick mode - runs 1 simple scenario
npm run test:plan-execute

# Full mode - runs all 4 scenarios
TEST_MODE=full npm run test:plan-execute

# Verbose mode - see all logs
VERBOSE=true npm run test:plan-execute
```

**What it tests** (with REAL LLM):
- Simple sequential tasks (Calculator, Todo Manager)
- Complex dependencies (User Auth, REST API)
- Real planning and execution
- Error handling and debug workflow
- Log entry capture from actual LLM responses

**Test scenarios**:
1. **Simple Calculator** - Basic sequential execution
2. **Todo List Manager** - CRUD operations
3. **User Authentication** - Complex flow with JWT/bcrypt
4. **REST API with Express** - Multi-step project

### 3. Unit Tests

Run the automated test suite:

```bash
npm test -- test/plan-and-execute/
```

**Coverage**:
- 22 tests covering all checklist items
- Schema validation
- State management
- Error handling
- Logging integration

## Files

### Demo Scripts

| File | Purpose | LLM Type | Use When |
|------|---------|----------|----------|
| `simple-demo.ts` | Minimal working example | Mock | Learning the basics |
| `test-plan-execute.ts` | **Real LLM test suite** | **Real** | **Testing with your LLM** |
| `TEST_PROMPTS.md` | Example prompts and questions | N/A | Interactive testing |
| `README.md` | This file | N/A | Getting started |

## Example Prompts

Here are some prompts you can use to test the P&E module:

### Simple Tasks (Good for Testing)

1. **Calculator**
   ```
   Create a simple calculator with add, subtract, multiply, and divide functions
   ```

2. **Todo Manager**
   ```
   Build a simple todo list manager with add, remove, and list functions
   ```

3. **File Utility**
   ```
   Create a file utility module with read, write, and delete functions
   ```

### Complex Tasks (Test Dependencies)

4. **REST API**
   ```
   Build a REST API with Express that includes:
   - Database connection
   - User model
   - CRUD endpoints
   - Error handling middleware
   ```

5. **Authentication System**
   ```
   Create a complete authentication system with:
   - User registration
   - Login with JWT
   - Password hashing
   - Protected routes
   ```

### Error-Prone Tasks (Test Debug Mode)

6. **Type-Safe Client**
   ```
   Implement a type-safe HTTP client with:
   - Generic request/response types
   - Error handling
   - Retry logic
   - Request interceptors
   ```

7. **State Machine**
   ```
   Create a state machine for an order processing system with:
   - Multiple states
   - State transitions with validation
   - Event handlers
   - Rollback support
   ```

See `TEST_PROMPTS.md` for more examples and detailed testing instructions.

## Code Examples

### Basic Usage

```typescript
import { PlanExecuteOrchestrator } from '../src/plan-and-execute';
import { LLMClient } from '../src/core/llm-client';

const llmClient = new LLMClient();
const orchestrator = new PlanExecuteOrchestrator(llmClient, {
  maxDebugAttempts: 3,
  verbose: true,
});

// Listen to events
orchestrator.on('todoStarted', (todo, step) => {
  console.log(`Starting task ${step}: ${todo.title}`);
});

orchestrator.on('todoCompleted', (todo, result) => {
  console.log(`✓ Completed: ${todo.title}`);
});

// Execute
const summary = await orchestrator.execute(
  'Create a REST API with Express'
);

console.log(`Success: ${summary.success}`);
console.log(`Completed ${summary.completedTasks}/${summary.totalTasks} tasks`);
```

### With Event Handlers

```typescript
orchestrator.on('planCreated', (plan) => {
  console.log(`Plan: ${plan.length} tasks`);
});

orchestrator.on('todoStarted', (todo, step) => {
  console.log(`[${step}] ${todo.title}...`);
});

orchestrator.on('todoCompleted', (todo, result) => {
  console.log(`✓ ${todo.title}`);
});

orchestrator.on('debugStarted', (todo, attempt) => {
  console.log(`⚠ Debug ${attempt}: ${todo.title}`);
});

orchestrator.on('executionCompleted', (summary) => {
  console.log(`Done: ${summary.completedTasks}/${summary.totalTasks}`);
});

const summary = await orchestrator.execute(userRequest);
```

### Accessing Logs

```typescript
// After execution
const logs = orchestrator.getAllLogs();

logs.forEach(log => {
  console.log(`[${log.level}] ${log.message}`);
});

// Filter by level
const errors = logs.filter(l => l.level === 'error');
const warnings = logs.filter(l => l.level === 'warning');
```

### Checking State

```typescript
const state = orchestrator.getState();

console.log('Current step:', state?.currentStep);
console.log('Status:', state?.status);
console.log('Completed tasks:', state?.completedTasks.size);
console.log('History length:', state?.history.length);
console.log('In debug mode:', state?.isDebugMode);
```

## Troubleshooting

### Issue: Demo doesn't run

**Solution**:
```bash
npm install
npm run build
```

### Issue: TypeScript errors

**Solution**:
```bash
npm run build
# Check for compilation errors
```

### Issue: LLM not responding

**Solution**:
1. Check LLM client configuration
2. Verify API endpoint is accessible
3. Check API key is set
4. Try with mock client first

### Issue: Tests failing

**Solution**:
```bash
# Run specific test
npm test -- test/plan-and-execute/llm-schemas.test.ts

# Check test output for details
npm test -- test/plan-and-execute/ --verbose
```

## Next Steps

After running the examples:

1. **Integrate into CLI**: Add P&E to your main CLI interface
2. **Add UI**: Create progress display components
3. **Configure LLM**: Set up real LLM endpoints
4. **Add Persistence**: Save/load execution state
5. **Monitor Performance**: Track execution time and token usage

## Resources

- **Implementation**: `../src/plan-and-execute/`
- **Tests**: `../test/plan-and-execute/`
- **Documentation**: `../PLAN_AND_EXECUTE_IMPLEMENTATION.md`
- **Checklist**: `../CHECKLIST_PLAN_AND_EXECUTE.md`

## Questions?

Check the documentation:
- Full implementation guide: `../PLAN_AND_EXECUTE_IMPLEMENTATION.md`
- Quick reference: `../QUICK_REFERENCE.md` (if available)
- Code documentation: See comments in `../src/plan-and-execute/*.ts`
