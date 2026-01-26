/**
 * Auto-Update System
 *
 * Updates the CLI by downloading from internal server or GitHub repository
 * Binary mode: Downloads from a2g.samsungds.net
 * Node.js mode: Uses git clone/pull from GitHub
 *
 * Refactored to use callbacks for Ink UI compatibility (no console.log/ora)
 */

import { spawn } from 'child_process';
import fs, { createReadStream, createWriteStream } from 'fs';
import { rm, copyFile, chmod, writeFile } from 'fs/promises';
import { pipeline } from 'stream/promises';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import http from 'http';
import { logger } from '../utils/logger.js';
import { isRunningAsBinary } from './binary-auto-updater.js';

/**
 * Internal binary server configuration
 */
const BINARY_SERVER_URL = 'http://a2g.samsungds.net:13000/nexus-coder/cli';
const LATEST_JSON_URL = `${BINARY_SERVER_URL}/latest.json`;

/**
 * Latest version info from server
 */
interface LatestVersionInfo {
  version: string;
  binaryUrl: string;
  wasmUrl: string;
  releaseDate?: string;
}

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
  private commitFile: string;
  private versionFile: string;
  private enabled: boolean = true;
  private onStatus: StatusCallback | null = null;

  constructor(options?: { repoUrl?: string; enabled?: boolean; onStatus?: StatusCallback }) {
    this.repoDir = path.join(os.homedir(), '.nexus-coder', 'repo');
    this.commitFile = path.join(os.homedir(), '.nexus-coder', 'current-commit');
    this.versionFile = path.join(os.homedir(), '.nexus-coder', 'current-version');

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
      // In binary mode, cleanup any leftover repo from previous versions
      // This prevents source code exposure from older installations
      if (isRunningAsBinary() && fs.existsSync(this.repoDir)) {
        logger.flow('Cleaning up leftover repo from previous version');
        await this.cleanupRepo();
      }

      // Binary mode: use git ls-remote to check for updates without cloning
      if (isRunningAsBinary()) {
        return await this.runBinaryMode();
      }

      // Node.js mode: use traditional repo-based approach
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
   * Binary mode: Check for updates from internal server
   * Flow: fetch latest.json → compare version → download binary if needed
   */
  private async runBinaryMode(): Promise<boolean> {
    logger.flow('Running in binary mode - checking internal server for updates');

    try {
      // Get latest version info from internal server
      const latestInfo = await this.fetchLatestVersionInfo();
      if (!latestInfo) {
        logger.error('Failed to get latest version info');
        // Fallback to git-based update
        logger.flow('Falling back to git-based update');
        return await this.runBinaryModeGit();
      }

      // Get saved version from file
      const savedVersion = this.getSavedVersion();

      logger.debug('Version check', { remote: latestInfo.version, saved: savedVersion || 'none' });

      // Compare versions
      if (savedVersion === latestInfo.version) {
        logger.flow('Already up to date');
        this.emitStatus({ type: 'no_update' });
        return false;
      }

      // Need update - download from internal server
      logger.flow('Update available, starting download from internal server');
      return await this.downloadAndInstallBinary(latestInfo);

    } catch (error) {
      logger.error('Binary mode update failed', error);
      // Fallback to git-based update
      logger.flow('Error occurred, falling back to git-based update');
      return await this.runBinaryModeGit();
    }
  }

  /**
   * Fallback: Binary mode using git (original logic)
   */
  private async runBinaryModeGit(): Promise<boolean> {
    logger.flow('Running in binary mode - using git ls-remote for update check');

    try {
      // Get remote latest commit using ls-remote (no clone needed)
      const remoteCommit = await this.getRemoteCommit();
      if (!remoteCommit) {
        logger.error('Failed to get remote commit');
        this.emitStatus({ type: 'error', message: 'Failed to check for updates' });
        return false;
      }

      // Get saved commit from file
      const savedCommit = this.getSavedCommit();

      logger.debug('Version check (git)', { remote: remoteCommit.slice(0, 7), saved: savedCommit?.slice(0, 7) || 'none' });

      // Compare commits
      if (savedCommit === remoteCommit) {
        logger.flow('Already up to date');
        this.emitStatus({ type: 'no_update' });
        return false;
      }

      // Need update - clone, extract, cleanup
      logger.flow('Update available, starting git-based update process');
      return await this.updateBinary(remoteCommit);

    } catch (error) {
      logger.error('Git-based binary mode update failed', error);
      this.emitStatus({ type: 'error', message: 'Update check failed' });
      return false;
    }
  }

  /**
   * Fetch latest.json from internal server
   */
  private async fetchLatestVersionInfo(): Promise<LatestVersionInfo | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        logger.debug('Timeout fetching latest.json');
        resolve(null);
      }, 5000); // 5 second timeout

      http.get(LATEST_JSON_URL, (res) => {
        if (res.statusCode !== 200) {
          clearTimeout(timeout);
          logger.debug('Failed to fetch latest.json: ' + res.statusCode);
          resolve(null);
          return;
        }

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeout);
          try {
            const info = JSON.parse(data) as LatestVersionInfo;
            resolve(info);
          } catch (e) {
            logger.debug('Failed to parse latest.json');
            resolve(null);
          }
        });
      }).on('error', (err) => {
        clearTimeout(timeout);
        logger.debug('Error fetching latest.json: ' + err.message);
        resolve(null);
      });
    });
  }

  /**
   * Get saved version from file
   */
  private getSavedVersion(): string | null {
    try {
      if (fs.existsSync(this.versionFile)) {
        return fs.readFileSync(this.versionFile, 'utf-8').trim();
      }
    } catch (error) {
      logger.debug('Failed to read saved version: ' + (error instanceof Error ? error.message : String(error)));
    }
    return null;
  }

  /**
   * Save version to file
   */
  private saveVersion(version: string): void {
    try {
      const dir = path.dirname(this.versionFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.versionFile, version);
      logger.debug('Saved version: ' + version);
    } catch (error) {
      logger.debug('Failed to save version: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Download file from URL
   */
  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destPath);

      http.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download: ${res.statusCode}`));
          return;
        }

        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {}); // Delete partial file
        reject(err);
      });
    });
  }

  /**
   * Download and install binary from internal server
   */
  private async downloadAndInstallBinary(info: LatestVersionInfo): Promise<boolean> {
    const totalSteps = 3;
    const isFirstRun = !this.getSavedVersion();
    const statusType = isFirstRun ? 'first_run' : 'updating';

    try {
      const installDir = path.join(os.homedir(), '.local', 'bin');
      const tempDir = path.join(os.homedir(), '.nexus-coder', 'temp');
      const nexusGzTemp = path.join(tempDir, 'nexus.gz');
      const yogaTemp = path.join(tempDir, 'yoga.wasm');
      const nexusDest = path.join(installDir, 'nexus');
      const yogaDest = path.join(installDir, 'yoga.wasm');

      // Ensure directories exist
      if (!fs.existsSync(installDir)) {
        fs.mkdirSync(installDir, { recursive: true });
      }
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Step 1: Download binary
      this.emitStatus({ type: statusType, step: 1, totalSteps, message: `Downloading v${info.version}...` } as UpdateStatus);
      await this.downloadFile(info.binaryUrl, nexusGzTemp);

      // Download yoga.wasm (optional, don't fail if missing)
      try {
        await this.downloadFile(info.wasmUrl, yogaTemp);
      } catch (e) {
        logger.debug('yoga.wasm download failed (optional): ' + (e instanceof Error ? e.message : String(e)));
      }

      // Step 2: Extract and install
      this.emitStatus({ type: statusType, step: 2, totalSteps, message: 'Installing update...' } as UpdateStatus);

      // Remove existing binary first to avoid ETXTBSY error
      await rm(nexusDest, { force: true });
      await pipeline(
        createReadStream(nexusGzTemp),
        zlib.createGunzip(),
        createWriteStream(nexusDest)
      );
      await chmod(nexusDest, 0o755);

      // Copy yoga.wasm if downloaded
      if (fs.existsSync(yogaTemp)) {
        await copyFile(yogaTemp, yogaDest);
      }

      // Step 3: Cleanup and save version
      this.emitStatus({ type: statusType, step: 3, totalSteps, message: 'Finalizing...' } as UpdateStatus);

      // Cleanup temp files
      await rm(tempDir, { recursive: true, force: true });

      // Configure PATH
      await this.ensurePathConfigured(installDir);
      await this.unlinkNpm();

      // Save version
      this.saveVersion(info.version);

      // Complete
      const shell = process.env['SHELL'] || '/bin/bash';
      const rcFile = shell.includes('zsh') ? '~/.zshrc' : '~/.bashrc';
      const restartMsg = isFirstRun
        ? `Setup complete! Run: source ${rcFile} && nexus`
        : `Updated to v${info.version}! Please restart.`;
      this.emitStatus({ type: 'complete', needsRestart: true, message: restartMsg });
      return true;

    } catch (error: unknown) {
      logger.error('Download and install failed', error as Error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatus({ type: 'error', message: `Update failed: ${message}` });
      return false;
    }
  }

  /**
   * Get latest commit hash from remote using git ls-remote
   */
  private async getRemoteCommit(): Promise<string | null> {
    try {
      const result = await execAsync(`git ls-remote ${this.repoUrl} refs/heads/nexus-coder`);
      const match = result.stdout.match(/^([a-f0-9]+)/);
      return match && match[1] ? match[1] : null;
    } catch (error) {
      logger.error('Failed to get remote commit via ls-remote', error);
      return null;
    }
  }

  /**
   * Get saved commit hash from file
   */
  private getSavedCommit(): string | null {
    try {
      if (fs.existsSync(this.commitFile)) {
        return fs.readFileSync(this.commitFile, 'utf-8').trim();
      }
    } catch (error) {
      logger.debug('Failed to read saved commit: ' + (error instanceof Error ? error.message : String(error)));
    }
    return null;
  }

  /**
   * Save commit hash to file
   */
  private saveCommit(commit: string): void {
    try {
      const dir = path.dirname(this.commitFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.commitFile, commit);
      logger.debug('Saved commit hash: ' + commit.slice(0, 7));
    } catch (error) {
      logger.debug('Failed to save commit: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Update binary: clone → extract → cleanup → save commit
   */
  private async updateBinary(remoteCommit: string): Promise<boolean> {
    const totalSteps = 3;
    const isFirstRun = !this.getSavedCommit();

    try {
      // Step 1: Clone repository
      const statusType = isFirstRun ? 'first_run' : 'updating';
      this.emitStatus({ type: statusType, step: 1, totalSteps, message: 'Downloading update...' } as UpdateStatus);

      const parentDir = path.dirname(this.repoDir);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Use depth=1 for faster clone (we only need latest files)
      await execAsync(`git clone --depth 1 -b nexus-coder ${this.repoUrl} ${this.repoDir}`);

      // Step 2: Extract binaries
      this.emitStatus({ type: statusType, step: 2, totalSteps, message: 'Installing update...' } as UpdateStatus);
      const success = await this.copyBinariesInternal();

      if (!success) {
        return false;
      }

      // Step 3: Cleanup and save commit
      this.emitStatus({ type: statusType, step: 3, totalSteps, message: 'Finalizing...' } as UpdateStatus);
      await this.cleanupRepo();
      this.saveCommit(remoteCommit);

      // Complete
      const shell = process.env['SHELL'] || '/bin/bash';
      const rcFile = shell.includes('zsh') ? '~/.zshrc' : '~/.bashrc';
      const restartMsg = isFirstRun
        ? `Setup complete! Run: source ${rcFile} && nexus`
        : 'Update complete! Please restart.';
      this.emitStatus({ type: 'complete', needsRestart: true, message: restartMsg });
      return true;

    } catch (error: unknown) {
      logger.error('Binary update failed', error as Error);
      await this.cleanupRepo(); // Cleanup on failure too
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatus({ type: 'error', message: `Update failed: ${message}` });
      return false;
    }
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
   * Copy pre-built binaries (Node.js mode - legacy)
   * Used when running in Node.js mode for development
   */
  private async copyBinaries(): Promise<boolean> {
    const totalSteps = 3;

    try {
      // Step 1-2: Copy binaries
      this.emitStatus({ type: 'updating', step: 1, totalSteps, message: 'Extracting nexus binary...' });
      const success = await this.copyBinariesInternal();
      if (!success) return false;

      // Step 3: Add to PATH and cleanup npm link
      this.emitStatus({ type: 'updating', step: 3, totalSteps, message: 'Configuring PATH...' });
      const installDir = path.join(os.homedir(), '.local', 'bin');
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
   * Internal: Extract and copy binaries without status updates
   * Used by both binary mode and Node.js mode
   */
  private async copyBinariesInternal(): Promise<boolean> {
    try {
      const repoBinDir = path.join(this.repoDir, 'bin');
      const installDir = path.join(os.homedir(), '.local', 'bin');

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

      // Extract and copy nexus binary using streams for memory efficiency
      // Remove existing binary first to avoid ETXTBSY error
      await rm(nexusDest, { force: true });
      await pipeline(
        createReadStream(nexusGzSrc),
        zlib.createGunzip(),
        createWriteStream(nexusDest)
      );
      await chmod(nexusDest, 0o755);

      // Copy yoga.wasm
      if (fs.existsSync(yogaSrc)) {
        await copyFile(yogaSrc, yogaDest);
      }

      // Configure PATH
      await this.ensurePathConfigured(installDir);
      await this.unlinkNpm();

      logger.debug('Binaries copied successfully');
      return true;

    } catch (error: unknown) {
      logger.error('Copy binaries internal failed', error as Error);
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
      // Check if already configured by marker
      let content = '';
      if (fs.existsSync(rcFile)) {
        content = fs.readFileSync(rcFile, 'utf-8');
      }

      // Only check for our specific marker, not the binDir string
      // (binDir might appear in comments or other contexts)
      if (content.includes(marker)) {
        logger.debug('PATH already configured (marker found)');
        return;
      }

      // Also check if PATH actually contains binDir (runtime check)
      const currentPath = process.env['PATH'] || '';
      if (currentPath.split(':').includes(binDir)) {
        logger.debug('PATH already contains binDir, adding marker for future reference');
        // Add marker comment only so we don't re-check every time
        fs.appendFileSync(rcFile, `\n${marker}\n# PATH already configured elsewhere\n`);
        return;
      }

      // Append PATH configuration
      const addition = `\n${marker}\n${pathExport}\n`;
      fs.appendFileSync(rcFile, addition);
      logger.debug('PATH configuration added to ' + rcFile);

    } catch (error) {
      // Non-fatal - user can add manually
      logger.debug('Failed to configure PATH: ' + (error instanceof Error ? error.message : String(error)));
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
   * Remove repo directory to prevent source code exposure
   * Only removes repo after binaries have been successfully copied
   */
  private async cleanupRepo(): Promise<void> {
    try {
      if (fs.existsSync(this.repoDir)) {
        logger.debug('Cleaning up repo directory to prevent source code exposure');
        await rm(this.repoDir, { recursive: true, force: true });
        logger.debug('Repo directory removed successfully');
      }
    } catch (error) {
      // Non-fatal - log but don't fail the update
      logger.debug('Failed to cleanup repo: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

}

export default GitAutoUpdater;
