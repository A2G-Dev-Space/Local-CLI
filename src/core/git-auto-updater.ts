/**
 * Git-based Auto-Update System
 *
 * Updates the CLI by cloning/pulling from GitHub repository
 * No API rate limits, uses pure git commands
 *
 * Refactored to use callbacks for Ink UI compatibility (no console.log/ora)
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger.js';

/**
 * Update status for UI display
 */
export type UpdateStatus =
  | { type: 'checking' }
  | { type: 'no_update' }
  | { type: 'first_run'; step: number; totalSteps: number; message: string }
  | { type: 'updating'; step: number; totalSteps: number; message: string }
  | { type: 'complete'; needsRestart: boolean; message: string }
  | { type: 'error'; message: string }
  | { type: 'skipped'; reason: string };

/**
 * Callback for status updates
 */
export type StatusCallback = (status: UpdateStatus) => void;

/**
 * Execute command asynchronously
 */
function execAsync(command: string, options: { cwd?: string } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd!, args, {
      cwd: options.cwd,
      shell: true,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command failed: ${command}`) as any;
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        reject(error);
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

export class GitAutoUpdater {
  private repoUrl: string = 'https://github.com/A2G-Dev-Space/Local-CLI.git';
  private repoDir: string;
  private enabled: boolean = true;
  private onStatus: StatusCallback | null = null;

  constructor(options?: { repoUrl?: string; enabled?: boolean; onStatus?: StatusCallback }) {
    this.repoDir = path.join(os.homedir(), '.local-cli', 'repo');

    if (options?.repoUrl) {
      this.repoUrl = options.repoUrl;
    }

    if (options?.enabled !== undefined) {
      this.enabled = options.enabled;
    }

    if (options?.onStatus) {
      this.onStatus = options.onStatus;
    }
  }

  /**
   * Set status callback
   */
  setStatusCallback(callback: StatusCallback): void {
    this.onStatus = callback;
  }

  /**
   * Emit status update
   */
  private emitStatus(status: UpdateStatus): void {
    if (this.onStatus) {
      this.onStatus(status);
    }
  }

  /**
   * Main entry point - runs on every 'lcli' command
   * @returns true if updated and needs restart, false otherwise
   */
  async run(options: { noUpdate?: boolean } = {}): Promise<boolean> {
    logger.enter('GitAutoUpdater.run', {
      noUpdate: options.noUpdate,
      enabled: this.enabled,
      repoDir: this.repoDir
    });

    if (options.noUpdate || !this.enabled) {
      logger.flow('Git auto-update disabled - skipping');
      this.emitStatus({ type: 'skipped', reason: 'disabled' });
      return false;
    }

    this.emitStatus({ type: 'checking' });

    try {
      logger.flow('Checking repository directory');

      // Check if repo directory exists
      if (!fs.existsSync(this.repoDir)) {
        logger.flow('First run detected - need initial setup');
        return await this.initialSetup();
      } else {
        // Subsequent runs: pull and update if needed
        return await this.pullAndUpdate();
      }
    } catch (error) {
      logger.error('Git auto-update failed', error);
      this.emitStatus({ type: 'error', message: 'Auto-update failed, continuing with current version' });
    }
    return false;
  }

  /**
   * First run: Clone repository and setup npm link
   */
  private async initialSetup(): Promise<boolean> {
    logger.enter('initialSetup', {
      repoDir: this.repoDir,
      repoUrl: this.repoUrl
    });

    const totalSteps = 4;

    try {
      // Step 1: Clone
      this.emitStatus({ type: 'first_run', step: 1, totalSteps, message: 'Cloning repository...' });

      const parentDir = path.dirname(this.repoDir);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      await execAsync(`git clone ${this.repoUrl} ${this.repoDir}`);

      // Step 2: Install dependencies
      this.emitStatus({ type: 'first_run', step: 2, totalSteps, message: 'Installing dependencies...' });
      await execAsync('npm install', { cwd: this.repoDir });

      // Step 3: Build
      this.emitStatus({ type: 'first_run', step: 3, totalSteps, message: 'Building project...' });
      await execAsync('npm run build', { cwd: this.repoDir });

      // Step 4: Link
      this.emitStatus({ type: 'first_run', step: 4, totalSteps, message: 'Creating global link...' });
      await execAsync('npm link', { cwd: this.repoDir });

      this.emitStatus({ type: 'complete', needsRestart: true, message: 'Setup complete! Please restart.' });
      return true;

    } catch (error: any) {
      logger.error('Initial setup failed', error);
      this.emitStatus({ type: 'error', message: `Setup failed: ${error.message}` });
      return false;
    }
  }

  /**
   * Pull latest changes and rebuild if needed
   * @returns true if updated and needs restart
   */
  private async pullAndUpdate(): Promise<boolean> {
    logger.debug('Checking for updates', { repoDir: this.repoDir });

    try {
      // Try fetch + reset approach (handles force pushes and rebases)
      await execAsync('git fetch origin main', { cwd: this.repoDir });

      // Check if we're already up to date
      const currentResult = await execAsync('git rev-parse HEAD', { cwd: this.repoDir });
      const latestResult = await execAsync('git rev-parse origin/main', { cwd: this.repoDir });

      const currentCommit = currentResult.stdout.trim();
      const latestCommit = latestResult.stdout.trim();

      if (currentCommit === latestCommit) {
        logger.debug('Already up to date, no rebuild needed');
        this.emitStatus({ type: 'no_update' });
        return false;
      }

      // Reset to latest (handles diverged history)
      logger.debug('Resetting to latest commit...', { from: currentCommit.slice(0, 7), to: latestCommit.slice(0, 7) });
      await execAsync('git reset --hard origin/main', { cwd: this.repoDir });

      // Changes detected - rebuild
      return await this.rebuildAndLink();

    } catch (error: any) {
      logger.error('Pull/reset failed, attempting fresh clone', error);

      // If fetch/reset fails, try fresh clone (preserves user data, only deletes repo)
      return await this.freshClone();
    }
  }

  /**
   * Delete repo and re-clone (preserves user config and data)
   */
  private async freshClone(): Promise<boolean> {
    logger.flow('Performing fresh clone');

    try {
      this.emitStatus({ type: 'updating', step: 1, totalSteps: 4, message: 'Removing old repository...' });

      // Remove repo directory
      if (fs.existsSync(this.repoDir)) {
        fs.rmSync(this.repoDir, { recursive: true, force: true });
      }

      // Re-run initial setup (clone, install, build, link)
      return await this.initialSetup();

    } catch (error: any) {
      logger.error('Fresh clone failed', error);
      this.emitStatus({ type: 'error', message: `Fresh clone failed: ${error.message}` });
      return false;
    }
  }

  /**
   * Rebuild and link after update
   */
  private async rebuildAndLink(): Promise<boolean> {
    const totalSteps = 3;

    try {
      // Step 1: Install dependencies
      this.emitStatus({ type: 'updating', step: 1, totalSteps, message: 'Updating dependencies...' });
      await execAsync('npm install', { cwd: this.repoDir });

      // Step 2: Build
      this.emitStatus({ type: 'updating', step: 2, totalSteps, message: 'Building project...' });
      await execAsync('npm run build', { cwd: this.repoDir });

      // Step 3: Re-link
      this.emitStatus({ type: 'updating', step: 3, totalSteps, message: 'Updating global link...' });
      await execAsync('npm link', { cwd: this.repoDir });

      this.emitStatus({ type: 'complete', needsRestart: true, message: 'Update complete! Please restart.' });
      return true;

    } catch (buildError: any) {
      logger.error('Build/link failed', buildError);
      this.emitStatus({ type: 'error', message: `Build failed: ${buildError.message}` });
      return false;
    }
  }

  /**
   * Quick check if updates are available (no download)
   */
  async checkForUpdates(): Promise<{ hasUpdate: boolean; currentCommit?: string; latestCommit?: string }> {
    if (!fs.existsSync(this.repoDir)) {
      return { hasUpdate: true }; // First run
    }

    try {
      // Fetch without merge
      await execAsync('git fetch origin main', { cwd: this.repoDir });

      const currentResult = await execAsync('git rev-parse HEAD', { cwd: this.repoDir });
      const latestResult = await execAsync('git rev-parse origin/main', { cwd: this.repoDir });

      const currentCommit = currentResult.stdout.trim();
      const latestCommit = latestResult.stdout.trim();

      return {
        hasUpdate: currentCommit !== latestCommit,
        currentCommit,
        latestCommit,
      };
    } catch (error) {
      logger.error('Failed to check for updates', error);
      return { hasUpdate: false };
    }
  }

  /**
   * Get current repository status
   */
  async getStatus(): Promise<{ exists: boolean; hasChanges: boolean; currentCommit?: string }> {
    if (!fs.existsSync(this.repoDir)) {
      return { exists: false, hasChanges: false };
    }

    try {
      const statusResult = await execAsync('git status --porcelain', { cwd: this.repoDir });
      const commitResult = await execAsync('git rev-parse HEAD', { cwd: this.repoDir });

      return {
        exists: true,
        hasChanges: statusResult.stdout.trim() !== '',
        currentCommit: commitResult.stdout.trim(),
      };
    } catch (error) {
      logger.error('Failed to get repository status', error);
      return { exists: true, hasChanges: false };
    }
  }
}

export default GitAutoUpdater;
