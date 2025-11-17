# Human-in-the-Loop (HITL) Guide

This guide explains how to use the Human-in-the-Loop approval system in the Plan & Execute module.

## What is HITL?

Human-in-the-Loop (HITL) is a safety feature that prompts you to approve potentially risky operations before they execute. This prevents accidental file deletions, unwanted package installations, and other dangerous actions.

## Quick Start

### Run the Demo

```bash
npx tsx examples/demo-hitl.ts
```

This will show you HITL in action with a simple example.

## How It Works

### Two Approval Gates

**Gate 1: Plan Approval** (after planning phase)
- Shows you the complete list of tasks
- You can approve or reject the entire plan
- Optional - can be disabled

**Gate 2: Task Approval** (before risky tasks)
- Analyzes each task for risk level
- Prompts only for medium+ risk tasks
- Shows risk details and allows approve/reject

### Risk Levels

| Level | Examples | Default Behavior |
|-------|----------|------------------|
| 🔴 **Critical** | `rm -rf`, `DROP DATABASE`, `chmod 777` | Always requires approval |
| 🟠 **High** | Delete `.ts` files, global installs, `sudo` | Requires approval |
| 🟡 **Medium** | File writes, `npm install`, `.env` changes | Requires approval |
| 🟢 **Low** | Reading files, `ls`, unknown operations | Auto-approved |

## Usage Examples

### Basic Usage (HITL Enabled)

```typescript
import { PlanExecuteOrchestrator } from './src/plan-and-execute/orchestrator.js';
import { LLMClient } from './src/core/llm-client.js';

const llmClient = new LLMClient();

const orchestrator = new PlanExecuteOrchestrator(llmClient, {
  hitl: {
    enabled: true,        // Enable HITL
    approvePlan: true,    // Prompt for plan approval
  }
});

await orchestrator.execute('Create a REST API with Express');
```

### Customize Risk Threshold

```typescript
// Only approve HIGH and CRITICAL risks
// (Medium and low risks auto-approve)
const orchestrator = new PlanExecuteOrchestrator(llmClient, {
  hitl: {
    enabled: true,
    approvePlan: true,
    riskConfig: {
      approvalThreshold: 'high',  // 'low' | 'medium' | 'high' | 'critical'
    }
  }
});
```

### Auto-Approve Patterns

```typescript
// Auto-approve reading markdown files
const orchestrator = new PlanExecuteOrchestrator(llmClient, {
  hitl: {
    enabled: true,
    riskConfig: {
      autoApprovePatterns: [
        '^Read.*\\.md$',        // Read any .md file
        '^List files',          // File listing
        'test|spec',            // Anything with test/spec
      ]
    }
  }
});
```

### Block Dangerous Patterns

```typescript
// Block production deployments and dangerous commands
const orchestrator = new PlanExecuteOrchestrator(llmClient, {
  hitl: {
    enabled: true,
    riskConfig: {
      blockPatterns: [
        'production',
        'rm -rf /',
        'DROP DATABASE prod',
      ]
    }
  }
});
```

### Disable HITL Entirely

```typescript
// For automated scripts where no human interaction is possible
const orchestrator = new PlanExecuteOrchestrator(llmClient, {
  hitl: {
    enabled: false,  // No approval prompts
  }
});
```

### Skip Plan Approval

```typescript
// Only approve individual risky tasks, not the whole plan
const orchestrator = new PlanExecuteOrchestrator(llmClient, {
  hitl: {
    enabled: true,
    approvePlan: false,  // Skip plan approval gate
  }
});
```

## Approval Options

When prompted for approval, you have these options:

### Plan Approval
- **[a] Approve** - Execute this plan
- **[r] Reject** - Cancel execution
- **[s] Stop** - Stop and exit

### Task Approval
- **[a] Approve** - Execute this task
- **[r] Reject** - Skip this task (continue with next)
- **[A] Approve All** - Approve this and all remaining tasks
- **[R] Reject All** - Reject this and all remaining tasks
- **[s] Stop** - Stop execution entirely

## Example Workflow

```
$ npx tsx examples/demo-hitl.ts

================================================================================
📋 PLAN APPROVAL REQUIRED
================================================================================

User Request: "Create a simple calculator.js file with add and subtract functions"

Generated 4 task(s):

  1. Create calculator.js file
     Details: Create a new file named calculator.js in the current directory
  2. Implement add function
     Details: Write the add function that takes two parameters and returns their sum
  3. Implement subtract function
     Details: Write the subtract function that takes two parameters and returns their difference
  4. Export functions
     Details: Add module.exports for add and subtract functions

--------------------------------------------------------------------------------

Options:
  [a] Approve - Execute this plan
  [r] Reject - Cancel execution
  [s] Stop - Stop and exit

Your choice (a/r/s): a  ← USER INPUT

================================================================================
⚠️  APPROVAL REQUIRED - RISKY OPERATION DETECTED
================================================================================

Task: Create calculator.js file
Risk Level: 🟡 MEDIUM
Category: File Write
Reason: Writing to source code files
Patterns: \b(write|create|update)\b.*(\.js|\.ts|\.jsx|\.tsx|\.py|\.java|\.cpp|\.h)\b

--------------------------------------------------------------------------------

Options:
  [a] Approve - Execute this task
  [r] Reject - Skip this task
  [A] Approve All - Approve this and all remaining tasks
  [R] Reject All - Reject this and all remaining tasks
  [s] Stop - Stop execution entirely

Your choice (a/r/A/R/s): A  ← USER INPUT

✓ Task 1 completed
✓ Task 2 completed (auto-approved after "Approve All")
✓ Task 3 completed (auto-approved after "Approve All")
✓ Task 4 completed (auto-approved after "Approve All")

================================================================================
EXECUTION COMPLETED ✓
================================================================================
```

## Configuration Reference

```typescript
interface OrchestratorConfig {
  hitl?: {
    // Enable/disable HITL globally
    enabled?: boolean;  // default: true

    // Request approval for the entire plan after planning
    approvePlan?: boolean;  // default: true

    // Risk analyzer configuration
    riskConfig?: {
      // Minimum risk level that requires approval
      approvalThreshold?: 'low' | 'medium' | 'high' | 'critical';  // default: 'medium'

      // Auto-approve certain patterns (regex)
      autoApprovePatterns?: string[];  // default: ['^Read.*\\.md$', '^List files']

      // Always block certain patterns (regex)
      blockPatterns?: string[];  // default: ['rm -rf /', 'DROP DATABASE']

      // Enable/disable risk analysis
      enabled?: boolean;  // default: true
    };
  };
}
```

## Tips

1. **Use "Approve All" carefully** - Once you approve all, no further prompts will appear
2. **Block patterns are strict** - If a block pattern matches, the task will be marked as critical
3. **Auto-approve for CI/CD** - Disable HITL in automated environments where no human is available
4. **Test with demo first** - Run `npx tsx examples/demo-hitl.ts` to see how it works
5. **Custom patterns** - Use regex patterns for fine-grained control over what gets approved

## Troubleshooting

**Q: I'm not seeing approval prompts**
- Check that `hitl.enabled` is `true`
- Check that the task risk level meets your `approvalThreshold`
- Verify you're using `PlanExecuteOrchestrator`, not direct LLM calls

**Q: Too many approval prompts**
- Increase `approvalThreshold` to 'high' or 'critical'
- Add common operations to `autoApprovePatterns`
- Disable plan approval with `approvePlan: false`

**Q: Approval prompt stuck/not responding**
- Press Ctrl+C to exit
- Check terminal input is not redirected
- Ensure you're running in an interactive terminal

**Q: Want to approve everything**
- Use `hitl.enabled: false` to disable HITL
- Or use "Approve All" option when first prompted

## See Also

- [Test Prompts](./TEST_PROMPTS.md) - Example prompts to test HITL
- [Real LLM Testing](./REAL_LLM_TESTING.md) - Integration testing guide
- [CHECKLIST_PLAN_AND_EXECUTE.md](../CHECKLIST_PLAN_AND_EXECUTE.md) - Implementation status
