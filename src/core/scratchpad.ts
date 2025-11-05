/**
 * External Scratchpad System
 *
 * Maintains TODO lists and progress tracking in markdown format
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ScratchpadContent,
  ScratchpadTodoItem,
} from '../types/index.js';

// Simple ID generator
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export class Scratchpad {
  private filePath: string;
  private content: ScratchpadContent;
  private autoSave: boolean = true;

  constructor(
    projectPath: string,
    sessionId?: string,
    autoSave: boolean = true
  ) {
    this.filePath = path.join(
      projectPath,
      '.open-cli',
      'scratchpad',
      `${sessionId || 'current'}.md`
    );

    this.autoSave = autoSave;

    // Initialize empty content
    this.content = {
      sessionId: sessionId || 'current',
      created: Date.now(),
      updated: Date.now(),
      sections: []
    };
  }

  /**
   * Load scratchpad from file
   */
  async load(): Promise<void> {
    try {
      const fileContent = await fs.readFile(this.filePath, 'utf-8');
      this.content = this.parseMarkdown(fileContent);
    } catch (error) {
      // File doesn't exist, use initialized content
      console.debug('No existing scratchpad found, creating new one');
    }
  }

  /**
   * Add a TODO list
   */
  async addTodoList(todos: ScratchpadTodoItem[]): Promise<void> {
    const markdown = this.generateTodoMarkdown(todos);

    this.content.sections.push({
      type: 'todo-list',
      title: 'Task Breakdown',
      content: markdown,
      created: Date.now(),
      items: todos
    });

    if (this.autoSave) {
      await this.save();
    }
  }

  /**
   * Update TODO status
   */
  async updateTodoStatus(
    todoId: string,
    status: TodoStatus,
    notes?: string
  ): Promise<void> {
    for (const section of this.content.sections) {
      if (section.type === 'todo-list' && section.items) {
        const todo = section.items.find(t => t.id === todoId);
        if (todo) {
          todo.status = status;
          if (notes) {
            todo.notes = notes;
          }
          todo.updatedAt = Date.now();

          // Regenerate markdown
          section.content = this.generateTodoMarkdown(section.items);

          if (this.autoSave) {
            await this.save();
          }
          return;
        }
      }
    }
  }

  /**
   * Update subtask completion
   */
  async updateSubtask(
    todoId: string,
    subtaskId: string,
    completed: boolean
  ): Promise<void> {
    for (const section of this.content.sections) {
      if (section.type === 'todo-list' && section.items) {
        const todo = section.items.find(t => t.id === todoId);
        if (todo && todo.subtasks) {
          const subtask = todo.subtasks.find(s => s.id === subtaskId);
          if (subtask) {
            subtask.completed = completed;
            todo.updatedAt = Date.now();

            // Regenerate markdown
            section.content = this.generateTodoMarkdown(section.items);

            if (this.autoSave) {
              await this.save();
            }
            return;
          }
        }
      }
    }
  }

  /**
   * Generate markdown for TODO list
   */
  private generateTodoMarkdown(todos: ScratchpadTodoItem[]): string {
    const lines: string[] = ['## TODO List', ''];

    for (const todo of todos) {
      const checkbox = todo.status === 'completed' ? '[x]' : '[ ]';
      let statusEmoji = '';

      switch (todo.status) {
        case 'in_progress': statusEmoji = ' 🔄'; break;
        case 'failed': statusEmoji = ' ❌'; break;
        case 'completed': statusEmoji = ' ✅'; break;
      }

      lines.push(`- ${checkbox} **${todo.title}**${statusEmoji}`);

      if (todo.description) {
        lines.push(`  ${todo.description}`);
      }

      if (todo.notes) {
        lines.push(`  > ${todo.notes}`);
      }

      if (todo.subtasks && todo.subtasks.length > 0) {
        for (const subtask of todo.subtasks) {
          const subCheck = subtask.completed ? '[x]' : '[ ]';
          lines.push(`  - ${subCheck} ${subtask.title}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Add a note
   */
  async addNote(note: string, type: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    const icon = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌'
    }[type];

    this.content.sections.push({
      type: 'note',
      content: `${icon} **Note**: ${note}`,
      created: Date.now()
    });

    if (this.autoSave) {
      await this.save();
    }
  }

  /**
   * Add code block
   */
  async addCode(
    code: string,
    language: string = 'typescript',
    title?: string
  ): Promise<void> {
    const content = `${title ? `### ${title}\n\n` : ''}\`\`\`${language}\n${code}\n\`\`\``;

    this.content.sections.push({
      type: 'code',
      title,
      content,
      created: Date.now()
    });

    if (this.autoSave) {
      await this.save();
    }
  }

  /**
   * Add diagram (mermaid or ASCII)
   */
  async addDiagram(diagram: string, title?: string): Promise<void> {
    const content = title ? `### ${title}\n\n${diagram}` : diagram;

    this.content.sections.push({
      type: 'diagram',
      title,
      content,
      created: Date.now()
    });

    if (this.autoSave) {
      await this.save();
    }
  }

  /**
   * Get current TODOs
   */
  getTodos(): ScratchpadTodoItem[] {
    const todos: ScratchpadTodoItem[] = [];

    for (const section of this.content.sections) {
      if (section.type === 'todo-list' && section.items) {
        todos.push(...section.items);
      }
    }

    return todos;
  }

  /**
   * Get completion status
   */
  getCompletionStatus(): {
    total: number;
    completed: number;
    inProgress: number;
    failed: number;
    pending: number;
    percentage: number;
  } {
    const todos = this.getTodos();
    const total = todos.length;
    const completed = todos.filter(t => t.status === 'completed').length;
    const inProgress = todos.filter(t => t.status === 'in_progress').length;
    const failed = todos.filter(t => t.status === 'failed').length;
    const pending = todos.filter(t => t.status === 'pending').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, failed, pending, percentage };
  }

  /**
   * Get markdown content
   */
  getMarkdown(): string {
    const sections = this.content.sections
      .map(s => s.content)
      .join('\n\n---\n\n');

    const status = this.getCompletionStatus();

    return `# Scratchpad - ${this.content.sessionId}

Created: ${new Date(this.content.created).toISOString()}
Last Updated: ${new Date(this.content.updated).toISOString()}

## Progress
- Total Tasks: ${status.total}
- Completed: ${status.completed} (${status.percentage}%)
- In Progress: ${status.inProgress}
- Failed: ${status.failed}
- Pending: ${status.pending}

---

${sections}`;
  }

  /**
   * Save to file
   */
  async save(): Promise<void> {
    const markdown = this.getMarkdown();
    const dir = path.dirname(this.filePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, markdown, 'utf-8');
    this.content.updated = Date.now();
  }

  /**
   * Parse markdown to content (simplified)
   */
  private parseMarkdown(markdown: string): ScratchpadContent {
    const content: ScratchpadContent = {
      sessionId: 'current',
      created: Date.now(),
      updated: Date.now(),
      sections: []
    };

    // Extract session ID from header if present
    const sessionMatch = markdown.match(/# Scratchpad - (\S+)/);
    if (sessionMatch && sessionMatch[1]) {
      content.sessionId = sessionMatch[1];
    }

    // Extract created/updated dates
    const createdMatch = markdown.match(/Created: ([^\n]+)/);
    if (createdMatch && createdMatch[1]) {
      content.created = new Date(createdMatch[1]).getTime();
    }

    const updatedMatch = markdown.match(/Last Updated: ([^\n]+)/);
    if (updatedMatch && updatedMatch[1]) {
      content.updated = new Date(updatedMatch[1]).getTime();
    }

    // Split by horizontal rules
    const sectionTexts = markdown.split(/\n---\n/);

    for (const sectionText of sectionTexts) {
      if (sectionText.includes('## TODO List')) {
        // Parse TODO list
        const todos = this.parseTodoList(sectionText);
        content.sections.push({
          type: 'todo-list',
          title: 'Task Breakdown',
          content: sectionText,
          created: Date.now(),
          items: todos
        });
      } else if (sectionText.includes('```')) {
        // Code block
        content.sections.push({
          type: 'code',
          content: sectionText,
          created: Date.now()
        });
      } else if (sectionText.includes('Note:')) {
        // Note
        content.sections.push({
          type: 'note',
          content: sectionText,
          created: Date.now()
        });
      }
    }

    return content;
  }

  /**
   * Parse TODO list from markdown
   */
  private parseTodoList(markdown: string): ScratchpadTodoItem[] {
    const todos: ScratchpadTodoItem[] = [];
    const lines = markdown.split('\n');

    let currentTodo: ScratchpadTodoItem | null = null;

    for (const line of lines) {
      // Main TODO item
      const todoMatch = line.match(/^- \[([ x])\] \*\*(.+?)\*\*/);
      if (todoMatch) {
        if (currentTodo) {
          todos.push(currentTodo);
        }

        const completed = todoMatch[1] === 'x';
        const title = todoMatch[2] || '';

        currentTodo = {
          id: generateId(),
          title: title.replace(/[✅🔄❌]/g, '').trim(),
          status: completed ? 'completed' : 'pending',
          createdAt: Date.now(),
          subtasks: []
        };

        // Detect status from emoji
        if (line.includes('🔄')) currentTodo.status = 'in_progress';
        if (line.includes('❌')) currentTodo.status = 'failed';
        if (line.includes('✅')) currentTodo.status = 'completed';
      }

      // Subtask
      else if (currentTodo && line.match(/^\s+- \[([ x])\] (.+)/)) {
        const subtaskMatch = line.match(/^\s+- \[([ x])\] (.+)/);
        if (subtaskMatch && currentTodo.subtasks) {
          currentTodo.subtasks.push({
            id: generateId(),
            title: subtaskMatch[2] || '',
            completed: subtaskMatch[1] === 'x'
          });
        }
      }

      // Description or note
      else if (currentTodo && line.match(/^\s+[^-]/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith('>')) {
          currentTodo.notes = trimmed.substring(1).trim();
        } else if (trimmed) {
          currentTodo.description = trimmed;
        }
      }
    }

    if (currentTodo) {
      todos.push(currentTodo);
    }

    return todos;
  }

  /**
   * Clear scratchpad
   */
  clear(): void {
    this.content.sections = [];
    this.content.updated = Date.now();
  }

  /**
   * Get file path
   */
  getFilePath(): string {
    return this.filePath;
  }
}

export default Scratchpad;