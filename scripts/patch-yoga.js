/**
 * Patch yoga-wasm-web for Bun compiled binary compatibility
 *
 * This script modifies yoga-wasm-web to load yoga.wasm from process.execPath directory
 * instead of the module directory, allowing it to work in Bun compiled binaries.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const yogaNodePath = path.join(__dirname, '..', 'node_modules', 'yoga-wasm-web', 'dist', 'node.js');

if (!fs.existsSync(yogaNodePath)) {
  console.log('yoga-wasm-web not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(yogaNodePath, 'utf-8');

// Original line to find
const originalLine = "const mod = await WebAssembly.compile(fs.readFileSync(new URL('./yoga.wasm', import.meta.url)));";

// Patched version that checks for binary mode
const patchedCode = `// Patched for Bun binary compatibility
const wasmPath = (() => {
  const execDir = require('path').dirname(process.execPath);
  const binaryWasm = require('path').join(execDir, 'yoga.wasm');
  if (require('fs').existsSync(binaryWasm)) {
    return binaryWasm;
  }
  return new URL('./yoga.wasm', import.meta.url);
})();
const mod = await WebAssembly.compile(fs.readFileSync(wasmPath));`;

if (content.includes(originalLine)) {
  content = content.replace(originalLine, patchedCode);
  fs.writeFileSync(yogaNodePath, content);
  console.log('yoga-wasm-web patched successfully');
} else if (content.includes('process.execPath')) {
  console.log('yoga-wasm-web already patched');
} else {
  console.log('Could not find target line to patch in yoga-wasm-web');
  console.log('The module structure may have changed');
}
