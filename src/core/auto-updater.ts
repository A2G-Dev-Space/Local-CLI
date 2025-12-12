/**
 * GitHub Release Auto-Update System
 *
 * Handles automatic version checking and updates from GitHub Releases
 */

import axios from 'axios';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import semver from 'semver';
import { ReleaseInfo, UpdateCheckResult, AutoUpdateConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * AutoUpdater Class
 * Manages version checking and automatic updates from GitHub Releases
 */
export class AutoUpdater {
  private owner: string = 'A2G-Dev-Space';
  private repo: string = 'Local-CLI';
  private currentVersion: string;
  private apiBaseUrl: string = 'https://api.github.com';
  private config: AutoUpdateConfig;
  private packageJsonPath: string;

  constructor(config?: Partial<AutoUpdateConfig>) {
    // Get project root and package.json path
    const projectRoot = path.resolve(__dirname, '../../');
    this.packageJsonPath = path.join(projectRoot, 'package.json');

    // Read current version from package.json
    if (fs.existsSync(this.packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf-8'));
      this.currentVersion = packageJson.version;
    } else {
      this.currentVersion = '0.0.0';
      console.warn(chalk.yellow('⚠️ package.json not found, using default version 0.0.0'));
    }

    // Set default config
    this.config = {
      enabled: true,
      checkOnStartup: true,
      autoInstall: false,
      channel: 'stable',
      ...config
    };
  }

  /**
   * Check for updates from GitHub Releases
   */
  async checkForUpdates(silent: boolean = false): Promise<UpdateCheckResult> {
    logger.enter('checkForUpdates', {
      silent,
      currentVersion: this.currentVersion,
      enabled: this.config.enabled
    });

    if (!this.config.enabled) {
      logger.flow('Auto-update disabled - skipping check');
      logger.debug('Auto-update is disabled');
      logger.exit('checkForUpdates', { hasUpdate: false, reason: 'disabled' });
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion
      };
    }

    logger.flow('업데이트 확인 시작');
    const spinner = !silent ? ora('Checking for updates...').start() : null;

    try {
      // GitHub API: Get latest release
      const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/releases/latest`;

      logger.vars(
        { name: 'apiUrl', value: url },
        { name: 'currentVersion', value: this.currentVersion },
        { name: 'owner', value: this.owner },
        { name: 'repo', value: this.repo }
      );

      logger.debug('Checking for updates from GitHub', {
        url,
        currentVersion: this.currentVersion,
        owner: this.owner,
        repo: this.repo,
      });

      logger.flow('GitHub API 호출');
      logger.httpRequest('GET', url);
      logger.startTimer('github-api-call');

      const response = await axios.get(url, {
        timeout: 5000, // 5 second timeout
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'LOCAL-CLI',
        },
      });

      const apiTime = logger.endTimer('github-api-call');

      logger.httpResponse(response.status, response.statusText, {
        latestVersion: response.data.tag_name,
        releaseDate: response.data.published_at,
        assetsCount: response.data.assets?.length || 0,
      });

      const release = response.data;
      const latestVersion = release.tag_name.replace(/^v/, ''); // "v1.0.0" → "1.0.0"

      logger.flow('버전 비교');
      logger.vars(
        { name: 'currentVersion', value: this.currentVersion },
        { name: 'latestVersion', value: latestVersion },
        { name: 'isNewer', value: semver.gt(latestVersion, this.currentVersion) },
        { name: 'apiTime', value: apiTime }
      );

      logger.debug('Version comparison', {
        currentVersion: this.currentVersion,
        latestVersion,
        isNewer: semver.gt(latestVersion, this.currentVersion),
      });

      // Check if this version should be skipped
      if (this.config.skipVersion === latestVersion) {
        logger.flow('버전 스킵 설정됨');
        logger.debug('Update skipped by user configuration', { version: latestVersion });
        spinner?.succeed('Update check complete (version skipped)');

        logger.exit('checkForUpdates', { hasUpdate: false, reason: 'version-skipped', latestVersion });
        return {
          hasUpdate: false,
          currentVersion: this.currentVersion,
          latestVersion
        };
      }

      // Compare versions using semver
      if (semver.gt(latestVersion, this.currentVersion)) {
        logger.flow('새 버전 발견');
        logger.state('버전 상태', this.currentVersion, latestVersion);

        logger.debug('New version available', {
          currentVersion: this.currentVersion,
          latestVersion,
        });
        spinner?.succeed('New version available!');

        const releaseInfo: ReleaseInfo = {
          version: latestVersion,
          releaseDate: release.published_at,
          downloadUrl: release.tarball_url,
          changelog: release.body || 'No changelog available',
          assets: release.assets.map((asset: any) => ({
            name: asset.name,
            url: asset.browser_download_url,
            size: asset.size,
          })),
        };

        logger.vars(
          { name: 'assetsCount', value: releaseInfo.assets.length },
          { name: 'changelogLength', value: releaseInfo.changelog.length }
        );

        logger.exit('checkForUpdates', {
          hasUpdate: true,
          currentVersion: this.currentVersion,
          latestVersion
        });

        return {
          hasUpdate: true,
          currentVersion: this.currentVersion,
          latestVersion,
          releaseInfo
        };
      }

      logger.flow('이미 최신 버전 사용 중');
      logger.debug('Already using the latest version', { version: this.currentVersion });
      spinner?.succeed('You are using the latest version');

      logger.exit('checkForUpdates', {
        hasUpdate: false,
        reason: 'already-latest',
        currentVersion: this.currentVersion
      });

      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        latestVersion,
      };
    } catch (error: any) {
      spinner?.fail('Update check failed');

      // Detailed error logging
      logger.error('Update check failed', error);

      if (axios.isAxiosError(error)) {
        const axiosError = error;
        const status = axiosError.response?.status;
        const statusText = axiosError.response?.statusText;
        const errorCode = axiosError.code;
        const responseData = axiosError.response?.data;

        logger.error('Update check error details', {
          errorCode,
          status,
          statusText,
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          timeout: axiosError.config?.timeout,
          message: axiosError.message,
        });

        if (responseData) {
          logger.debug('GitHub API error response', responseData);
        }

        // User-friendly error messages
        if (!silent) {
          if (errorCode === 'ECONNABORTED' || error.message.includes('timeout')) {
            console.log(chalk.dim(`  Timeout: GitHub API did not respond within 5 seconds`));
          } else if (errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED') {
            console.log(chalk.dim(`  Network error: Cannot reach GitHub API (${errorCode})`));
          } else if (status === 403) {
            console.log(chalk.dim(`  Rate limit: GitHub API rate limit exceeded`));
          } else if (status === 404) {
            console.log(chalk.dim(`  Not found: Release not found (${this.owner}/${this.repo})`));
          } else {
            console.log(chalk.dim(`  ${error.message}`));
          }
        }
      } else {
        // Non-axios error
        logger.error('Non-axios error during update check', {
          message: error.message,
          stack: error.stack,
        });

        if (!silent) {
          console.log(chalk.dim(`  ${error.message}`));
        }
      }

      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        error: error.message,
      };
    }
  }

  /**
   * Show update notification to user
   */
  async showUpdateNotification(releaseInfo: ReleaseInfo): Promise<boolean> {
    console.log();
    console.log(chalk.cyan('┌─────────────────────────────────────────────────────────────────┐'));
    console.log(chalk.cyan('│') + chalk.bold.yellow('  🚀 New Version Available!                                      ') + chalk.cyan('│'));
    console.log(chalk.cyan('├─────────────────────────────────────────────────────────────────┤'));
    console.log(chalk.cyan('│') + `  Current Version: ${chalk.red(this.currentVersion)}                                            ${chalk.cyan('│')}`);
    console.log(chalk.cyan('│') + `  Latest Version:  ${chalk.green(releaseInfo.version)}                                            ${chalk.cyan('│')}`);
    console.log(chalk.cyan('│') + `  Released:        ${new Date(releaseInfo.releaseDate).toLocaleDateString()}                                  ${chalk.cyan('│')}`);
    console.log(chalk.cyan('├─────────────────────────────────────────────────────────────────┤'));
    console.log(chalk.cyan('│') + chalk.bold('  📝 Changelog:                                                  ') + chalk.cyan('│'));

    // Display changelog (truncate if too long)
    const changelogLines = releaseInfo.changelog.split('\n').slice(0, 5);
    changelogLines.forEach(line => {
      const truncated = line.length > 60 ? line.substring(0, 57) + '...' : line;
      const padded = truncated.padEnd(63);
      console.log(chalk.cyan('│') + `  ${padded} ${chalk.cyan('│')}`);
    });

    console.log(chalk.cyan('│                                                                 │'));
    console.log(chalk.cyan('│') + `  ${chalk.dim('⏱️  Estimated time: 2-3 minutes')}                                  ${chalk.cyan('│')}`);
    console.log(chalk.cyan('└─────────────────────────────────────────────────────────────────┘'));
    console.log();

    if (this.config.autoInstall) {
      console.log(chalk.yellow('  Auto-install is enabled. Starting update...'));
      return true;
    }

    // Ask user for confirmation
    const { shouldUpdate, skipVersion } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldUpdate',
        message: 'Would you like to update now?',
        default: true
      },
      {
        type: 'confirm',
        name: 'skipVersion',
        message: 'Skip this version in the future?',
        default: false,
        when: (answers) => !answers.shouldUpdate
      }
    ]);

    if (skipVersion) {
      // Save skip version to config
      this.config.skipVersion = releaseInfo.version;
      this.saveConfig();
    }

    return shouldUpdate;
  }

  /**
   * Perform the update
   */
  async performUpdate(releaseInfo: ReleaseInfo): Promise<{ success: boolean; error?: string }> {
    // Check if we're in a git repository
    const isGitRepo = fs.existsSync(path.join(process.cwd(), '.git'));

    if (isGitRepo) {
      return await this.performGitUpdate();
    } else {
      return await this.performTarballUpdate(releaseInfo);
    }
  }

  /**
   * Git-based update (for development)
   */
  private async performGitUpdate(): Promise<{ success: boolean; error?: string }> {
    const spinner = ora('Updating via Git...').start();

    logger.debug('Starting Git-based update');

    try {
      // Check for uncommitted changes
      logger.debug('Checking for uncommitted changes');
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });

      if (gitStatus.trim() !== '') {
        logger.warn('Git update aborted: Local changes detected', { gitStatus });
        spinner.fail('Update failed: Local changes detected');
        return {
          success: false,
          error: 'Please commit or stash your changes before updating.',
        };
      }

      // Pull latest changes
      spinner.text = 'Pulling latest changes...';
      logger.debug('Executing: git pull origin main');
      const pullOutput = execSync('git pull origin main', { encoding: 'utf-8', stdio: 'pipe' });
      logger.debug('Git pull output', { output: pullOutput });

      // Update dependencies
      spinner.text = 'Installing dependencies...';
      logger.debug('Executing: npm install');
      const installOutput = execSync('npm install', { encoding: 'utf-8', stdio: 'pipe' });
      logger.debug('npm install output', { output: installOutput.substring(0, 200) }); // Truncate long output

      // Build the project
      spinner.text = 'Building project...';
      logger.debug('Executing: npm run build');
      const buildOutput = execSync('npm run build', { encoding: 'utf-8', stdio: 'pipe' });
      logger.debug('npm build output', { output: buildOutput.substring(0, 200) });

      logger.debug('Git-based update completed successfully');
      spinner.succeed('Update completed successfully!');
      return { success: true };
    } catch (error: any) {
      logger.error('Git-based update failed', error);
      logger.error('Git update error details', {
        message: error.message,
        status: error.status,
        signal: error.signal,
        stdout: error.stdout?.toString().substring(0, 500),
        stderr: error.stderr?.toString().substring(0, 500),
      });
      spinner.fail('Update failed');
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Tarball-based update (for production)
   */
  private async performTarballUpdate(releaseInfo: ReleaseInfo): Promise<{ success: boolean; error?: string }> {
    const spinner = ora('Downloading update...').start();
    const tempDir = path.join(os.tmpdir(), `local-cli-update-${Date.now()}`);
    const currentDir = process.cwd();
    const backupDir = path.join(currentDir, '..', `local-cli-backup-${Date.now()}`);

    logger.debug('Starting tarball-based update', {
      version: releaseInfo.version,
      downloadUrl: releaseInfo.downloadUrl,
      tempDir,
      backupDir,
    });

    try {
      // Create temp directory
      logger.debug('Creating temp directory', { tempDir });
      fs.mkdirSync(tempDir, { recursive: true });

      // Download tarball
      spinner.text = 'Downloading release...';
      const tarballPath = path.join(tempDir, 'update.tar.gz');
      logger.debug('Downloading tarball', { url: releaseInfo.downloadUrl, destination: tarballPath });

      const response = await axios.get(releaseInfo.downloadUrl, {
        responseType: 'stream',
        timeout: 60000, // 60 seconds
        headers: {
          'User-Agent': 'LOCAL-CLI'
        }
      });

      logger.debug('Tarball download response', {
        status: response.status,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length'],
      });

      // Save to file
      const writer = fs.createWriteStream(tarballPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => {
          logger.debug('Tarball download completed', { path: tarballPath });
          resolve();
        });
        writer.on('error', (err) => {
          logger.error('Tarball download failed', err);
          reject(err);
        });
      });

      // Extract tarball
      spinner.text = 'Extracting files...';
      logger.debug('Extracting tarball', { tarballPath, tempDir });
      execSync(`tar -xzf "${tarballPath}" -C "${tempDir}"`, { stdio: 'pipe' });

      // Find extracted directory
      const extractedDirs = fs.readdirSync(tempDir).filter(dir =>
        dir !== 'update.tar.gz' && fs.statSync(path.join(tempDir, dir)).isDirectory()
      );

      logger.debug('Extracted directories', { count: extractedDirs.length, dirs: extractedDirs });

      if (extractedDirs.length === 0) {
        throw new Error('No directory found in tarball');
      }

      const sourcePath = path.join(tempDir, extractedDirs[0]!);

      // Create backup
      spinner.text = 'Creating backup...';
      logger.debug('Creating backup', { from: currentDir, to: backupDir });
      fs.cpSync(currentDir, backupDir, {
        recursive: true,
        filter: (src) => !src.includes('node_modules') && !src.includes('.git')
      });

      // Update files (preserve user config)
      spinner.text = 'Updating files...';
      const filesToUpdate = ['src', 'dist', 'package.json', 'package-lock.json', 'tsconfig.json'];
      logger.debug('Updating files', { files: filesToUpdate });

      for (const file of filesToUpdate) {
        const srcPath = path.join(sourcePath, file);
        const destPath = path.join(currentDir, file);

        if (fs.existsSync(srcPath)) {
          logger.debug(`Copying ${file}`, { from: srcPath, to: destPath });
          // Remove old version
          if (fs.existsSync(destPath)) {
            fs.rmSync(destPath, { recursive: true, force: true });
          }
          // Copy new version
          fs.cpSync(srcPath, destPath, { recursive: true });
        } else {
          logger.warn(`File not found in release: ${file}`);
        }
      }

      // Install dependencies
      spinner.text = 'Installing dependencies...';
      logger.debug('Installing dependencies');
      execSync('npm install', { cwd: currentDir, stdio: 'pipe' });

      // Build project
      spinner.text = 'Building project...';
      logger.debug('Building project');
      execSync('npm run build', { cwd: currentDir, stdio: 'pipe' });

      // Cleanup temp files
      logger.debug('Cleaning up temp files', { tempDir });
      fs.rmSync(tempDir, { recursive: true, force: true });

      logger.debug('Tarball-based update completed successfully');
      spinner.succeed('Update completed successfully!');
      console.log(chalk.dim(`  Backup saved at: ${backupDir}`));

      return { success: true };
    } catch (error: any) {
      logger.error('Tarball-based update failed', error);
      logger.error('Tarball update error details', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        tempDir,
        backupDir,
      });
      spinner.fail('Update failed');

      // Attempt rollback
      if (fs.existsSync(backupDir)) {
        try {
          logger.debug('Attempting rollback', { backupDir });
          spinner.start('Rolling back to previous version...');

          // Restore from backup
          const filesToRestore = ['src', 'dist', 'package.json', 'package-lock.json', 'tsconfig.json'];
          for (const file of filesToRestore) {
            const backupPath = path.join(backupDir, file);
            const destPath = path.join(currentDir, file);

            if (fs.existsSync(backupPath)) {
              logger.debug(`Restoring ${file}`, { from: backupPath, to: destPath });
              if (fs.existsSync(destPath)) {
                fs.rmSync(destPath, { recursive: true, force: true });
              }
              fs.cpSync(backupPath, destPath, { recursive: true });
            }
          }

          execSync('npm install', { cwd: currentDir, stdio: 'pipe' });
          logger.debug('Rollback completed successfully');
          spinner.succeed('Rollback completed');
        } catch (rollbackError) {
          logger.error('Rollback failed', rollbackError);
          spinner.fail('Rollback failed');
          console.error(chalk.red('  Manual intervention may be required'));
          console.error(chalk.dim(`  Backup location: ${backupDir}`));
        }
      }

      // Cleanup
      if (fs.existsSync(tempDir)) {
        logger.debug('Cleaning up temp files after failure', { tempDir });
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Save configuration
   */
  private saveConfig(): void {
    // Save to config file
    const configPath = path.join(os.homedir(), '.local-cli', 'config.json');

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config.settings = config.settings || {};
      config.settings.autoUpdate = this.config;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
  }

  /**
   * Run the complete update flow
   */
  async run(options: { noUpdate?: boolean; silent?: boolean } = {}): Promise<void> {
    if (options.noUpdate || !this.config.checkOnStartup) {
      return;
    }

    const checkResult = await this.checkForUpdates(options.silent || false);

    if (checkResult.hasUpdate && checkResult.releaseInfo) {
      const shouldUpdate = await this.showUpdateNotification(checkResult.releaseInfo);

      if (shouldUpdate) {
        const updateResult = await this.performUpdate(checkResult.releaseInfo);

        if (updateResult.success) {
          console.log();
          console.log(chalk.green('✨ Update completed successfully!'));
          console.log(chalk.cyan('Please restart the CLI to use the new version.'));
          process.exit(0);
        } else {
          console.error(chalk.red(`\n❌ Update failed: ${updateResult.error}`));
          console.log(chalk.yellow('You can continue using the current version.'));
        }
      }
    }
  }
}

// Export for use in CLI
export default AutoUpdater;