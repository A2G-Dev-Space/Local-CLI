/**
 * Session Manager
 *
 * 대화 세션을 파일로 저장하고 복구하는 기능
 */

import fs from 'fs/promises';
import path from 'path';
import { Message } from '../types/index.js';
import { configManager } from './config-manager.js';
import { PROJECTS_DIR } from '../constants.js';
import { initializeJsonStreamLogger } from '../utils/json-stream-logger.js';

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
  private currentSessionId: string | null = null;
  private currentSessionCreatedAt: string | null = null;
  private isSaving: boolean = false;

  constructor() {
    // Generate a new session ID for this runtime instance
    this.currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.currentSessionCreatedAt = new Date().toISOString();
  }

  /**
   * Get project-specific sessions directory based on current working directory
   */
  private getSessionsDir(): string {
    // Get current working directory and sanitize it for use in path
    // Replace '/' with '-' and remove leading '-' if present (for absolute paths)
    const cwd = process.cwd().replace(/\//g, '-').replace(/^-/, '');
    return path.join(PROJECTS_DIR, cwd);
  }

  /**
   * 세션 디렉토리 초기화
   */
  async ensureSessionsDir(): Promise<void> {
    const sessionsDir = this.getSessionsDir();
    try {
      await fs.access(sessionsDir);
    } catch {
      await fs.mkdir(sessionsDir, { recursive: true });
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

    // 메시지 키 순서 정규화 (role -> content 순서 보장)
    const normalizedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

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
      messages: normalizedMessages,
    };

    // 파일로 저장
    const sessionsDir = this.getSessionsDir();
    const filePath = path.join(sessionsDir, `${sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');

    return sessionId;
  }

  /**
   * 세션 로드
   */
  async loadSession(sessionId: string): Promise<SessionData | null> {
    await this.ensureSessionsDir();

    const sessionsDir = this.getSessionsDir();
    const filePath = path.join(sessionsDir, `${sessionId}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const sessionData = JSON.parse(content) as SessionData;

      // updatedAt 갱신
      sessionData.metadata.updatedAt = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');

      // 현재 세션 ID를 로드된 세션으로 설정 (이후 대화가 이 세션에 저장되도록)
      this.currentSessionId = sessionData.metadata.id;
      this.currentSessionCreatedAt = sessionData.metadata.createdAt;

      // 로거를 해당 세션의 로그 파일로 재초기화 (append 모드)
      await initializeJsonStreamLogger(sessionData.metadata.id, true);

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
      const sessionsDir = this.getSessionsDir();
      const files = await fs.readdir(sessionsDir);
      // 세션 파일만 필터링 (_log.json, _error.json 제외)
      const sessionFiles = files.filter((f) =>
        f.endsWith('.json') &&
        !f.endsWith('_log.json') &&
        !f.endsWith('_error.json')
      );

      const sessions: SessionSummary[] = [];

      for (const file of sessionFiles) {
        try {
          const filePath = path.join(sessionsDir, file);
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
        } catch (parseError) {
          // Skip invalid session files
          console.error(`Failed to parse session file ${file}:`, parseError);
        }
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

    const sessionsDir = this.getSessionsDir();
    const filePath = path.join(sessionsDir, `${sessionId}.json`);

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

    // 메시지 키 순서 정규화 (role -> content 순서 보장)
    const normalizedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    sessionData.messages = normalizedMessages;
    sessionData.metadata.messageCount = messages.length;
    sessionData.metadata.updatedAt = new Date().toISOString();

    const sessionsDir = this.getSessionsDir();
    const filePath = path.join(sessionsDir, `${sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');

    return true;
  }

  /**
   * 현재 세션 자동 저장 (메시지가 추가될 때마다 호출)
   * Fire-and-forget 방식으로 비동기 저장 (블로킹 없음)
   */
  autoSaveCurrentSession(messages: Message[]): void {
    // Skip if already saving or no messages
    if (this.isSaving || !this.currentSessionId || messages.length === 0) {
      return;
    }

    // Fire-and-forget: 비동기 저장을 백그라운드에서 실행
    this.performAutoSave(messages).catch((err: unknown) => {
      // Silently log errors without blocking
      const error = err as Error;
      console.error('Auto-save failed:', error.message || 'Unknown error');
    });
  }

  /**
   * 실제 저장 작업 수행 (내부 메서드)
   */
  private async performAutoSave(messages: Message[]): Promise<void> {
    this.isSaving = true;

    try {
      await this.ensureSessionsDir();

      // 현재 모델 정보 가져오기
      const endpoint = configManager.getCurrentEndpoint();
      const model = configManager.getCurrentModel();

      // 메시지 키 순서 정규화 (role -> content 순서 보장)
      const normalizedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // 세션 데이터 생성/업데이트
      const sessionData: SessionData = {
        metadata: {
          id: this.currentSessionId!,
          name: `${this.currentSessionId}`,
          createdAt: this.currentSessionCreatedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: messages.length,
          model: model?.id || 'unknown',
          endpoint: endpoint?.baseUrl || 'unknown',
        },
        messages: normalizedMessages,
      };

      // 파일로 저장 (덮어쓰기)
      const sessionsDir = this.getSessionsDir();
      const filePath = path.join(sessionsDir, `${this.currentSessionId!}.json`);
      await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');
    } finally {
      this.isSaving = false;
    }
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
