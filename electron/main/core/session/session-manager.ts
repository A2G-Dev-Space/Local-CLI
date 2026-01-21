/**
 * Session Manager for Electron Main Process
 * Session save/load/delete, chat history management, auto-save
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { logger } from '../../logger';

// =============================================================================
// Types
// =============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    model?: string;
    tokens?: number;
    tool?: string;
    toolResult?: unknown;
  };
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  workingDirectory?: string;
  messages: ChatMessage[];
  metadata?: {
    model?: string;
    totalTokens?: number;
    messageCount?: number;
  };
}

export interface SessionSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  workingDirectory?: string;
  preview?: string;
}

// =============================================================================
// Session Manager Class
// =============================================================================

class SessionManager {
  private sessionsDir: string = '';
  private currentSession: Session | null = null;
  private initialized: boolean = false;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private autoSaveInterval: number = 30000; // 30 seconds

  constructor() {}

  /**
   * Get sessions directory path
   */
  getSessionsDirectory(): string {
    return this.sessionsDir;
  }

  /**
   * Initialize session manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Sessions directory path (Windows: %APPDATA%\LOCAL-CLI-UI\sessions)
    const baseDir = process.platform === 'win32'
      ? path.join(process.env.APPDATA || app.getPath('userData'), 'LOCAL-CLI-UI')
      : app.getPath('userData');
    this.sessionsDir = path.join(baseDir, 'sessions');

    logger.info('Session manager initializing', {
      sessionsDir: this.sessionsDir,
    });

    // Create sessions directory
    await this.ensureSessionsDirectory();

    this.initialized = true;
    logger.info('Session manager initialized');
  }

  /**
   * Ensure sessions directory exists
   */
  private async ensureSessionsDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.sessionsDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create sessions directory', error);
    }
  }

  /**
   * Get session file path
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Create new session
   */
  async createSession(name?: string, workingDirectory?: string): Promise<Session> {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const session: Session = {
      id,
      name: name || `Session ${new Date(now).toLocaleString('ko-KR')}`,
      createdAt: now,
      updatedAt: now,
      workingDirectory,
      messages: [],
      metadata: {
        messageCount: 0,
      },
    };

    // Save
    await this.saveSession(session);

    // Set as current session
    this.currentSession = session;
    this.startAutoSave();

    logger.info('Session created', { sessionId: id, name: session.name });

    return session;
  }

  /**
   * Save session to file
   */
  async saveSession(session: Session): Promise<boolean> {
    try {
      session.updatedAt = Date.now();
      session.metadata = {
        ...session.metadata,
        messageCount: session.messages.length,
      };

      const filePath = this.getSessionPath(session.id);
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(session, null, 2),
        'utf-8'
      );

      logger.debug('Session saved', { sessionId: session.id });
      return true;
    } catch (error) {
      logger.error('Failed to save session', { sessionId: session.id, error });
      return false;
    }
  }

  /**
   * Load session from file
   */
  async loadSession(sessionId: string): Promise<Session | null> {
    try {
      const filePath = this.getSessionPath(sessionId);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const session = JSON.parse(content) as Session;

      // Set as current session
      this.currentSession = session;
      this.startAutoSave();

      logger.info('Session loaded', { sessionId });
      return session;
    } catch (error) {
      logger.error('Failed to load session', { sessionId, error });
      return null;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const filePath = this.getSessionPath(sessionId);
      await fs.promises.unlink(filePath);

      // Clear current session if deleted
      if (this.currentSession?.id === sessionId) {
        this.currentSession = null;
        this.stopAutoSave();
      }

      logger.info('Session deleted', { sessionId });
      return true;
    } catch (error) {
      logger.error('Failed to delete session', { sessionId, error });
      return false;
    }
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<SessionSummary[]> {
    try {
      const files = await fs.promises.readdir(this.sessionsDir);
      const sessions: SessionSummary[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(this.sessionsDir, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const session = JSON.parse(content) as Session;

          // Last message preview
          const lastMessage = session.messages[session.messages.length - 1];
          const preview = lastMessage
            ? lastMessage.content.slice(0, 100) + (lastMessage.content.length > 100 ? '...' : '')
            : '';

          sessions.push({
            id: session.id,
            name: session.name,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: session.messages.length,
            workingDirectory: session.workingDirectory,
            preview,
          });
        } catch (parseError) {
          logger.warn('Failed to parse session file', { file, error: parseError });
        }
      }

      // Sort by most recent
      sessions.sort((a, b) => b.updatedAt - a.updatedAt);

      return sessions;
    } catch (error) {
      logger.error('Failed to list sessions', error);
      return [];
    }
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  /**
   * Set current session
   */
  setCurrentSession(session: Session | null): void {
    this.currentSession = session;
    if (session) {
      this.startAutoSave();
    } else {
      this.stopAutoSave();
    }
  }

  /**
   * Add message to current session
   */
  async addMessage(message: ChatMessage): Promise<boolean> {
    if (!this.currentSession) {
      logger.warn('No current session to add message');
      return false;
    }

    this.currentSession.messages.push(message);
    this.currentSession.updatedAt = Date.now();

    return true;
  }

  /**
   * Rename session
   */
  async renameSession(sessionId: string, newName: string): Promise<boolean> {
    try {
      const session = await this.loadSession(sessionId);
      if (!session) return false;

      session.name = newName;
      return await this.saveSession(session);
    } catch (error) {
      logger.error('Failed to rename session', { sessionId, newName, error });
      return false;
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.stopAutoSave();

    this.autoSaveTimer = setInterval(async () => {
      if (this.currentSession && this.currentSession.messages.length > 0) {
        await this.saveSession(this.currentSession);
      }
    }, this.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Save current session immediately
   */
  async saveCurrentSession(): Promise<boolean> {
    if (!this.currentSession) return false;
    return await this.saveSession(this.currentSession);
  }

  /**
   * Cleanup (on app exit)
   */
  async cleanup(): Promise<void> {
    this.stopAutoSave();

    // Save current session
    if (this.currentSession) {
      await this.saveSession(this.currentSession);
    }

    logger.info('Session manager cleanup completed');
  }

  /**
   * Search sessions
   */
  async searchSessions(query: string): Promise<SessionSummary[]> {
    const sessions = await this.listSessions();
    const lowerQuery = query.toLowerCase();

    return sessions.filter(session => {
      return (
        session.name.toLowerCase().includes(lowerQuery) ||
        session.preview?.toLowerCase().includes(lowerQuery) ||
        session.workingDirectory?.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * Cleanup old sessions (optional)
   */
  async cleanupOldSessions(maxAgeDays: number = 30): Promise<number> {
    const sessions = await this.listSessions();
    const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const session of sessions) {
      if (session.updatedAt < cutoffTime) {
        const deleted = await this.deleteSession(session.id);
        if (deleted) deletedCount++;
      }
    }

    logger.info('Cleaned up old sessions', { deletedCount, maxAgeDays });
    return deletedCount;
  }
}

// =============================================================================
// Export
// =============================================================================

export const sessionManager = new SessionManager();
export default sessionManager;
