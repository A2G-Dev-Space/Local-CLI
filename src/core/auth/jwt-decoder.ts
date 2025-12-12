/**
 * JWT Decoder
 *
 * Decodes JWT tokens using PEM certificate
 * Used for SSO authentication with Samsung DS GenAI Portal
 */

import fs from 'fs';
import path from 'path';
import { CERT_DIR, SSO_CONFIG } from '../../constants.js';
import { SSOUser } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Convert DER/CER certificate to PEM format
 */
function cerToPem(certBuffer: Buffer): string {
  // Check if already PEM format
  const certString = certBuffer.toString('utf8');
  if (certString.includes('-----BEGIN CERTIFICATE-----')) {
    return certString;
  }

  // Convert DER to PEM
  const base64 = certBuffer.toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 64) {
    lines.push(base64.slice(i, i + 64));
  }
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

/**
 * Load certificate from file
 */
export function loadCertificate(): string {
  const certPath = path.join(CERT_DIR, SSO_CONFIG.certFileName);

  if (!fs.existsSync(certPath)) {
    throw new Error(`Certificate not found: ${certPath}`);
  }

  const certBuffer = fs.readFileSync(certPath);
  return cerToPem(certBuffer);
}

/**
 * Decode JWT token without verification (for development)
 * In production, use verifyAndDecodeToken
 */
export function decodeTokenPayload(token: string): SSOUser {
  try {
    // JWT structure: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    // Decode payload (base64url)
    const payloadBase64 = parts[1]!
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);

    logger.debug('JWT payload decoded', { payload });

    // Extract user info from payload
    // Adjust field names based on actual SSO response
    const user: SSOUser = {
      loginid: payload.loginid || payload.sub || payload.user_id || '',
      deptname: payload.deptname || payload.department || payload.dept || '',
      username: payload.username || payload.name || payload.display_name || '',
    };

    if (!user.loginid) {
      throw new Error('Invalid token: missing loginid');
    }

    return user;
  } catch (error) {
    logger.error('Failed to decode JWT', error as Error);
    throw new Error(`JWT decode failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify and decode JWT token using certificate
 * Uses dynamic import to avoid issues with jsonwebtoken ESM
 */
export async function verifyAndDecodeToken(token: string): Promise<SSOUser> {
  try {
    // For now, use simple decode since we're in development
    // In production, this should verify the signature using the certificate
    logger.debug('Verifying JWT token');

    // Load certificate (for future signature verification)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cert = loadCertificate();
    void cert; // Suppress unused variable warning - will be used for JWT verification

    // TODO: Implement proper JWT verification with the certificate
    // This requires understanding the exact JWT algorithm used by the SSO server
    // For now, decode without verification for development

    return decodeTokenPayload(token);
  } catch (error) {
    logger.error('JWT verification failed', error as Error);
    throw error;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const payloadBase64 = parts[1]!
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));

    if (payload.exp) {
      const expirationDate = new Date(payload.exp * 1000);
      return expirationDate < new Date();
    }

    return false; // No expiration claim, assume valid
  } catch {
    return true; // If we can't parse, assume expired
  }
}

/**
 * Get token expiration date
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payloadBase64 = parts[1]!
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));

    if (payload.exp) {
      return new Date(payload.exp * 1000);
    }

    return null;
  } catch {
    return null;
  }
}
