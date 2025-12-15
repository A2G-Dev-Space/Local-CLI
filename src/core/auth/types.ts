/**
 * Authentication Types
 *
 * Types for SSO authentication and user management
 */

/**
 * SSO User information decoded from JWT token
 */
export interface SSOUser {
  loginid: string;
  deptname: string;
  username: string;
}

/**
 * Authentication state stored locally
 */
export interface AuthState {
  token: string;
  user: SSOUser;
  expiresAt: Date;
  serverUrl: string;
  authenticatedAt: Date;
}

/**
 * Auth file structure (~/.nexus-coder/auth.json)
 */
export interface AuthFileData {
  version: string;
  token: string;
  user: SSOUser;
  expiresAt: string;
  serverUrl: string;
  authenticatedAt: string;
}

/**
 * SSO callback response
 */
export interface SSOCallbackResponse {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Server sync response
 */
export interface ServerSyncResponse {
  success: boolean;
  user?: {
    id: string;
    loginid: string;
    deptname: string;
    username: string;
    firstSeen: string;
    lastActive: string;
  };
  sessionToken?: string;
  error?: string;
}
