# CHECKLIST.md: Planning & Execute (P&E) Module

This checklist is for verifying the functionality of the P&E module *before* merging.

## 1. Schema & I/O
- [ ] Does the module correctly populate **all** fields for the LLM Input Schema (`current_task`, `previous_context`, `error_log`, `history`)?
- [ ] Does the module correctly parse **all** fields from the LLM Output Schema (`status`, `result`, `log_entries`)?
- [ ] Does the module gracefully handle a malformed or non-JSON response from the LLM?

## 2. Core Loop & State Management
- [ ] Does the module execute tasks sequentially according to the plan?
- [ ] Is the `last_step_result` from Step 1 correctly passed as `previous_context` to Step 2?
- [ ] Is the `history` array accurately updated after each *successful* step?
- [ ] Does the loop terminate correctly when the plan is complete?
- [ ] Does the loop terminate correctly if a "Debug" step fails?

## 3. "Plan -> Execute -> Debug" Workflow
- [ ] **(Execute Path):** Does a standard, non-debug task execute correctly?
- [ ] **(Debug Path):** When an execution fails, is the `error_log` field correctly populated with the `stderr` or exception?
- [ ] **(Debug Path):** Is the *next* LLM call correctly formatted as a "Debug" task?
- [ ] **(Debug Path):** After a successful debug, does the module resume the *next* planned task (not re-run the failed one)?

## 4. Logging Integration (P&E Perspective)
- [ ] Does the LLM's JSON output **contain** the `log_entries` array (as requested by the prompt)?
- [ ] Does the code *generated* by the LLM (in the `result` field) **contain** the required logging calls (e.g., `logger.info(...)`) as specified in the prompt?
- [ ] Are the `log_entries` from the LLM being captured and stored/displayed correctly by the P&E module?
