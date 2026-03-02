/**
 * Inject version from package.json into constants.ts (CLI + Electron)
 *
 * Run before bun:build to ensure binary has correct version
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '..', 'package.json');

// Both CLI and Electron constants files
const constantsPaths = [
  path.join(__dirname, '..', 'src', 'constants.ts'),
  path.join(__dirname, '..', 'electron', 'main', 'constants.ts'),
];

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

for (const constantsPath of constantsPaths) {
  if (!fs.existsSync(constantsPath)) {
    console.log(`Skipping (not found): ${constantsPath}`);
    continue;
  }

  let constants = fs.readFileSync(constantsPath, 'utf-8');

  if (constants.includes('APP_VERSION')) {
    constants = constants.replace(
      /export const APP_VERSION = ['"].*['"]/,
      `export const APP_VERSION = '${version}'`
    );
  } else {
    constants += `\n/**\n * Application version (injected from package.json)\n */\nexport const APP_VERSION = '${version}';\n`;
  }

  fs.writeFileSync(constantsPath, constants);
  console.log(`Version injected into ${path.relative(path.join(__dirname, '..'), constantsPath)}: ${version}`);
}
