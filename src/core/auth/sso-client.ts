/**
 * SSO Client
 *
 * Handles SSO authentication flow with Samsung DS GenAI Portal
 *
 * Flow:
 * 1. Start local callback server on random port
 * 2. Open browser to SSO URL with redirect_url
 * 3. Receive encrypted JWT token on callback
 * 4. Decode JWT using PEM certificate
 * 5. Return user information
 */

import http from 'http';
import { URL } from 'url';
import { SSO_CONFIG } from '../../constants.js';
import { SSOUser, SSOCallbackResponse } from './types.js';
import { verifyAndDecodeToken, decodeTokenPayload } from './jwt-decoder.js';
import { logger } from '../../utils/logger.js';

/**
 * Get a random available port
 */
async function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Failed to get random port'));
      }
    });
    server.on('error', reject);
  });
}

/**
 * SSO Client for handling authentication
 */
export class SSOClient {
  private ssoBaseUrl: string;
  private ssoPath: string;

  constructor() {
    this.ssoBaseUrl = SSO_CONFIG.baseUrl;
    this.ssoPath = SSO_CONFIG.ssoPath;
  }

  /**
   * Build the SSO URL with redirect callback
   */
  buildSSOUrl(callbackUrl: string): string {
    const ssoUrl = new URL(this.ssoPath, this.ssoBaseUrl);
    ssoUrl.searchParams.set('redirect_url', callbackUrl);
    return ssoUrl.toString();
  }

  /**
   * Start local callback server and wait for token
   */
  async startCallbackServer(): Promise<{
    port: number;
    callbackUrl: string;
    waitForToken: () => Promise<SSOCallbackResponse>;
    close: () => void;
  }> {
    const port = await getRandomPort();
    const callbackUrl = `http://localhost:${port}/callback`;

    let resolveToken: (response: SSOCallbackResponse) => void;
    let timeoutId: NodeJS.Timeout;

    const tokenPromise = new Promise<SSOCallbackResponse>((resolve) => {
      resolveToken = resolve;

      // Timeout after 5 minutes
      timeoutId = setTimeout(() => {
        resolve({ success: false, error: 'Login timeout (5 minutes)' });
      }, 5 * 60 * 1000);
    });

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token');

        // Send response to browser
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Nexus Coder - Login</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color: #fff;
              }
              .container {
                text-align: center;
                padding: 40px;
                background: rgba(255,255,255,0.1);
                border-radius: 16px;
                backdrop-filter: blur(10px);
              }
              .success { color: #4ade80; }
              .error { color: #f87171; }
              h1 { font-size: 2em; margin-bottom: 16px; }
              p { font-size: 1.1em; opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              ${token
                ? `<h1 class="success">✓ Login Successful</h1>
                   <p>You can close this window and return to the terminal.</p>`
                : `<h1 class="error">✗ Login Failed</h1>
                   <p>No token received. Please try again.</p>`
              }
            </div>
          </body>
          </html>
        `);

        clearTimeout(timeoutId);

        if (token) {
          resolveToken({ success: true, token });
        } else {
          resolveToken({ success: false, error: 'No token received' });
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    return new Promise((resolve, reject) => {
      server.listen(port, () => {
        logger.debug('Callback server started', { port, callbackUrl });

        resolve({
          port,
          callbackUrl,
          waitForToken: () => tokenPromise,
          close: () => {
            clearTimeout(timeoutId);
            server.close();
          },
        });
      });

      server.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Start the SSO login flow
   * Returns the user information after successful login
   */
  async startLoginFlow(openBrowser: (url: string) => Promise<void>): Promise<{
    user: SSOUser;
    token: string;
  }> {
    logger.enter('SSOClient.startLoginFlow');

    // Start callback server
    const { callbackUrl, waitForToken, close } = await this.startCallbackServer();

    // Build SSO URL
    const ssoUrl = this.buildSSOUrl(callbackUrl);
    logger.debug('Opening SSO URL', { ssoUrl });

    try {
      // Open browser
      await openBrowser(ssoUrl);

      // Wait for token
      logger.debug('Waiting for SSO callback...');
      const response = await waitForToken();

      if (!response.success || !response.token) {
        throw new Error(response.error || 'Login failed');
      }

      // Decode token
      logger.debug('Decoding JWT token');
      const user = await verifyAndDecodeToken(response.token);

      logger.exit('SSOClient.startLoginFlow', { user });
      return { user, token: response.token };
    } finally {
      close();
    }
  }

  /**
   * Validate an existing token
   */
  async validateToken(token: string): Promise<SSOUser | null> {
    try {
      return decodeTokenPayload(token);
    } catch {
      return null;
    }
  }
}

export const ssoClient = new SSOClient();
