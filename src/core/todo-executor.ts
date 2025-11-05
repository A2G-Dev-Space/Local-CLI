/**
 * TODO Executor for Plan-and-Execute Architecture
 *
 * Executes TODO items sequentially with documentation search and LLM tools
 */

import { LLMClient } from './llm-client.js';
import { TodoItem, Message } from '../types/index.js';
import { executeDocsSearchAgent } from './docs-search-agent.js';
import { FILE_TOOLS } from '../tools/file-tools.js';

/**
 * Callback type for TODO updates
 */
export type TodoUpdateCallback = (todo: TodoItem) => void;

/**
 * TODO Executor
 * Executes TODO items sequentially
 */
export class TodoExecutor {
  private llmClient: LLMClient;
  private onTodoUpdate?: TodoUpdateCallback;

  constructor(
    llmClient: LLMClient,
    onTodoUpdate?: TodoUpdateCallback
  ) {
    this.llmClient = llmClient;
    this.onTodoUpdate = onTodoUpdate;
  }

  /**
   * Execute single TODO
   */
  async executeTodo(
    todo: TodoItem,
    messages: Message[],
    completedTodos: TodoItem[]
  ): Promise<{ messages: Message[]; todo: TodoItem }> {
    try {
      // Update status: in_progress
      todo.status = 'in_progress';
      todo.startedAt = new Date().toISOString();
      this.onTodoUpdate?.(todo);

      // 1. Docs Search pre-execution (if requiresDocsSearch)
      let docsContext = '';
      if (todo.requiresDocsSearch) {
        console.log(`📚 Searching documentation for: ${todo.title}`);
        const searchResult = await executeDocsSearchAgent(
          this.llmClient,
          todo.description
        );

        if (searchResult.success && searchResult.result) {
          docsContext = searchResult.result;
          messages.push({
            role: 'assistant',
            content: `[Documentation Search Complete]\n${docsContext}`,
          });
        }
      }

      // 2. Create context (include previous TODO results)
      let contextPrompt = `**Current Task**: ${todo.title}\n\n`;
      contextPrompt += `**Description**: ${todo.description}\n\n`;

      if (docsContext) {
        contextPrompt += `**Related Documentation**:\n${docsContext}\n\n`;
      }

      if (completedTodos.length > 0) {
        contextPrompt += `**Previous Task Results**:\n`;
        completedTodos.forEach((completed) => {
          contextPrompt += `- ${completed.title}: ${completed.result || 'Completed'}\n`;
        });
        contextPrompt += '\n';
      }

      contextPrompt += 'Please execute this task using the available tools.';

      // Add user message with task context
      const updatedMessages = [...messages, {
        role: 'user' as const,
        content: contextPrompt,
      }];

      // 3. Execute Main LLM (with Tools)
      console.log(`🔧 Executing: ${todo.title}`);
      const result = await this.llmClient.chatCompletionWithTools(
        updatedMessages,
        FILE_TOOLS,
        5 // maxIterations
      );

      // 4. Save result
      const finalMessage = result.allMessages[result.allMessages.length - 1];
      const todoResult = finalMessage?.content || 'Task completed successfully';

      todo.status = 'completed';
      todo.result = todoResult;
      todo.completedAt = new Date().toISOString();
      this.onTodoUpdate?.(todo);

      console.log(`✅ Completed: ${todo.title}`);

      return {
        messages: result.allMessages,
        todo,
      };
    } catch (error) {
      // Error handling
      todo.status = 'failed';
      todo.error = error instanceof Error ? error.message : 'Unknown error';
      todo.completedAt = new Date().toISOString();
      this.onTodoUpdate?.(todo);

      console.error(`❌ Failed: ${todo.title} - ${todo.error}`);

      throw error;
    }
  }

  /**
   * Execute all TODOs sequentially
   */
  async executeAll(
    todos: TodoItem[],
    initialMessages: Message[] = []
  ): Promise<{ messages: Message[]; todos: TodoItem[] }> {
    let messages = [...initialMessages];
    const completedTodos: TodoItem[] = [];
    const updatedTodos = [...todos];

    console.log(`\n📋 Executing ${todos.length} TODO(s)...\n`);

    for (let i = 0; i < updatedTodos.length; i++) {
      const todo = updatedTodos[i];
      if (!todo) continue; // Safety check

      console.log(`\n[${i + 1}/${updatedTodos.length}] Starting: ${todo.title}`);

      // Check dependencies
      if (todo.dependencies.length > 0) {
        const allDepsCompleted = todo.dependencies.every((depId) =>
          completedTodos.some((t) => t.id === depId && t.status === 'completed')
        );

        if (!allDepsCompleted) {
          todo.status = 'failed';
          todo.error = 'Dependency TODOs not completed';
          console.warn(`⚠️ Skipping "${todo.title}": Dependencies not met`);
          continue;
        }
      }

      try {
        // Execute TODO
        const result = await this.executeTodo(todo, messages, completedTodos);
        messages = result.messages;
        completedTodos.push(result.todo);
      } catch (error) {
        // Continue with next TODO even if one fails
        console.warn(`⚠️ TODO "${todo.title}" failed, continuing with next...`);

        // Add error message to conversation
        messages.push({
          role: 'assistant',
          content: `Failed to complete "${todo.title}": ${todo.error}`,
        });
      }
    }

    // Summary
    const completedCount = updatedTodos.filter(t => t.status === 'completed').length;
    const failedCount = updatedTodos.filter(t => t.status === 'failed').length;

    console.log(`\n📊 Execution Summary:`);
    console.log(`   ✅ Completed: ${completedCount}/${updatedTodos.length}`);
    if (failedCount > 0) {
      console.log(`   ❌ Failed: ${failedCount}/${updatedTodos.length}`);
    }

    return {
      messages,
      todos: updatedTodos,
    };
  }

  /**
   * Resume execution from a saved state
   */
  async resume(
    todos: TodoItem[],
    messages: Message[]
  ): Promise<{ messages: Message[]; todos: TodoItem[] }> {
    // Find pending TODOs
    const pendingTodos = todos.filter(t => t.status === 'pending' || t.status === 'in_progress');
    const completedTodos = todos.filter(t => t.status === 'completed');

    if (pendingTodos.length === 0) {
      console.log('ℹ️ All TODOs are already completed');
      return { messages, todos };
    }

    // Reset in_progress TODOs to pending
    pendingTodos.forEach(todo => {
      if (todo.status === 'in_progress') {
        todo.status = 'pending';
        todo.startedAt = undefined;
      }
    });

    console.log(`\n🔄 Resuming execution with ${pendingTodos.length} pending TODO(s)...\n`);

    // Continue execution with pending TODOs
    const result = await this.executeAll(pendingTodos, messages);

    // Merge results
    const allTodos = [...completedTodos, ...result.todos];

    return {
      messages: result.messages,
      todos: allTodos,
    };
  }
}

export default TodoExecutor;