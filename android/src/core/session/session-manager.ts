/**
 * Session Manager (Android)
 *
 * AsyncStorage 기반 세션 관리 (CLI의 fs 기반과 동일 로직)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from '../../types';
import { STORAGE_KEY_SESSIONS } from '../constants';
import { logger } from '../../utils/logger';

export interface SessionMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  model: string;
  endpoint: string;
}

export interface SessionData {
  metadata: SessionMetadata;
  messages: Message[];
}

export interface SessionSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  model: string;
  firstMessage?: string;
}

class SessionManager {
  private currentSessionId: string | null = null;
  private currentSessionName: string | null = null;

  constructor() {
    this.currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  setSessionName(name: string): void {
    this.currentSessionName = name;
  }

  async saveSession(
    messages: Message[],
    model: string,
    endpoint: string
  ): Promise<void> {
    if (!this.currentSessionId) return;

    const sessionData: SessionData = {
      metadata: {
        id: this.currentSessionId,
        name: this.currentSessionName || this.generateSessionName(messages),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: messages.length,
        model,
        endpoint,
      },
      messages,
    };

    try {
      const sessionsIndex = await this.getSessionsIndex();
      sessionsIndex[this.currentSessionId] = sessionData.metadata;
      await AsyncStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessionsIndex));
      await AsyncStorage.setItem(
        `${STORAGE_KEY_SESSIONS}/${this.currentSessionId}`,
        JSON.stringify(sessionData)
      );
    } catch (error) {
      logger.error('Failed to save session', error);
    }
  }

  async loadSession(sessionId: string): Promise<SessionData | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_SESSIONS}/${sessionId}`);
      if (!data) return null;
      return JSON.parse(data) as SessionData;
    } catch (error) {
      logger.error('Failed to load session', error);
      return null;
    }
  }

  async listSessions(): Promise<SessionSummary[]> {
    try {
      const index = await this.getSessionsIndex();
      return Object.values(index)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map(meta => ({
          id: meta.id,
          name: meta.name,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
          messageCount: meta.messageCount,
          model: meta.model,
        }));
    } catch (error) {
      logger.error('Failed to list sessions', error);
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const index = await this.getSessionsIndex();
      delete index[sessionId];
      await AsyncStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(index));
      await AsyncStorage.removeItem(`${STORAGE_KEY_SESSIONS}/${sessionId}`);
    } catch (error) {
      logger.error('Failed to delete session', error);
    }
  }

  startNewSession(): void {
    this.currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.currentSessionName = null;
  }

  private async getSessionsIndex(): Promise<Record<string, SessionMetadata>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY_SESSIONS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private generateSessionName(messages: Message[]): string {
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg) {
      return firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
    }
    return `Session ${new Date().toLocaleDateString()}`;
  }
}

export const sessionManager = new SessionManager();
