/**
 * Session Manager
 *
 * 대화 세션을 파일로 저장하고 복구하는 기능
 */

import fs from 'fs/promises';
import path from 'path';
import { Message } from '../types/index.js';
import { configManager } from './config-manager.js';
import { SESSIONS_DIR } from '../constants.js';

/**
 * 세션 메타데이터 인터페이스
 */
export interface SessionMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  model: string;
  endpoint: string;
}

/**
 * 세션 데이터 인터페이스
 */
export interface SessionData {
  metadata: SessionMetadata;
  messages: Message[];
}

/**
 * 세션 요약 인터페이스 (목록 표시용)
 */
export interface SessionSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  model: string;
  firstMessage?: string;
}

/**
 * Session Manager 클래스
 */
export class SessionManager {
  private sessionsDir: string;
  private currentSessionId: string | null = null;

  constructor() {
    this.sessionsDir = SESSIONS_DIR;
    // Generate a new session ID for this runtime instance
    this.currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 세션 디렉토리 초기화
   */
  async ensureSessionsDir(): Promise<void> {
    try {
      await fs.access(this.sessionsDir);
    } catch {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * 세션 저장
   */
  async saveSession(name: string, messages: Message[]): Promise<string> {
    await this.ensureSessionsDir();

    // 세션 ID 생성
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // 현재 모델 정보 가져오기
    const endpoint = configManager.getCurrentEndpoint();
    const model = configManager.getCurrentModel();

    // 세션 데이터 생성
    const sessionData: SessionData = {
      metadata: {
        id: sessionId,
        name: name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: messages.length,
        model: model?.id || 'unknown',
        endpoint: endpoint?.baseUrl || 'unknown',
      },
      messages: messages,
    };

    // 파일로 저장
    const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');

    return sessionId;
  }

  /**
   * 세션 로드
   */
  async loadSession(sessionId: string): Promise<SessionData | null> {
    await this.ensureSessionsDir();

    const filePath = path.join(this.sessionsDir, `${sessionId}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const sessionData = JSON.parse(content) as SessionData;

      // updatedAt 갱신
      sessionData.metadata.updatedAt = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');

      return sessionData;
    } catch (error) {
      return null;
    }
  }

  /**
   * 모든 세션 목록 가져오기
   */
  async listSessions(): Promise<SessionSummary[]> {
    await this.ensureSessionsDir();

    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter((f) => f.endsWith('.json'));

      const sessions: SessionSummary[] = [];

      for (const file of sessionFiles) {
        const filePath = path.join(this.sessionsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const sessionData = JSON.parse(content) as SessionData;

        // 첫 번째 사용자 메시지 찾기
        const firstUserMessage = sessionData.messages.find((m) => m.role === 'user');

        sessions.push({
          id: sessionData.metadata.id,
          name: sessionData.metadata.name,
          createdAt: sessionData.metadata.createdAt,
          updatedAt: sessionData.metadata.updatedAt,
          messageCount: sessionData.metadata.messageCount,
          model: sessionData.metadata.model,
          firstMessage: firstUserMessage?.content?.substring(0, 50),
        });
      }

      // 최근 업데이트 순으로 정렬
      sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return sessions;
    } catch (error) {
      return [];
    }
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    await this.ensureSessionsDir();

    const filePath = path.join(this.sessionsDir, `${sessionId}.json`);

    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 이름으로 세션 찾기
   */
  async findSessionByName(name: string): Promise<SessionSummary | null> {
    const sessions = await this.listSessions();
    return sessions.find((s) => s.name === name) || null;
  }

  /**
   * 세션 갱신 (메시지 추가)
   */
  async updateSession(sessionId: string, messages: Message[]): Promise<boolean> {
    await this.ensureSessionsDir();

    const sessionData = await this.loadSession(sessionId);
    if (!sessionData) {
      return false;
    }

    sessionData.messages = messages;
    sessionData.metadata.messageCount = messages.length;
    sessionData.metadata.updatedAt = new Date().toISOString();

    const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');

    return true;
  }

  /**
   * 현재 세션 ID 가져오기
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * 현재 세션 ID 설정
   */
  setCurrentSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }
}

/**
 * SessionManager 싱글톤 인스턴스
 */
export const sessionManager = new SessionManager();
