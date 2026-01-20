/**
 * Session Manager for Electron Main Process
 * - 세션 저장/로드/삭제
 * - 채팅 히스토리 관리
 * - 자동 저장 기능
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { logger } from './logger';

// 메시지 타입
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

// 세션 타입
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

// 세션 요약 (목록용)
export interface SessionSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  workingDirectory?: string;
  preview?: string;
}

class SessionManager {
  private sessionsDir: string = '';
  private currentSession: Session | null = null;
  private initialized: boolean = false;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private autoSaveInterval: number = 30000; // 30초

  constructor() {}

  /**
   * 세션 디렉토리 경로 반환
   */
  getSessionsDirectory(): string {
    return this.sessionsDir;
  }

  /**
   * 초기화
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Sessions 디렉토리 경로 설정 (Windows: %APPDATA%\LOCAL-CLI-UI\sessions)
    const baseDir = process.platform === 'win32'
      ? path.join(process.env.APPDATA || app.getPath('userData'), 'LOCAL-CLI-UI')
      : app.getPath('userData');
    this.sessionsDir = path.join(baseDir, 'sessions');

    logger.info('Session manager initializing', {
      sessionsDir: this.sessionsDir,
    });

    // Sessions 디렉토리 생성
    await this.ensureSessionsDirectory();

    this.initialized = true;
    logger.info('Session manager initialized');
  }

  /**
   * Sessions 디렉토리 생성
   */
  private async ensureSessionsDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.sessionsDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create sessions directory', error);
    }
  }

  /**
   * 세션 파일 경로 생성
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * 새 세션 생성
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

    // 저장
    await this.saveSession(session);

    // 현재 세션으로 설정
    this.currentSession = session;
    this.startAutoSave();

    logger.info('Session created', { sessionId: id, name: session.name });

    return session;
  }

  /**
   * 세션 저장
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
   * 세션 로드
   */
  async loadSession(sessionId: string): Promise<Session | null> {
    try {
      const filePath = this.getSessionPath(sessionId);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const session = JSON.parse(content) as Session;

      // 현재 세션으로 설정
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
   * 세션 삭제
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const filePath = this.getSessionPath(sessionId);
      await fs.promises.unlink(filePath);

      // 현재 세션이면 해제
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
   * 모든 세션 목록 가져오기
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

          // 마지막 메시지 미리보기
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

      // 최신순 정렬
      sessions.sort((a, b) => b.updatedAt - a.updatedAt);

      return sessions;
    } catch (error) {
      logger.error('Failed to list sessions', error);
      return [];
    }
  }

  /**
   * 현재 세션 가져오기
   */
  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  /**
   * 현재 세션 설정
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
   * 메시지 추가
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
   * 세션 이름 변경
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
   * 세션 복제
   */
  async duplicateSession(sessionId: string): Promise<Session | null> {
    try {
      const original = await this.loadSession(sessionId);
      if (!original) return null;

      const newSession = await this.createSession(
        `${original.name} (복사본)`,
        original.workingDirectory
      );

      newSession.messages = [...original.messages];
      await this.saveSession(newSession);

      return newSession;
    } catch (error) {
      logger.error('Failed to duplicate session', { sessionId, error });
      return null;
    }
  }

  /**
   * 세션 내보내기 (JSON)
   */
  async exportSession(sessionId: string): Promise<string | null> {
    try {
      const session = await this.loadSession(sessionId);
      if (!session) return null;

      return JSON.stringify(session, null, 2);
    } catch (error) {
      logger.error('Failed to export session', { sessionId, error });
      return null;
    }
  }

  /**
   * 세션 가져오기 (JSON)
   */
  async importSession(jsonData: string): Promise<Session | null> {
    try {
      const data = JSON.parse(jsonData) as Session;

      // 새 ID 생성 (중복 방지)
      data.id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      data.name = `${data.name} (가져옴)`;
      data.updatedAt = Date.now();

      await this.saveSession(data);
      return data;
    } catch (error) {
      logger.error('Failed to import session', error);
      return null;
    }
  }

  /**
   * 자동 저장 시작
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
   * 자동 저장 중지
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * 현재 세션 즉시 저장
   */
  async saveCurrentSession(): Promise<boolean> {
    if (!this.currentSession) return false;
    return await this.saveSession(this.currentSession);
  }

  /**
   * 정리 (앱 종료 시)
   */
  async cleanup(): Promise<void> {
    this.stopAutoSave();

    // 현재 세션 저장
    if (this.currentSession) {
      await this.saveSession(this.currentSession);
    }

    logger.info('Session manager cleanup completed');
  }

  /**
   * 세션 검색
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
   * 오래된 세션 정리 (선택적)
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

// 싱글톤 인스턴스
export const sessionManager = new SessionManager();
