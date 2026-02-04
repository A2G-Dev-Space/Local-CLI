/**
 * PowerShell Manager for Electron Main Process
 * - PowerShell 프로세스 생성/관리
 * - 명령어 실행 및 결과 수신
 * - 스트리밍 출력 지원
 * - 에러 핸들링
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from './utils/logger';

// PowerShell 출력 타입
export interface PowerShellOutput {
  type: 'stdout' | 'stderr' | 'error' | 'exit';
  data: string;
  timestamp: number;
}

// PowerShell 실행 결과
export interface PowerShellResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
  duration: number;
}

// PowerShell 세션 상태
export enum SessionState {
  IDLE = 'idle',
  RUNNING = 'running',
  BUSY = 'busy',
  ERROR = 'error',
  TERMINATED = 'terminated',
}

// PowerShell 세션 정보
export interface SessionInfo {
  id: string;
  state: SessionState;
  startTime: number;
  currentDirectory: string;
  lastActivity: number;
}

// PowerShell Manager 설정
export interface PowerShellConfig {
  shell: string;
  encoding: BufferEncoding;
  timeout: number; // ms
  maxBuffer: number; // bytes
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

// PowerShell 경로 찾기
function findPowerShell(): string {
  if (process.platform !== 'win32') {
    return 'pwsh';
  }

  // Windows에서 PowerShell 경로 탐색
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const possiblePaths = [
    `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`,
    `${systemRoot}\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe`,
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
    'powershell.exe', // PATH에 있을 경우
  ];

  // 존재하는 첫 번째 경로 반환
  for (const p of possiblePaths) {
    try {
      const fs = require('fs');
      if (fs.existsSync(p)) {
        return p;
      }
    } catch {
      continue;
    }
  }

  return 'powershell.exe';
}

// UNC 경로 또는 임시 디렉토리를 안전한 경로로 변환
function normalizeWorkingDirectory(dir: string): string {
  // WSL UNC 경로는 Windows에서 PowerShell 시작 디렉토리로 사용 불가
  if (dir.startsWith('\\\\wsl')) {
    return process.env.USERPROFILE || process.env.HOME || 'C:\\';
  }
  // Portable 실행 시 temp 추출 경로 감지 → 홈 디렉토리로 교체
  const lower = dir.toLowerCase();
  const tempDir = (process.env.TEMP || process.env.TMP || '').toLowerCase();
  if (tempDir && lower.startsWith(tempDir)) {
    return process.env.USERPROFILE || process.env.HOME || 'C:\\';
  }
  if (lower.includes('\\appdata\\local\\temp\\') || lower.includes('/tmp/')) {
    return process.env.USERPROFILE || process.env.HOME || 'C:\\';
  }
  return dir;
}

// 기본 설정
const DEFAULT_CONFIG: PowerShellConfig = {
  shell: findPowerShell(),
  encoding: 'utf-8',
  timeout: 300000, // 5분
  maxBuffer: 50 * 1024 * 1024, // 50MB
};

/**
 * PowerShell Manager 클래스
 */
export class PowerShellManager extends EventEmitter {
  private config: PowerShellConfig;
  private process: ChildProcessWithoutNullStreams | null = null;
  private sessionId: string = '';
  private state: SessionState = SessionState.IDLE;
  private startTime: number = 0;
  private currentDirectory: string = '';
  private lastActivity: number = 0;
  private outputBuffer: string = '';
  private commandQueue: Array<{
    command: string;
    resolve: (result: PowerShellResult) => void;
    reject: (error: Error) => void;
    startTime: number;
  }> = [];
  private isProcessingCommand: boolean = false;
  private commandMarker: string = '';
  private commandStartMarker: string = '';
  private commandEndMarker: string = '';

  constructor(config?: Partial<PowerShellConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentDirectory = config?.cwd || process.cwd();
  }

  /**
   * 유니크 ID 생성
   */
  private generateId(): string {
    return `ps_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 마커 생성
   */
  private generateMarkers(): void {
    const uniqueId = Math.random().toString(36).substr(2, 16);
    this.commandMarker = `__CMD_${uniqueId}__`;
    this.commandStartMarker = `${this.commandMarker}_START`;
    this.commandEndMarker = `${this.commandMarker}_END`;
  }

  /**
   * PowerShell 세션 시작
   */
  async startSession(): Promise<SessionInfo> {
    if (this.process && this.state !== SessionState.TERMINATED) {
      logger.warn('PowerShell session already running');
      return this.getSessionInfo();
    }

    this.generateMarkers();
    this.sessionId = this.generateId();
    this.startTime = Date.now();
    this.lastActivity = Date.now();
    this.state = SessionState.RUNNING;

    const args = [
      '-NoLogo',
      '-NoProfile',
      '-NoExit',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      '-',
    ];

    // UNC 경로 정상화
    const safeCwd = normalizeWorkingDirectory(this.currentDirectory);

    logger.info('Starting PowerShell session', {
      sessionId: this.sessionId,
      shell: this.config.shell,
      cwd: safeCwd,
      originalCwd: this.currentDirectory,
    });

    try {
      this.process = spawn(this.config.shell, args, {
        cwd: safeCwd,
        env: {
          ...process.env,
          ...this.config.env,
          TERM: 'dumb',
          PSModulePath: process.env.PSModulePath || '',
        },
        windowsHide: true,
        shell: false,
      });

      // stdout 처리
      this.process.stdout.on('data', (data: Buffer) => {
        const text = data.toString(this.config.encoding);
        this.handleOutput('stdout', text);
      });

      // stderr 처리
      this.process.stderr.on('data', (data: Buffer) => {
        const text = data.toString(this.config.encoding);
        this.handleOutput('stderr', text);
      });

      // 프로세스 종료 처리
      this.process.on('close', (code) => {
        logger.info('PowerShell session closed', { sessionId: this.sessionId, code });
        this.state = SessionState.TERMINATED;
        this.emit('exit', { code, sessionId: this.sessionId });
        this.rejectPendingCommands(new Error(`PowerShell exited with code ${code}`));
        this.process = null;
      });

      // 에러 처리
      this.process.on('error', (err) => {
        logger.error('PowerShell process error', { sessionId: this.sessionId, error: err.message });
        this.state = SessionState.ERROR;
        this.emit('error', { error: err, sessionId: this.sessionId });
        this.rejectPendingCommands(err);
      });

      // 초기화 명령 실행 (UTF-8 설정)
      await this.initializeSession();

      return this.getSessionInfo();
    } catch (error) {
      logger.error('Failed to start PowerShell session', error);
      this.state = SessionState.ERROR;
      throw error;
    }
  }

  /**
   * 세션 초기화
   */
  private async initializeSession(): Promise<void> {
    const initCommands = [
      // UTF-8 출력 설정
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      '$OutputEncoding = [System.Text.Encoding]::UTF8',
      // 프롬프트 비활성화
      'function prompt { "" }',
      // 에러 포맷 설정
      '$ErrorActionPreference = "Continue"',
    ];

    for (const cmd of initCommands) {
      this.writeToProcess(cmd);
    }

    // 초기화 완료 대기
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * 프로세스에 직접 쓰기
   */
  private writeToProcess(command: string): void {
    if (this.process?.stdin.writable) {
      this.process.stdin.write(command + '\n');
    }
  }

  /**
   * 출력 처리
   */
  private handleOutput(type: 'stdout' | 'stderr', data: string): void {
    this.lastActivity = Date.now();

    const output: PowerShellOutput = {
      type,
      data,
      timestamp: Date.now(),
    };

    // 명령 응답 처리
    if (this.isProcessingCommand) {
      this.outputBuffer += data;

      // 명령 종료 마커 확인
      if (this.outputBuffer.includes(this.commandEndMarker)) {
        this.processCommandResponse();
      }
    }

    // 스트리밍 출력 이벤트 발생
    this.emit('output', output);
  }

  /**
   * 명령 응답 처리
   */
  private processCommandResponse(): void {
    const currentCommand = this.commandQueue[0];
    if (!currentCommand) return;

    // 마커 사이의 출력 추출
    const startIdx = this.outputBuffer.indexOf(this.commandStartMarker);
    const endIdx = this.outputBuffer.indexOf(this.commandEndMarker);

    if (startIdx !== -1 && endIdx !== -1) {
      const output = this.outputBuffer.slice(
        startIdx + this.commandStartMarker.length,
        endIdx
      ).trim();

      const duration = Date.now() - currentCommand.startTime;

      const result: PowerShellResult = {
        success: true,
        stdout: output,
        stderr: '',
        exitCode: 0,
        duration,
      };

      currentCommand.resolve(result);
      this.commandQueue.shift();
      this.outputBuffer = '';
      this.isProcessingCommand = false;

      // 다음 명령 처리
      this.processNextCommand();
    }
  }

  /**
   * 다음 명령 처리
   */
  private processNextCommand(): void {
    if (this.commandQueue.length === 0 || this.isProcessingCommand) return;
    if (this.state !== SessionState.RUNNING) return;

    const nextCommand = this.commandQueue[0];
    if (!nextCommand) return;

    this.isProcessingCommand = true;
    this.outputBuffer = '';

    // 마커로 감싼 명령 실행
    const wrappedCommand = [
      `Write-Output '${this.commandStartMarker}'`,
      nextCommand.command,
      `Write-Output '${this.commandEndMarker}'`,
    ].join('\n');

    this.writeToProcess(wrappedCommand);

    // 타임아웃 설정
    setTimeout(() => {
      if (this.isProcessingCommand && this.commandQueue[0] === nextCommand) {
        const duration = Date.now() - nextCommand.startTime;
        nextCommand.reject(new Error(`Command timed out after ${duration}ms`));
        this.commandQueue.shift();
        this.isProcessingCommand = false;
        this.processNextCommand();
      }
    }, this.config.timeout);
  }

  /**
   * 대기 중인 명령 모두 실패 처리
   */
  private rejectPendingCommands(error: Error): void {
    for (const cmd of this.commandQueue) {
      cmd.reject(error);
    }
    this.commandQueue = [];
    this.isProcessingCommand = false;
  }

  /**
   * 명령 실행 (큐잉 방식)
   */
  async execute(command: string): Promise<PowerShellResult> {
    if (!this.process || this.state === SessionState.TERMINATED) {
      await this.startSession();
    }

    logger.debug('Executing PowerShell command', {
      sessionId: this.sessionId,
      command: command.substring(0, 100),
    });

    return new Promise((resolve, reject) => {
      this.commandQueue.push({
        command,
        resolve,
        reject,
        startTime: Date.now(),
      });

      this.processNextCommand();
    });
  }

  /**
   * 단일 명령 실행 (새 프로세스)
   */
  async executeOnce(command: string, cwd?: string): Promise<PowerShellResult> {
    const startTime = Date.now();

    logger.debug('Executing one-shot PowerShell command', {
      command: command.substring(0, 100),
      cwd,
    });

    return new Promise((resolve, reject) => {
      const args = [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        command,
      ];

      const safeCwd = normalizeWorkingDirectory(cwd || this.currentDirectory);
      const proc = spawn(this.config.shell, args, {
        cwd: safeCwd,
        env: { ...process.env, TERM: 'dumb' },
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString(this.config.encoding);
        stdout += text;
        this.emit('output', { type: 'stdout', data: text, timestamp: Date.now() });
      });

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString(this.config.encoding);
        stderr += text;
        this.emit('output', { type: 'stderr', data: text, timestamp: Date.now() });
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
          duration,
        });
      });

      proc.on('error', (err) => {
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          stdout: '',
          stderr: '',
          exitCode: null,
          error: err.message,
          duration,
        });
      });

      // 타임아웃
      setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  /**
   * 인터랙티브 입력 전송
   */
  sendInput(input: string): boolean {
    if (!this.process?.stdin.writable) {
      logger.warn('Cannot send input: PowerShell process not available');
      return false;
    }

    this.lastActivity = Date.now();
    this.writeToProcess(input);
    return true;
  }

  /**
   * 현재 작업 디렉토리 변경
   */
  async changeDirectory(newPath: string): Promise<boolean> {
    try {
      const result = await this.executeOnce(`Set-Location -Path "${newPath}"; Get-Location | Select-Object -ExpandProperty Path`);
      if (result.success && result.stdout) {
        this.currentDirectory = result.stdout.trim();
        logger.info('Changed directory', { newPath: this.currentDirectory });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to change directory', { newPath, error });
      return false;
    }
  }

  /**
   * 현재 작업 디렉토리 가져오기
   */
  async getCurrentDirectory(): Promise<string> {
    try {
      const result = await this.executeOnce('Get-Location | Select-Object -ExpandProperty Path');
      if (result.success && result.stdout) {
        this.currentDirectory = result.stdout.trim();
      }
      return this.currentDirectory;
    } catch (error) {
      return this.currentDirectory;
    }
  }

  /**
   * 세션 정보 가져오기
   */
  getSessionInfo(): SessionInfo {
    return {
      id: this.sessionId,
      state: this.state,
      startTime: this.startTime,
      currentDirectory: this.currentDirectory,
      lastActivity: this.lastActivity,
    };
  }

  /**
   * 세션 상태 확인
   */
  isRunning(): boolean {
    return this.process !== null && this.state === SessionState.RUNNING;
  }

  /**
   * CTRL+C 시그널 전송
   */
  sendInterrupt(): void {
    if (this.process) {
      // Windows에서는 SIGINT 대신 CTRL+C 시뮬레이션
      if (process.platform === 'win32') {
        // 새 PowerShell로 현재 프로세스에 CTRL+C 전송
        spawn('powershell.exe', [
          '-NoProfile',
          '-Command',
          `Stop-Process -Id ${this.process.pid} -Force -ErrorAction SilentlyContinue`,
        ], { windowsHide: true });
      } else {
        this.process.kill('SIGINT');
      }
    }
  }

  /**
   * 세션 종료
   */
  async terminate(): Promise<void> {
    if (this.process) {
      logger.info('Terminating PowerShell session', { sessionId: this.sessionId });

      // 정상 종료 시도
      this.writeToProcess('exit');

      // 1초 후에도 종료되지 않으면 강제 종료
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 1000);

        if (this.process) {
          this.process.once('close', () => {
            clearTimeout(timeout);
            resolve();
          });
        } else {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.process = null;
      this.state = SessionState.TERMINATED;
    }
  }

  /**
   * 세션 재시작
   */
  async restart(): Promise<SessionInfo> {
    await this.terminate();
    return this.startSession();
  }
}

// 기본 PowerShell Manager 인스턴스
export const powerShellManager = new PowerShellManager();
