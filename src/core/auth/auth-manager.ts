/**
 * Auth Manager
 *
 * Manages user authentication state
 * - Stores credentials in ~/.nexus-coder/auth.json
 * - Provides auth state and headers for API calls
 * - Handles login/logout flows
 */

import fs from 'fs';
import path from 'path';
import { NEXUS_HOME_DIR, AUTH_FILE_PATH, ADMIN_SERVER_URL, CERT_DIR, SSO_CONFIG } from '../../constants.js';
import { AuthState, AuthFileData, SSOUser } from './types.js';
import { ssoClient } from './sso-client.js';
import { isTokenExpired, getTokenExpiration } from './jwt-decoder.js';
import { logger } from '../../utils/logger.js';

const AUTH_FILE_VERSION = '1.0';

/**
 * Auth Manager singleton
 */
class AuthManager {
  private authState: AuthState | null = null;
  private initialized: boolean = false;

  /**
   * Initialize auth manager - load existing credentials
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.enter('AuthManager.initialize');

    // Ensure directories exist
    this.ensureDirectories();

    // Try to load existing auth
    await this.loadAuthFile();

    this.initialized = true;
    logger.exit('AuthManager.initialize', { authenticated: this.isAuthenticated() });
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(NEXUS_HOME_DIR)) {
      fs.mkdirSync(NEXUS_HOME_DIR, { recursive: true });
    }

    if (!fs.existsSync(CERT_DIR)) {
      fs.mkdirSync(CERT_DIR, { recursive: true });
    }
  }

  /**
   * Load auth file from disk
   */
  private async loadAuthFile(): Promise<void> {
    if (!fs.existsSync(AUTH_FILE_PATH)) {
      logger.debug('Auth file not found');
      return;
    }

    try {
      const content = fs.readFileSync(AUTH_FILE_PATH, 'utf-8');
      const data: AuthFileData = JSON.parse(content);

      // Check version compatibility
      if (data.version !== AUTH_FILE_VERSION) {
        logger.warn('Auth file version mismatch, clearing auth');
        await this.clearAuth();
        return;
      }

      // Check if token is expired
      if (isTokenExpired(data.token)) {
        logger.info('Token expired, clearing auth');
        await this.clearAuth();
        return;
      }

      this.authState = {
        token: data.token,
        user: data.user,
        expiresAt: new Date(data.expiresAt),
        serverUrl: data.serverUrl,
        authenticatedAt: new Date(data.authenticatedAt),
      };

      logger.debug('Auth loaded', { user: this.authState.user.loginid });
    } catch (error) {
      logger.error('Failed to load auth file', error as Error);
      await this.clearAuth();
    }
  }

  /**
   * Save auth state to disk
   */
  private async saveAuthFile(): Promise<void> {
    if (!this.authState) return;

    const data: AuthFileData = {
      version: AUTH_FILE_VERSION,
      token: this.authState.token,
      user: this.authState.user,
      expiresAt: this.authState.expiresAt.toISOString(),
      serverUrl: this.authState.serverUrl,
      authenticatedAt: this.authState.authenticatedAt.toISOString(),
    };

    fs.writeFileSync(AUTH_FILE_PATH, JSON.stringify(data, null, 2));
    logger.debug('Auth file saved');
  }

  /**
   * Clear auth state and file
   */
  private async clearAuth(): Promise<void> {
    this.authState = null;

    if (fs.existsSync(AUTH_FILE_PATH)) {
      fs.unlinkSync(AUTH_FILE_PATH);
    }

    logger.debug('Auth cleared');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.authState) return false;
    if (isTokenExpired(this.authState.token)) return false;
    return true;
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState | null {
    if (!this.isAuthenticated()) return null;
    return this.authState;
  }

  /**
   * Get current user
   */
  getCurrentUser(): SSOUser | null {
    return this.authState?.user || null;
  }

  /**
   * Get auth headers for API calls
   */
  getAuthHeaders(): Record<string, string> {
    if (!this.authState) return {};

    return {
      'Authorization': `Bearer ${this.authState.token}`,
      'X-User-Id': this.authState.user.loginid,
    };
  }

  /**
   * Perform SSO login
   */
  async login(openBrowser: (url: string) => Promise<void>): Promise<AuthState> {
    logger.enter('AuthManager.login');

    // Check certificate exists
    const certPath = path.join(CERT_DIR, SSO_CONFIG.certFileName);
    if (!fs.existsSync(certPath)) {
      throw new Error(
        `SSO certificate not found: ${certPath}\n` +
        `Please place your certificate file at this location.`
      );
    }

    // Start SSO flow
    const { user, token } = await ssoClient.startLoginFlow(openBrowser);

    // Get expiration from token
    const expiresAt = getTokenExpiration(token) || new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create auth state
    this.authState = {
      token,
      user,
      expiresAt,
      serverUrl: ADMIN_SERVER_URL,
      authenticatedAt: new Date(),
    };

    // Save to disk
    await this.saveAuthFile();

    logger.exit('AuthManager.login', { user: user.loginid });
    return this.authState;
  }

  /**
   * Logout - clear all credentials
   */
  async logout(): Promise<void> {
    logger.enter('AuthManager.logout');
    await this.clearAuth();
    logger.exit('AuthManager.logout');
  }

  /**
   * Require authentication - throws if not authenticated
   */
  requireAuth(): AuthState {
    if (!this.isAuthenticated()) {
      throw new AuthenticationRequiredError();
    }
    return this.authState!;
  }
}

/**
 * Error thrown when authentication is required but not present
 */
export class AuthenticationRequiredError extends Error {
  constructor() {
    super('Authentication required. Please run: nexus');
    this.name = 'AuthenticationRequiredError';
  }
}

export const authManager = new AuthManager();
