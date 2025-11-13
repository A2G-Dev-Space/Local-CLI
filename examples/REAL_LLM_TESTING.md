# Real LLM Testing Guide

This guide explains how to test the Plan & Execute module with your actual LLM endpoint.

## Quick Start

### 1. Configure Your LLM Endpoint

Before running tests, ensure your LLM is configured:

```bash
# Run the CLI and configure
npm run dev

# Or check if already configured
npm run build && npm start
```

In the CLI:
1. Go to configuration/settings
2. Add your LLM endpoint (URL and API key)
3. Select a model
4. Verify the connection works

### 2. Run Quick Test (1 scenario)

```bash
npm run test:plan-execute
```

This runs **1 simple scenario** (Calculator) to verify everything works.

### 3. Run Full Test Suite (4 scenarios)

```bash
TEST_MODE=full npm run test:plan-execute
```

This runs **all 4 scenarios**:
- Simple Calculator (basic execution)
- Todo List Manager (CRUD operations)
- User Authentication (complex dependencies)
- REST API with Express (multi-step project)

## Test Modes

### Quick Mode (Default)
```bash
npm run test:plan-execute
# or
TEST_MODE=quick npm run test:plan-execute
```

- **Scenarios**: 1 (Simple Calculator)
- **Duration**: ~30-60 seconds
- **Use for**: Quick smoke test, verifying setup

### Full Mode
```bash
TEST_MODE=full npm run test:plan-execute
```

- **Scenarios**: 4 (all scenarios)
- **Duration**: ~5-10 minutes
- **Use for**: Comprehensive testing, before deployment

### Verbose Mode
```bash
VERBOSE=true npm run test:plan-execute
# or combine
TEST_MODE=full VERBOSE=true npm run test:plan-execute
```

- **Shows**: All log entries from LLM
- **Use for**: Debugging, understanding LLM behavior

## What Gets Tested

### 1. Simple Calculator (Category: SIMPLE)

**Request**:
```
Create a simple calculator module with add, subtract, multiply,
and divide functions. Include basic error handling for division by zero.
```

**Tests**:
- ✅ Planning: LLM creates 2-5 tasks
- ✅ Sequential execution
- ✅ Context passing between tasks
- ✅ Basic error handling

**Expected plan**:
1. Create calculator module structure
2. Implement arithmetic functions
3. Add error handling
4. Write tests (optional)

### 2. Todo List Manager (Category: SIMPLE)

**Request**:
```
Build a todo list manager with functions to add, remove, update,
and list todo items. Store todos in memory.
```

**Tests**:
- ✅ CRUD operations planning
- ✅ State management
- ✅ Multiple function implementation
- ✅ Memory storage

**Expected plan**:
1. Define todo data structure
2. Implement add/remove functions
3. Implement update/list functions
4. Add memory storage

### 3. User Authentication (Category: MEDIUM)

**Request**:
```
Create a user authentication system with registration and login.
Use JWT for tokens and bcrypt for password hashing.
```

**Tests**:
- ✅ Complex dependencies (JWT, bcrypt)
- ✅ Security considerations
- ✅ Multi-step workflow
- ✅ Integration of external libraries

**Expected plan**:
1. Setup user model/schema
2. Implement password hashing
3. Create registration endpoint
4. Create login endpoint with JWT
5. Add token validation

### 4. REST API with Express (Category: COMPLEX)

**Request**:
```
Build a simple REST API using Express with user CRUD endpoints,
error handling middleware, and input validation.
```

**Tests**:
- ✅ Framework setup (Express)
- ✅ Middleware implementation
- ✅ Multiple endpoints
- ✅ Error handling
- ✅ Validation logic

**Expected plan**:
1. Initialize Express app
2. Setup middleware (logging, error handling)
3. Create user model
4. Implement CRUD routes
5. Add input validation
6. Write API tests

## Expected Output

### Successful Test Run

```
████████████████████████████████████████████████████████████████████████████████
  PLAN & EXECUTE MODULE - REAL LLM TEST SUITE
████████████████████████████████████████████████████████████████████████████████

🔧 Initializing configuration...
✓ Using endpoint: My LLM Server
✓ Using model: gpt-4

Test Configuration:
  Mode: quick
  Max Debug Attempts: 3
  Task Timeout: 300s
  Verbose: false

Running 1 test scenario(s)...

[1/1] Starting scenario: Simple Calculator

================================================================================
TEST SCENARIO: Simple Calculator
================================================================================
Category: SIMPLE
Description: Tests basic sequential execution
User Request: "Create a simple calculator module..."

🤖 Calling LLM to generate plan...

✓ Plan created with 3 tasks:
  1. Create calculator module structure
  2. Implement arithmetic operations
  3. Add error handling and tests

[Step 1] Starting: Create calculator module structure
✓ Completed: Create calculator module structure

[Step 2] Starting: Implement arithmetic operations
✓ Completed: Implement arithmetic operations

[Step 3] Starting: Add error handling and tests
✓ Completed: Add error handling and tests

================================================================================
EXECUTION COMPLETED ✓
================================================================================
Total Tasks: 3
Completed: 3
Total Steps: 3
Duration: 45.2s
Success: ✓ YES

────────────────────────────────────────────────────────────────────────────────
LOG ENTRIES (9 total)
────────────────────────────────────────────────────────────────────────────────
[INFO] Creating calculator module structure
[INFO] Module structure created successfully
[INFO] Implementing arithmetic operations
[DEBUG] Adding add function
[DEBUG] Adding subtract function
[DEBUG] Adding multiply function
[DEBUG] Adding divide function with error handling
[INFO] All operations implemented
[INFO] Tests added and passing

████████████████████████████████████████████████████████████████████████████████
  TEST SUMMARY
████████████████████████████████████████████████████████████████████████████████

1. [SIMPLE] Simple Calculator
   Status: ✓ PASS
   Plan Size: 3 tasks
   Completed: 3/3
   Log Entries: 9
   Duration: 45.20s

────────────────────────────────────────────────────────────────────────────────
Results: 1/1 passed | Total Time: 45.20s
────────────────────────────────────────────────────────────────────────────────

🎉 All tests passed!

💡 Tips:
   • Run full suite: TEST_MODE=full npm run test:plan-execute
   • See all logs: VERBOSE=true npm run test:plan-execute
   • Check unit tests: npm test -- test/plan-and-execute/
   • See more prompts: examples/TEST_PROMPTS.md
```

## Interpreting Results

### Success Indicators

✅ **Plan created** - LLM successfully generated a task plan
✅ **All tasks completed** - Each task executed without errors
✅ **Log entries captured** - LLM provided structured logs
✅ **Expected task range** - Plan size is reasonable

### Warning Signs

⚠️ **Plan size outside range** - LLM created too many/few tasks
⚠️ **Debug attempts** - Tasks needed retry/debugging
⚠️ **Long duration** - Tasks took longer than expected

### Failure Indicators

❌ **Execution failed** - Task could not complete
❌ **Error in logs** - LLM reported errors
❌ **Timeout** - Task exceeded time limit

## Troubleshooting

### Error: "No LLM endpoint configured"

**Solution**: Configure your LLM first
```bash
npm run dev
# Go to configuration → Add endpoint
```

### Error: "API call failed"

**Possible causes**:
1. Wrong endpoint URL
2. Invalid API key
3. LLM server is down
4. Network issues

**Solution**:
```bash
# Test your endpoint manually
curl -X POST https://your-llm-endpoint/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"your-model","messages":[{"role":"user","content":"test"}]}'
```

### Error: "Planning failed"

**Possible causes**:
1. LLM returned invalid JSON
2. Prompt too complex
3. Model doesn't support planning

**Solution**: Check logs with `VERBOSE=true`

### Tasks always fail

**Possible causes**:
1. LLM not following output schema
2. LLM returning malformed JSON
3. Task timeout too short

**Solution**:
1. Check if your LLM supports JSON output
2. Increase timeout: Edit `TEST_CONFIG.taskTimeout` in test file
3. Use verbose mode to see actual LLM responses

### Debug mode activates frequently

**This is normal!** Debug mode tests error recovery.

**If excessive**:
- Check LLM is returning proper status values
- Verify error messages are clear
- Consider increasing `maxDebugAttempts`

## Advanced Usage

### Test with Different Models

```bash
# Configure multiple models in CLI
# Then select different model before running tests
npm run test:plan-execute
```

### Test Specific Scenario

Edit `test-plan-execute.ts` and modify `TEST_SCENARIOS` array:

```typescript
const TEST_SCENARIOS = [
  // Comment out scenarios you don't want
  // {
  //   name: 'Todo List Manager',
  //   ...
  // },
  {
    name: 'Your Custom Test',
    description: 'Tests my specific feature',
    userRequest: 'Your custom prompt here',
    category: 'simple',
    expectedMinTasks: 2,
    expectedMaxTasks: 5,
  },
];
```

### Collect Performance Metrics

Results include timing data:
- `totalTime` - Total duration per scenario
- `duration` - Execution time from summary
- `planSize` - Number of tasks generated

Use this to compare LLM models or optimize prompts.

## Best Practices

### 1. Start with Quick Mode

Always test with quick mode first to verify setup:
```bash
npm run test:plan-execute
```

### 2. Use Verbose for Debugging

When something fails, use verbose mode:
```bash
VERBOSE=true npm run test:plan-execute
```

### 3. Test After Changes

Run tests after modifying:
- LLM schemas
- Orchestrator logic
- State management
- Error handling

### 4. Monitor LLM Costs

Real LLM tests make actual API calls:
- Quick mode: ~3-5 LLM calls
- Full mode: ~15-25 LLM calls

Consider costs if using paid API.

### 5. Check Unit Tests Too

Real LLM tests complement unit tests:
```bash
npm test -- test/plan-and-execute/
```

Both should pass for confidence.

## Comparison: Mock vs Real LLM

| Aspect | simple-demo.ts (Mock) | test-plan-execute.ts (Real) |
|--------|----------------------|----------------------------|
| LLM Calls | Fake/Simulated | Real API calls |
| Cost | Free | May incur API costs |
| Speed | Instant | Depends on LLM |
| Reliability | Always works | May fail if LLM down |
| Testing Scope | Basic workflow | Complete integration |
| Best For | Learning, demos | Production testing |

## Next Steps

After successful testing:

1. **Integrate into your CLI** - Add P&E to main application
2. **Create custom prompts** - Tailor scenarios to your use case
3. **Monitor production** - Track real usage metrics
4. **Optimize prompts** - Improve based on test results
5. **Add more tests** - Cover edge cases

## Resources

- **Unit Tests**: `test/plan-and-execute/` - Mock-based tests
- **Example Prompts**: `examples/TEST_PROMPTS.md` - More test ideas
- **Implementation**: `PLAN_AND_EXECUTE_IMPLEMENTATION.md` - Full docs
- **Simple Demo**: `examples/simple-demo.ts` - Mock-based demo

Happy testing! 🚀
