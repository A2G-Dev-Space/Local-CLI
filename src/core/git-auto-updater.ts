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
import { rm, copyFile, chmod, writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import { isRunningAsBinary } from './binary-auto-updater.js';

const gunzip = promisify(zlib.gunzip);

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
    this.repoDir = path.join(os.homedir(), '.nexus-coder', 'repo');

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
   * First run: Clone repository and setup
   */
  private async initialSetup(): Promise<boolean> {
    logger.enter('initialSetup', {
      repoDir: this.repoDir,
      repoUrl: this.repoUrl,
      isBinaryMode: isRunningAsBinary()
    });

    const isBinary = isRunningAsBinary();
    const totalSteps = isBinary ? 2 : 4;

    try {
      // Step 1: Clone
      this.emitStatus({ type: 'first_run', step: 1, totalSteps, message: 'Cloning repository...' });

      const parentDir = path.dirname(this.repoDir);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      await execAsync(`git clone -b nexus-coder ${this.repoUrl} ${this.repoDir}`);

      if (isBinary) {
        // Binary mode: just copy pre-built binaries
        this.emitStatus({ type: 'first_run', step: 2, totalSteps, message: 'Copying binaries...' });
        return await this.copyBinaries();
      } else {
        // Node.js mode: install, build, link
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
      }

    } catch (error: unknown) {
      logger.error('Initial setup failed', error as Error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatus({ type: 'error', message: `Setup failed: ${message}` });
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
      await execAsync('git fetch origin nexus-coder', { cwd: this.repoDir });

      // Check if we're already up to date
      const currentResult = await execAsync('git rev-parse HEAD', { cwd: this.repoDir });
      const latestResult = await execAsync('git rev-parse origin/nexus-coder', { cwd: this.repoDir });

      const currentCommit = currentResult.stdout.trim();
      const latestCommit = latestResult.stdout.trim();


      if (currentCommit === latestCommit) {
        logger.debug('Repository up to date');

        // Always copy binaries to ensure ~/.local/bin/nexus is up to date
        logger.debug('Ensuring binary is up to date...');
        await this.copyBinaries();

        this.emitStatus({ type: 'no_update' });
        return false;
      }

      // Reset to latest (handles diverged history)
      logger.debug('Resetting to latest commit...', { from: currentCommit.slice(0, 7), to: latestCommit.slice(0, 7) });
      await execAsync('git reset --hard origin/nexus-coder', { cwd: this.repoDir });

      // Always copy binaries, and rebuild if running in Node.js mode
      await this.copyBinaries();
      if (!isRunningAsBinary()) {
        return await this.rebuildAndLink();
      }
      return true;

    } catch (error: unknown) {
      logger.error('Pull/reset failed, attempting fresh clone', error as Error);

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

      // Remove repo directory (force: true prevents error if not exists)
      await rm(this.repoDir, { recursive: true, force: true });

      // Re-run initial setup (clone, install, build, link)
      return await this.initialSetup();

    } catch (error: unknown) {
      logger.error('Fresh clone failed', error as Error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatus({ type: 'error', message: `Fresh clone failed: ${message}` });
      return false;
    }
  }

  /**
   * Rebuild and link after update (Node.js mode)
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

    } catch (buildError: unknown) {
      logger.error('Build/link failed', buildError as Error);
      const message = buildError instanceof Error ? buildError.message : 'Unknown error';
      this.emitStatus({ type: 'error', message: `Build failed: ${message}` });
      return false;
    }
  }

  /**
   * Copy pre-built binaries (Binary mode)
   * Extracts bin/nexus.gz and copies bin/yoga.wasm to ~/.local/bin/
   * Also adds ~/.local/bin to PATH if needed
   */
  private async copyBinaries(): Promise<boolean> {
    const totalSteps = 3;

    try {
      const repoBinDir = path.join(this.repoDir, 'bin');
      const installDir = path.join(os.homedir(), '.local', 'bin');

      // DEBUG LOGGING

      const nexusGzSrc = path.join(repoBinDir, 'nexus.gz');
      const yogaSrc = path.join(repoBinDir, 'yoga.wasm');
      const nexusDest = path.join(installDir, 'nexus');
      const yogaDest = path.join(installDir, 'yoga.wasm');

      // Check if source files exist
      if (!fs.existsSync(nexusGzSrc)) {
        this.emitStatus({ type: 'error', message: 'Binary not found in repository (bin/nexus.gz)' });
        return false;
      }

      // Ensure install directory exists
      if (!fs.existsSync(installDir)) {
        fs.mkdirSync(installDir, { recursive: true });
      }

      // Step 1: Extract and copy nexus binary
      this.emitStatus({ type: 'updating', step: 1, totalSteps, message: 'Extracting nexus binary...' });

      // Read gzipped file and decompress
      const gzippedData = fs.readFileSync(nexusGzSrc);
      const decompressedData = await gunzip(gzippedData);

      // Remove existing binary first to avoid ETXTBSY error
      // (Linux allows unlinking a running binary, but not overwriting it)
      await rm(nexusDest, { force: true });
      await writeFile(nexusDest, decompressedData);
      await chmod(nexusDest, 0o755);

      // Step 2: Copy yoga.wasm
      this.emitStatus({ type: 'updating', step: 2, totalSteps, message: 'Copying yoga.wasm...' });

      if (fs.existsSync(yogaSrc)) {
        await copyFile(yogaSrc, yogaDest);
      } else {
      }

      // Step 3: Add to PATH and cleanup npm link
      this.emitStatus({ type: 'updating', step: 3, totalSteps, message: 'Configuring PATH...' });
      await this.ensurePathConfigured(installDir);
      await this.unlinkNpm();

      // Detect shell for user-friendly message
      const shell = process.env['SHELL'] || '/bin/bash';
      const rcFile = shell.includes('zsh') ? '~/.zshrc' : '~/.bashrc';
      const restartMsg = `Update complete! Run: source ${rcFile} && nexus`;
      this.emitStatus({ type: 'complete', needsRestart: true, message: restartMsg });
      return true;

    } catch (error: unknown) {
      logger.error('Copy binaries failed', error as Error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatus({ type: 'error', message: `Binary copy failed: ${message}` });
      return false;
    }
  }

  /**
   * Ensure ~/.local/bin is in PATH by updating shell config
   */
  private async ensurePathConfigured(binDir: string): Promise<void> {
    const pathExport = `export PATH="${binDir}:$PATH"`;
    const marker = '# nexus-coder binary';

    // Detect shell config file
    const shell = process.env['SHELL'] || '/bin/bash';
    let rcFile: string;
    if (shell.includes('zsh')) {
      rcFile = path.join(os.homedir(), '.zshrc');
    } else {
      rcFile = path.join(os.homedir(), '.bashrc');
    }


    try {
      // Check if already configured
      let content = '';
      if (fs.existsSync(rcFile)) {
        content = fs.readFileSync(rcFile, 'utf-8');
      }

      if (content.includes(marker) || content.includes(binDir)) {
        return;
      }

      // Append PATH configuration
      const addition = `\n${marker}\n${pathExport}\n`;
      fs.appendFileSync(rcFile, addition);

    } catch (error) {
      // Non-fatal - user can add manually
    }
  }

  /**
   * Unlink npm global package to avoid conflict with binary
   */
  private async unlinkNpm(): Promise<void> {
    try {
      await execAsync('npm unlink -g nexus-coder');
    } catch (error) {
      // npm not available or package not linked - ignore
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
      await execAsync('git fetch origin nexus-coder', { cwd: this.repoDir });

      const currentResult = await execAsync('git rev-parse HEAD', { cwd: this.repoDir });
      const latestResult = await execAsync('git rev-parse origin/nexus-coder', { cwd: this.repoDir });

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
