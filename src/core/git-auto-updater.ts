/**
 * Git-based Auto-Update System
 *
 * Updates the CLI by cloning/pulling from GitHub repository
 * No API rate limits, uses pure git commands
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../utils/logger.js';

/**
 * Execute command asynchronously (allows spinner animation)
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

  constructor(options?: { repoUrl?: string; enabled?: boolean }) {
    this.repoDir = path.join(os.homedir(), '.local-cli', 'repo');

    if (options?.repoUrl) {
      this.repoUrl = options.repoUrl;
    }

    if (options?.enabled !== undefined) {
      this.enabled = options.enabled;
    }
  }

  /**
   * Main entry point - runs on every 'open' command
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
      logger.debug('Git auto-update is disabled');
      logger.exit('GitAutoUpdater.run', { skipped: true, reason: 'disabled' });
      return false;
    }

    try {
      logger.flow('Checking repository directory');
      logger.vars({ name: 'repoDir', value: this.repoDir });

      // Check if repo directory exists
      if (!fs.existsSync(this.repoDir)) {
        logger.flow('First run detected - need initial setup');

        // First run: Show immediate feedback
        console.log();
        console.log(chalk.cyan('🔧 First Run Detected'));
        console.log(chalk.white('   Setting up automatic updates...'));
        console.log(chalk.dim('   This will take 1-2 minutes (downloading, building)'));
        console.log();

        // First run: clone and setup
        await this.initialSetup();
      } else {
        // Subsequent runs: pull and update if needed
        const updated = await this.pullAndUpdate();
        if (updated) {
          return true;
        }
      }
    } catch (error) {
      logger.error('Git auto-update failed', error);
      console.log(chalk.yellow('⚠️  Auto-update failed, continuing with current version...'));
    }
    return false;
  }

  /**
   * First run: Clone repository and setup npm link
   */
  private async initialSetup(): Promise<void> {
    logger.enter('initialSetup', {
      repoDir: this.repoDir,
      repoUrl: this.repoUrl
    });

    const spinner = ora({
      text: chalk.cyan('Step 1/4: Cloning repository from GitHub...'),
      spinner: 'dots',
    }).start();

    try {
      logger.flow('초기 설정 시작');
      logger.debug('Initial setup started', { repoDir: this.repoDir, repoUrl: this.repoUrl });

      // Create parent directory
      logger.flow('상위 디렉토리 생성');
      const parentDir = path.dirname(this.repoDir);

      logger.vars(
        { name: 'parentDir', value: parentDir },
        { name: 'exists', value: fs.existsSync(parentDir) }
      );

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
        logger.debug('Created parent directory', { parentDir });
      }

      // Clone repository
      logger.flow('Git 저장소 복제');
      logger.debug('Cloning repository', { repoUrl: this.repoUrl, destination: this.repoDir });

      logger.startTimer('git-clone');
      await execAsync(`git clone ${this.repoUrl} ${this.repoDir}`);
      const cloneTime = logger.endTimer('git-clone');

      logger.debug('Repository cloned successfully');
      logger.vars({ name: 'cloneTime', value: cloneTime });
      spinner.succeed(chalk.green('Step 1/4: Repository cloned successfully'));

      // Install dependencies
      spinner.start(chalk.cyan('Step 2/4: Installing dependencies (npm install)...'));
      spinner.text = chalk.cyan('Step 2/4: Installing dependencies (npm install)... This may take a while');
      logger.debug('Running npm install', { cwd: this.repoDir });

      await execAsync('npm install', { cwd: this.repoDir });

      spinner.succeed(chalk.green('Step 2/4: Dependencies installed'));

      // Build project
      spinner.start(chalk.cyan('Step 3/4: Building TypeScript project...'));
      logger.debug('Running npm run build', { cwd: this.repoDir });

      await execAsync('npm run build', { cwd: this.repoDir });

      spinner.succeed(chalk.green('Step 3/4: Build completed'));

      // Create global link
      spinner.start(chalk.cyan('Step 4/4: Creating global command link...'));
      logger.debug('Running npm link', { cwd: this.repoDir });

      await execAsync('npm link', { cwd: this.repoDir });

      spinner.succeed(chalk.green('Step 4/4: Global link created'));
      logger.debug('Initial setup completed successfully');

      console.log();
      console.log(chalk.green.bold('✨ Setup Complete!'));
      console.log(chalk.white('   LOCAL-CLI is now ready to use'));
      console.log(chalk.dim('   Updates will happen automatically on each run'));
      console.log();
    } catch (error: any) {
      spinner.fail(chalk.red('Setup failed'));
      logger.error('Initial setup failed', error);

      // Log detailed error info
      if (error.stderr) {
        logger.error('Setup error output', { stderr: error.stderr.toString() });
      }

      console.log();
      console.log(chalk.red('❌ Installation failed'));
      console.log(chalk.yellow('   Please check your network connection and try again'));
      console.log(chalk.dim(`   Error: ${error.message}`));
      console.log();

      throw error;
    }
  }

  /**
   * Pull latest changes and rebuild if needed
   * @returns true if updated and needs restart
   */
  private async pullAndUpdate(): Promise<boolean> {
    logger.debug('Checking for updates', { repoDir: this.repoDir });

    try {
      // Check git status first
      const statusResult = await execAsync('git status --porcelain', { cwd: this.repoDir });

      if (statusResult.stdout.trim() !== '') {
        logger.warn('Local changes detected in repo directory', { status: statusResult.stdout });
        console.log(chalk.yellow('⚠️  Local changes detected in ~/.local-cli/repo'));
        console.log(chalk.dim('   Skipping auto-update to preserve changes'));
        return false;
      }

      // Pull latest changes
      logger.debug('Pulling latest changes from main branch');

      const pullResult = await execAsync('git pull origin main', { cwd: this.repoDir });
      const pullOutput = pullResult.stdout;

      logger.debug('Git pull output', { output: pullOutput });

      // Check if there were any changes
      if (pullOutput.includes('Already up to date') || pullOutput.includes('Already up-to-date')) {
        logger.debug('Already up to date, no rebuild needed');
        return false;
      }

      // Changes detected - rebuild
      logger.debug('Changes detected, rebuilding...', { pullOutput });

      console.log();
      console.log(chalk.cyan('📦 Update Available'));
      console.log(chalk.white('   Updating to latest version...'));
      console.log();

      const spinner = ora({
        text: chalk.cyan('Step 1/3: Installing dependencies...'),
        spinner: 'dots',
      }).start();

      try {
        // Install dependencies (in case package.json changed)
        logger.debug('Running npm install after update');

        await execAsync('npm install', { cwd: this.repoDir });

        spinner.succeed(chalk.green('Step 1/3: Dependencies updated'));

        // Rebuild
        spinner.start(chalk.cyan('Step 2/3: Building project...'));
        logger.debug('Running npm run build after update');

        await execAsync('npm run build', { cwd: this.repoDir });

        spinner.succeed(chalk.green('Step 2/3: Build completed'));

        // Re-link (to ensure latest dist is linked)
        spinner.start(chalk.cyan('Step 3/3: Updating global link...'));
        logger.debug('Running npm link after update');

        await execAsync('npm link', { cwd: this.repoDir });

        spinner.succeed(chalk.green('Step 3/3: Global link updated'));
        logger.debug('Auto-update completed successfully');

        console.log();
        console.log(chalk.green.bold('✨ Update Complete!'));
        console.log(chalk.white('   Please run "open" again to use the new version.'));
        console.log();

        // Return true to indicate restart needed
        return true;
      } catch (buildError: any) {
        spinner.fail(chalk.red('Update failed'));
        logger.error('Build/link failed after pull', buildError);

        // Try to rollback
        try {
          logger.debug('Attempting to rollback');
          console.log();
          console.log(chalk.yellow('🔄 Rolling back to previous version...'));

          await execAsync('git reset --hard HEAD@{1}', { cwd: this.repoDir });

          logger.debug('Rollback successful');
          console.log(chalk.green('✓ Rollback successful'));
          console.log(chalk.yellow('⚠️  Update failed, continuing with previous version'));
          console.log();
        } catch (rollbackError) {
          logger.error('Rollback failed', rollbackError);
          console.log();
          console.log(chalk.red('❌ Update and rollback both failed'));
          console.log(chalk.yellow('   Manual intervention may be required'));
          console.log(chalk.dim(`   Repository: ${this.repoDir}`));
          console.log();
        }
      }
    } catch (error: any) {
      logger.error('Pull and update failed', error);

      if (error.stderr) {
        logger.error('Git error output', { stderr: error.stderr.toString() });
      }

      // Don't throw - just log and continue with current version
      console.log(chalk.yellow('⚠️  Could not check for updates, continuing with current version'));
    }
    return false;
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
