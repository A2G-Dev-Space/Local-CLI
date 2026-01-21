/**
 * Inject version from package.json into constants.ts
 *
 * Run before bun:build to ensure binary has correct version
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const constantsPath = path.join(__dirname, '..', 'src', 'constants.ts');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

// Read constants.ts
let constants = fs.readFileSync(constantsPath, 'utf-8');

// Check if APP_VERSION exists
if (constants.includes('APP_VERSION')) {
  // Update existing APP_VERSION
  constants = constants.replace(
    /export const APP_VERSION = ['"].*['"]/,
    `export const APP_VERSION = '${version}'`
  );
} else {
  // Add APP_VERSION at the end
  constants += `\n/**\n * Application version (injected from package.json)\n */\nexport const APP_VERSION = '${version}';\n`;
}

fs.writeFileSync(constantsPath, constants);
console.log(`Version injected: ${version}`);
