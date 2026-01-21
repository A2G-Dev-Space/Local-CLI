/**
 * Config Manager for Electron Main Process
 * - 사용자 설정 저장/로드
 * - 테마, 레이아웃 등 설정 관리
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { logger } from './logger';

// 색상 팔레트 타입
export type ColorPalette = 'default' | 'rose' | 'mint' | 'lavender' | 'peach' | 'sky';

// 글씨 크기 (10-18px 범위)
export type FontSize = number;

// 설정 타입 정의
export interface AppConfig {
  theme: 'light' | 'dark' | 'system';
  colorPalette: ColorPalette;
  fontSize: FontSize;
  lastOpenedDirectory?: string;
  recentDirectories: string[];
  sidebarWidth: number;
  bottomPanelHeight: number;
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// 기본 설정
const DEFAULT_CONFIG: AppConfig = {
  theme: 'light',
  colorPalette: 'default',
  fontSize: 12,  // 기본값 12px (사용자 요청: 작게)
  recentDirectories: [],
  sidebarWidth: 260,
  bottomPanelHeight: 300,
};

class ConfigManager {
  private configPath: string;
  private config: AppConfig;
  private initialized: boolean = false;

  constructor() {
    this.configPath = '';
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Config 디렉토리 경로 반환
   */
  getConfigDirectory(): string {
    return path.dirname(this.configPath);
  }

  /**
   * Config 파일 경로 반환
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 초기화
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Config 파일 경로 설정 (Windows: %APPDATA%\LOCAL-CLI-UI)
    const appDataPath = process.platform === 'win32'
      ? path.join(process.env.APPDATA || app.getPath('userData'), 'LOCAL-CLI-UI')
      : app.getPath('userData');
    this.configPath = path.join(appDataPath, 'config.json');

    logger.info('Config path', {
      configPath: this.configPath,
    });

    // Config 디렉토리 생성
    await this.ensureConfigDirectory();

    // 기존 설정 로드
    await this.load();

    this.initialized = true;
  }

  /**
   * Config 디렉토리 생성
   */
  private async ensureConfigDirectory(): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create config directory', error);
    }
  }

  /**
   * 설정 로드
   */
  async load(): Promise<AppConfig> {
    try {
      const content = await fs.promises.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(content);
      this.config = { ...DEFAULT_CONFIG, ...loadedConfig };
      logger.info('Config loaded', { config: this.config });
    } catch (error) {
      // 파일이 없으면 기본값 사용
      this.config = { ...DEFAULT_CONFIG };
      logger.info('Using default config (file not found)');
    }
    return this.config;
  }

  /**
   * 설정 저장
   */
  async save(): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
      logger.debug('Config saved', { config: this.config });
    } catch (error) {
      logger.error('Failed to save config', error);
    }
  }

  /**
   * 전체 설정 가져오기
   */
  getAll(): AppConfig {
    return { ...this.config };
  }

  /**
   * 특정 설정 가져오기
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * 특정 설정 업데이트
   */
  async set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<void> {
    this.config[key] = value;
    await this.save();
  }

  /**
   * 여러 설정 업데이트
   */
  async update(updates: Partial<AppConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.save();
  }

  /**
   * 테마 설정
   */
  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await this.set('theme', theme);
  }

  /**
   * 테마 가져오기
   */
  getTheme(): 'light' | 'dark' | 'system' {
    return this.config.theme;
  }

  /**
   * 최근 디렉토리 추가
   */
  async addRecentDirectory(directory: string): Promise<void> {
    const recent = this.config.recentDirectories.filter(d => d !== directory);
    recent.unshift(directory);
    this.config.recentDirectories = recent.slice(0, 10); // 최대 10개 유지
    this.config.lastOpenedDirectory = directory;
    await this.save();
  }

  /**
   * 최근 디렉토리 목록 가져오기
   */
  getRecentDirectories(): string[] {
    return [...this.config.recentDirectories];
  }

  /**
   * 설정 초기화
   */
  async reset(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.save();
  }
}

// 싱글톤 인스턴스
export const configManager = new ConfigManager();
