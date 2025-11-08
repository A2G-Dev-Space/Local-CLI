# OPEN-CLI TODO_ALL - Complete Implementation Roadmap

**Complete consolidated list of ALL unimplemented features and tasks**

Last Updated: 2025-11-05
Version: 1.0.0
Total Sections: 12 Priority Groups
Estimated Total Time: 8-12 weeks

---

## 📚 Document Structure

This document consolidates ALL unimplemented features from:
1. TODO.md (Sections 1-12, all unchecked items)
2. NEW_FEATURES.md (Sections 2.7-2.11, 5 new features)
3. PROGRESS.md (Phase 2.5 unimplemented sections)
4. BLUEPRINT.md (Phase 2.5 UI designs)

**Organization**:
- Priority 0 (P0): Critical - Must implement first (2-3 weeks)
- Priority 1 (P1): Important - Core features (3-4 weeks)
- Priority 2 (P2): Medium - Enhancement features (2-3 weeks)
- Priority 3 (P3): Low - Nice-to-have features (1-2 weeks)

---

## 🎯 Priority Overview

```
P0: Critical Features (2-3 weeks)
├─ GitHub Release Auto-Update System
└─ Plan-and-Execute Architecture

P1: Important Features (3-4 weeks)
├─ Model Compatibility Layer (gpt-oss-120b/20b) ✅
├─ Docs Search Agent Tool ✅
├─ ESC LLM Interrupt
├─ YOLO Mode vs Ask Mode
├─ File Edit Tool Improvements
├─ Config Init Improvements
├─ TODO Auto-Save
├─ Tool Usage UI
├─ Status Bar & Status Command ✅
└─ ASCII Logo & Welcome Screen

P2: Medium Priority (2-3 weeks)
├─ Tips/Help Section
└─ Input Hints & Autocomplete ✅ (@ file + slash command)

P3: Low Priority (1-2 weeks)
└─ Message Type Styling
```

---

# PRIORITY 0: CRITICAL FEATURES

---

## P0-1: GitHub Release Auto-Update System

**Goal**: Automatic version checking and update system via GitHub Releases

**Priority**: P0 (Critical)
**Estimated Time**: 3-5 days
**Dependencies**: None
**Status**: Not Started

### Overview

Automatically check for new versions on GitHub when `open` command is executed, and provide seamless update mechanism with rollback support.

### Architecture

```
CLI Startup (open command)
    ↓
[Update Check Phase]
    ├─ Call GitHub API (/repos/{owner}/{repo}/releases/latest)
    ├─ Compare with current version (package.json)
    ├─ New version found? → YES
    │   ↓
    │   Show notification to user
    │   ↓
    │   [Download Update]
    │   ├─ Download release tarball
    │   ├─ Extract to temp folder
    │   ├─ Create backup (current version)
    │   ↓
    │   [Install Update]
    │   ├─ Replace files
    │   ├─ Run npm install
    │   ├─ Run npm build
    │   ├─ Preserve config files
    │   ↓
    │   [Verification]
    │   ├─ Check installation success
    │   ├─ Verify version
    │   └─ Rollback if failed
    │   ↓
    │   Update complete message
    │
    └─ NO → Normal CLI startup
    ↓
[Normal CLI Execution]
```

### Phase 1: Version Checking (1 day)

**Files to Create/Modify**:
- `src/core/auto-updater.ts` (NEW)
- `src/types/index.ts` (MODIFY - add types)

**Type Definitions**:

```typescript
// src/types/index.ts

/**
 * GitHub Release information
 */
export interface ReleaseInfo {
  version: string;
  releaseDate: string;
  downloadUrl: string;
  changelog: string;
  assets: {
    name: string;
    url: string;
    size: number;
  }[];
}

/**
 * Update check result
 */
export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseInfo?: ReleaseInfo;
  error?: string;
}

/**
 * Auto-update configuration
 */
export interface AutoUpdateConfig {
  enabled: boolean; // Enable auto-update
  checkOnStartup: boolean; // Check on startup
  autoInstall: boolean; // Auto-install without asking
  channel: 'stable' | 'beta' | 'nightly'; // Update channel
}
```

**AutoUpdater Class**:

```typescript
// src/core/auto-updater.ts

import axios from 'axios';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ReleaseInfo, UpdateCheckResult } from '../types/index.js';

/**
 * Auto Updater
 * Handles version checking and update installation
 */
export class AutoUpdater {
  private owner: string = 'A2G-Dev-Space';
  private repo: string = 'Open-Code-CLI';
  private currentVersion: string;
  private apiBaseUrl: string = 'https://api.github.com';

  constructor() {
    // Read current version from package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    this.currentVersion = packageJson.version;
  }

  /**
   * Check for updates from GitHub Releases
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      // GitHub API: Get latest release
      const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/releases/latest`;

      const response = await axios.get(url, {
        timeout: 5000, // 5 second timeout (for offline environments)
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'OPEN-CLI',
        },
      });

      const release = response.data;
      const latestVersion = release.tag_name.replace(/^v/, ''); // "v1.0.0" → "1.0.0"

      // Compare versions
      if (this.isNewerVersion(latestVersion, this.currentVersion)) {
        return {
          hasUpdate: true,
          currentVersion: this.currentVersion,
          latestVersion,
          releaseInfo: {
            version: latestVersion,
            releaseDate: release.published_at,
            downloadUrl: release.tarball_url,
            changelog: release.body || '',
            assets: release.assets.map((asset: any) => ({
              name: asset.name,
              url: asset.browser_download_url,
              size: asset.size,
            })),
          },
        };
      }

      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        latestVersion,
      };
    } catch (error: any) {
      // Offline or API call failed → silently continue
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        error: error.message,
      };
    }
  }

  /**
   * Compare versions (semantic versioning)
   */
  private isNewerVersion(latest: string, current: string): boolean {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }

    return false; // Same version
  }
}
```

**Testing Scenarios**:
- [ ] GitHub API normal call
- [ ] Version comparison (1.0.0 vs 1.0.1, 1.0.0 vs 0.9.0)
- [ ] Timeout test (offline environment)
- [ ] Error handling (invalid response)

### Phase 2: Update Mechanism (2 days)

**Strategy A: Git Pull Method** (Recommended):

```typescript
/**
 * Git pull-based update
 */
async performGitUpdate(): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Check Git status
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });

    if (gitStatus.trim() !== '') {
      return {
        success: false,
        error: 'Local changes detected. Please commit or stash before updating.',
      };
    }

    // 2. Git Pull
    execSync('git pull origin main', { stdio: 'pipe' });

    // 3. npm install (update dependencies)
    execSync('npm install', { stdio: 'pipe' });

    // 4. Build
    execSync('npm run build', { stdio: 'pipe' });

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
```

**Strategy B: Tarball Download Method** (Offline pre-download):

```typescript
/**
 * Download and install from tarball
 */
async performTarballUpdate(releaseInfo: ReleaseInfo): Promise<{ success: boolean; error?: string }> {
  const tempDir = path.join(os.tmpdir(), 'open-cli-update');
  const currentDir = process.cwd();
  const backupDir = path.join(currentDir, '..', `open-cli-backup-${Date.now()}`);

  try {
    // 1. Create temp folder
    fs.mkdirSync(tempDir, { recursive: true });

    // 2. Download tarball
    const tarballPath = path.join(tempDir, 'update.tar.gz');
    const response = await axios.get(releaseInfo.downloadUrl, {
      responseType: 'stream',
      timeout: 30000, // 30 seconds
    });

    const writer = fs.createWriteStream(tarballPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // 3. Extract
    execSync(`tar -xzf ${tarballPath} -C ${tempDir}`, { stdio: 'pipe' });

    // 4. Create backup
    fs.cpSync(currentDir, backupDir, { recursive: true });

    // 5. Replace files (src/, dist/, package.json, etc.)
    const extractedDir = fs.readdirSync(tempDir).find(dir => dir.startsWith('A2G-Dev-Space'));
    const sourcePath = path.join(tempDir, extractedDir!);

    // Only update critical files (preserve config)
    const filesToUpdate = ['src', 'dist', 'package.json', 'package-lock.json', 'tsconfig.json'];

    for (const file of filesToUpdate) {
      const srcPath = path.join(sourcePath, file);
      const destPath = path.join(currentDir, file);

      if (fs.existsSync(srcPath)) {
        fs.rmSync(destPath, { recursive: true, force: true });
        fs.cpSync(srcPath, destPath, { recursive: true });
      }
    }

    // 6. npm install & build
    execSync('npm install', { cwd: currentDir, stdio: 'pipe' });
    execSync('npm run build', { cwd: currentDir, stdio: 'pipe' });

    // 7. Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });

    return { success: true };
  } catch (error: any) {
    // Rollback
    if (fs.existsSync(backupDir)) {
      fs.rmSync(currentDir, { recursive: true, force: true });
      fs.cpSync(backupDir, currentDir, { recursive: true });
    }

    return {
      success: false,
      error: error.message,
    };
  } finally {
    // Cleanup backup (optional)
    // fs.rmSync(backupDir, { recursive: true, force: true });
  }
}
```

**Backup & Rollback**:

```typescript
// src/core/backup-manager.ts

export class BackupManager {
  /**
   * Create backup of current installation
   */
  static createBackup(): string {
    const currentDir = process.cwd();
    const backupDir = path.join(currentDir, '..', `open-cli-backup-${Date.now()}`);

    fs.cpSync(currentDir, backupDir, { recursive: true });
    return backupDir;
  }

  /**
   * Rollback from backup
   */
  static async rollback(backupDir: string): Promise<void> {
    const currentDir = process.cwd();

    try {
      // Delete current directory
      fs.rmSync(currentDir, { recursive: true, force: true });

      // Restore from backup
      fs.cpSync(backupDir, currentDir, { recursive: true });

      console.log('✅ Rollback complete');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      console.log('Manual recovery needed:', backupDir);
    }
  }
}
```

**Testing Scenarios**:
- [ ] Normal update flow (git pull)
- [ ] Tarball download and extraction
- [ ] Backup creation and verification
- [ ] Build failure → automatic rollback
- [ ] Network error handling

### Phase 3: UI Integration (1 day)

**Update UI Components**:

```typescript
// src/ui/components/UpdateNotification.tsx

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface UpdateNotificationProps {
  currentVersion: string;
  latestVersion: string;
  changelog: string;
  onAccept: () => void;
  onSkip: () => void;
}

/**
 * Update notification component
 */
export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  currentVersion,
  latestVersion,
  changelog,
  onAccept,
  onSkip,
}) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
      <Text color="yellow" bold>
        🚀 New version available!
      </Text>
      <Box marginTop={1}>
        <Text>Current version: </Text>
        <Text color="gray">{currentVersion}</Text>
      </Box>
      <Box>
        <Text>Latest version: </Text>
        <Text color="green" bold>
          {latestVersion}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>📝 Changes:</Text>
        <Text color="gray">{changelog.substring(0, 200)}...</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Update now? (Y/n): </Text>
      </Box>
    </Box>
  );
};

interface UpdateProgressProps {
  stage: 'downloading' | 'installing' | 'building' | 'completed';
  progress: number;
  message?: string;
}

/**
 * Update progress component
 */
export const UpdateProgress: React.FC<UpdateProgressProps> = ({
  stage,
  progress,
  message,
}) => {
  const stageIcons = {
    downloading: '📥',
    installing: '📦',
    building: '🔨',
    completed: '✅',
  };

  const stageMessages = {
    downloading: 'Downloading update...',
    installing: 'Installing packages...',
    building: 'Building...',
    completed: 'Update complete!',
  };

  const progressBar = '█'.repeat(Math.floor(progress / 3.33)) + '░'.repeat(30 - Math.floor(progress / 3.33));

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Box>
        {stage !== 'completed' && (
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
        )}
        <Text> {stageIcons[stage]} {stageMessages[stage]}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>{progressBar} {progress}%</Text>
      </Box>
      {message && (
        <Box marginTop={1}>
          <Text color="gray">{message}</Text>
        </Box>
      )}
    </Box>
  );
};
```

**UI States**:

1. **Update notification**:
```
┌─────────────────────────────────────────────┐
│ 🚀 New version available!                   │
│ Current version: 0.2.0                      │
│ Latest version: 0.3.0                       │
│                                             │
│ Update now? (Y/n):                          │
└─────────────────────────────────────────────┘
```

2. **Downloading**:
```
┌─────────────────────────────────────────────┐
│ ⣾ 📥 Downloading update...                  │
│ ████████████████████░░░░░░░░░░  60%        │
└─────────────────────────────────────────────┘
```

3. **Installing**:
```
┌─────────────────────────────────────────────┐
│ ⣽ 📦 Installing packages...                 │
│ ████████████████░░░░░░░░░░░░░░  45%        │
└─────────────────────────────────────────────┘
```

4. **Building**:
```
┌─────────────────────────────────────────────┐
│ ⣻ 🔨 Building...                            │
│ ████████████████████████████░░  85%        │
└─────────────────────────────────────────────┘
```

5. **Complete**:
```
┌─────────────────────────────────────────────┐
│ ✅ Update complete!                         │
│ Version 0.3.0 installed successfully.       │
│ OPEN-CLI will restart automatically...     │
└─────────────────────────────────────────────┘
```

**CLI Startup Integration**:

```typescript
// src/cli.ts

import { AutoUpdater } from './core/auto-updater.js';
import inquirer from 'inquirer';

/**
 * Check and update before CLI starts
 */
async function checkAndUpdate(): Promise<void> {
  // Skip if --no-update flag
  if (process.argv.includes('--no-update')) {
    return;
  }

  const updater = new AutoUpdater();
  const result = await updater.checkForUpdates();

  if (!result.hasUpdate) {
    return; // No update → continue normally
  }

  // Show update notification
  console.log('\n🚀 New version available!');
  console.log(`Current version: ${result.currentVersion}`);
  console.log(`Latest version: ${result.latestVersion}`);
  console.log('\nUpdate now? (Y/n)');

  // Wait for user input
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question('', async (answer: string) => {
      readline.close();

      if (answer.toLowerCase() === 'n') {
        console.log('Skipping update.\n');
        resolve();
        return;
      }

      // Perform update
      console.log('\n📥 Downloading update...');

      const updateResult = await updater.performGitUpdate();

      if (updateResult.success) {
        console.log('✅ Update complete! Restarting CLI...\n');
        process.exit(0); // CLI restart needed
      } else {
        console.error('❌ Update failed:', updateResult.error);
        console.log('Starting normal CLI...\n');
        resolve();
      }
    });
  });
}

// Execute before program starts
(async () => {
  await checkAndUpdate();

  // Start normal CLI
  program.parse();
})();
```

**Testing Scenarios**:
- [ ] Normal update flow (user accepts)
- [ ] Update rejection (user declines)
- [ ] Update skip (--no-update flag)
- [ ] Offline environment (timeout)
- [ ] Build failure → rollback

### Phase 4: Configuration & Testing (1 day)

**Configuration**:

```typescript
// src/core/config-manager.ts

export interface Config {
  // ... existing fields ...
  autoUpdate: AutoUpdateConfig;
}

export class ConfigManager {
  // ... existing methods ...

  /**
   * Get auto-update configuration
   */
  getAutoUpdateConfig(): AutoUpdateConfig {
    const config = this.loadConfig();
    return config.autoUpdate || {
      enabled: true,
      checkOnStartup: true,
      autoInstall: false,
      channel: 'stable',
    };
  }

  /**
   * Set auto-update configuration
   */
  setAutoUpdateConfig(autoUpdateConfig: Partial<AutoUpdateConfig>): void {
    const config = this.loadConfig();
    config.autoUpdate = {
      ...config.autoUpdate,
      ...autoUpdateConfig,
    };
    this.saveConfig(config);
  }
}
```

**Config JSON Example**:

```json
{
  "autoUpdate": {
    "enabled": true,
    "checkOnStartup": true,
    "autoInstall": false,
    "channel": "stable"
  }
}
```

**Comprehensive Testing**:

1. **Normal Update Flow**:
   - Current: v0.2.0
   - Latest: v0.3.0
   - User accepts
   - Download → Install → Build → Success

2. **Offline Environment**:
   - GitHub API timeout (5s)
   - Silent failure
   - Continue to normal CLI

3. **Update Rejection**:
   - User inputs 'n'
   - Skip update
   - Continue to normal CLI

4. **Update Skip Flag**:
   - `open --no-update`
   - No update check
   - Immediate CLI start

5. **Build Failure & Rollback**:
   - Download → Install → Build fails
   - Automatic rollback
   - Restore previous version
   - Continue to normal CLI

**Documentation**:
- [ ] Add auto-update feature to README.md
- [ ] Define CHANGELOG.md writing rules
- [ ] Create troubleshooting guide

### Completion Criteria

- [ ] `open` command automatically checks GitHub Release
- [ ] New version notification shown to user
- [ ] Update proceeds with user confirmation
- [ ] Automatic rollback on failure
- [ ] Silent continuation in offline environment
- [ ] `--no-update` flag works correctly
- [ ] Configuration options functional
- [ ] All tests passing

---

## P0-2: Plan-and-Execute Architecture

**Goal**: Break down user requests into TODO lists and execute them sequentially

**Priority**: P0 (Critical)
**Estimated Time**: 5-7 days
**Dependencies**: None
**Status**: Not Started

### Overview

Transform OPEN-CLI from "direct response" mode to "plan-and-execute" mode:
1. User request → Planning LLM generates TODO list
2. Each TODO: Docs Search (pre-execution) → Main LLM (ReAct with tools)
3. UI shows TODO list (fixed bottom panel)
4. Session saves TODO state for recovery

### Architecture

```
User Request
    ↓
Planning LLM → TODO List generation (UI display)
    ↓
For each TODO item:
    ├─ Docs Search Agent (pre-execution)
    ├─ Main LLM ReAct (iteration)
    ├─ ✓ Mark complete
    └─ Move to next TODO
    ↓
All TODOs complete
    ↓
Save to Session (recoverable)
```

**Key Changes**:
1. ✅ **Planning Phase**: User request analyzed and broken into TODO list
2. ✅ **Docs Search First**: Each TODO executes docs search agent before main work
3. ✅ **Fixed TODO UI**: Messages scroll, TODO list stays at bottom
4. ✅ **ReAct Chunks**: Each TODO is one ReAct unit
5. ✅ **Session Save**: TODO state and progress saved

### Phase 1: Planning LLM (2 days)

**Files to Create**:
- `src/core/planning-llm.ts` (NEW)
- `src/types/index.ts` (MODIFY - add types)

**Type Definitions**:

```typescript
// src/types/index.ts

/**
 * TODO Item type
 */
export interface TodoItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  requiresDocsSearch: boolean;
  dependencies: string[]; // Other TODO ids
  result?: string;
  error?: string;
  startedAt?: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
}

/**
 * Planning result
 */
export interface PlanningResult {
  todos: TodoItem[];
  estimatedTime?: string;
  complexity: 'simple' | 'moderate' | 'complex';
}

/**
 * TODO status type
 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
```

**PlanningLLM Implementation**:

```typescript
// src/core/planning-llm.ts

import { LLMClient } from './llm-client.js';
import { Message, TodoItem, PlanningResult } from '../types/index.js';

/**
 * Planning LLM
 * Converts user requests into executable TODO lists
 */
export class PlanningLLM {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Convert user request to TODO list
   */
  async generateTODOList(userRequest: string): Promise<PlanningResult> {
    const systemPrompt = `
You are a task planning expert. Analyze user requests and break them into executable TODO items.

**Your Mission**:
Break down user requests into detailed tasks (TODO items).

**TODO Item Creation Rules**:
1. **Specific**: Each TODO must be clear and executable
2. **Sequential**: TODOs listed in execution order
3. **Independent**: Each TODO should be as independent as possible
4. **Docs Search**: Set requiresDocsSearch: true if information is needed
5. **Dependencies**: Specify dependencies if TODO needs results from others

**TODO Examples**:
User: "Create a REST API with TypeScript"
→ TODOs:
  1. Research TypeScript project setup (requiresDocsSearch: true)
  2. Install Express.js and initial setup
  3. Create basic route structure
  4. Implement API endpoints
  5. Write test code

**Important**:
- Don't over-subdivide (max 5-7 TODOs)
- Each TODO should be completable in 10-30 minutes
- Break complex tasks into multiple TODOs

**Response Format** (JSON):
{
  "todos": [
    {
      "id": "todo-1",
      "title": "TODO title",
      "description": "Detailed description",
      "requiresDocsSearch": true/false,
      "dependencies": []
    }
  ],
  "estimatedTime": "30-60 minutes",
  "complexity": "moderate"
}
`;

    const messages: Message[] = [
      {
        role: 'user',
        content: `Break down this request into a TODO list:\n\n${userRequest}`,
      },
    ];

    try {
      const response = await this.llmClient.chatCompletion({
        messages,
      });

      const content = response.choices[0].message.content || '';

      // Parse JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Planning LLM did not return JSON');
      }

      const planningData = JSON.parse(jsonMatch[0]);

      // Create TodoItem (add status)
      const todos: TodoItem[] = planningData.todos.map((todo: any, index: number) => ({
        id: todo.id || `todo-${Date.now()}-${index}`,
        title: todo.title,
        description: todo.description,
        status: 'pending' as TodoStatus,
        requiresDocsSearch: todo.requiresDocsSearch || false,
        dependencies: todo.dependencies || [],
      }));

      return {
        todos,
        estimatedTime: planningData.estimatedTime,
        complexity: planningData.complexity || 'moderate',
      };
    } catch (error) {
      console.error('Planning LLM error:', error);

      // Fallback: Create single TODO
      return {
        todos: [
          {
            id: `todo-${Date.now()}`,
            title: 'Execute task',
            description: userRequest,
            status: 'pending',
            requiresDocsSearch: true,
            dependencies: [],
          },
        ],
        complexity: 'simple',
      };
    }
  }
}
```

**Testing Scenarios**:
- [ ] Simple request → 2-3 TODOs generated
- [ ] Complex request → 5-7 TODOs generated
- [ ] Dependency handling verified
- [ ] JSON parsing error handling

### Phase 2: TODO Executor (2 days)

**Files to Create**:
- `src/core/todo-executor.ts` (NEW)

**TodoExecutor Implementation**:

```typescript
// src/core/todo-executor.ts

import { LLMClient } from './llm-client.js';
import { TodoItem } from './planning-llm.js';
import { executeDocsSearchAgent } from './docs-search-agent.js';
import { FILE_TOOLS } from '../tools/file-tools.js';
import { Message } from '../types/index.js';

/**
 * TODO Executor
 * Executes TODO items sequentially
 */
export class TodoExecutor {
  private llmClient: LLMClient;
  private onTodoUpdate?: (todo: TodoItem) => void;

  constructor(
    llmClient: LLMClient,
    onTodoUpdate?: (todo: TodoItem) => void
  ) {
    this.llmClient = llmClient;
    this.onTodoUpdate = onTodoUpdate;
  }

  /**
   * Execute single TODO
   */
  async executeTodo(
    todo: TodoItem,
    messages: Message[],
    completedTodos: TodoItem[]
  ): Promise<{ messages: Message[]; todo: TodoItem }> {
    try {
      // Update status: in_progress
      todo.status = 'in_progress';
      todo.startedAt = new Date().toISOString();
      this.onTodoUpdate?.(todo);

      // 1. Docs Search pre-execution (if requiresDocsSearch)
      let docsContext = '';
      if (todo.requiresDocsSearch) {
        const searchResult = await executeDocsSearchAgent(
          this.llmClient,
          todo.description
        );

        if (searchResult.success && searchResult.result) {
          docsContext = searchResult.result;
          messages.push({
            role: 'assistant',
            content: `[Docs Search Complete]\n${docsContext}`,
          });
        }
      }

      // 2. Create context (include previous TODO results)
      let contextPrompt = `Current task: ${todo.title}\n${todo.description}\n\n`;

      if (docsContext) {
        contextPrompt += `Related documentation:\n${docsContext}\n\n`;
      }

      if (completedTodos.length > 0) {
        contextPrompt += `Previous task results:\n`;
        completedTodos.forEach((completed) => {
          contextPrompt += `- ${completed.title}: ${completed.result}\n`;
        });
        contextPrompt += '\n';
      }

      contextPrompt += 'Now execute this task.';

      messages.push({
        role: 'user',
        content: contextPrompt,
      });

      // 3. Execute Main LLM (with Tools)
      const result = await this.llmClient.chatCompletionWithTools(
        messages,
        FILE_TOOLS,
        5 // maxIterations
      );

      // 4. Save result
      const finalMessage = result.allMessages[result.allMessages.length - 1];
      const todoResult = finalMessage.content || 'Task complete';

      todo.status = 'completed';
      todo.result = todoResult;
      todo.completedAt = new Date().toISOString();
      this.onTodoUpdate?.(todo);

      return {
        messages: result.allMessages,
        todo,
      };
    } catch (error) {
      // Error handling
      todo.status = 'failed';
      todo.error = error instanceof Error ? error.message : 'Unknown error';
      todo.completedAt = new Date().toISOString();
      this.onTodoUpdate?.(todo);

      throw error;
    }
  }

  /**
   * Execute all TODOs sequentially
   */
  async executeAll(
    todos: TodoItem[],
    initialMessages: Message[]
  ): Promise<{ messages: Message[]; todos: TodoItem[] }> {
    let messages = [...initialMessages];
    const completedTodos: TodoItem[] = [];

    for (const todo of todos) {
      // Check dependencies
      if (todo.dependencies.length > 0) {
        const allDepsCompleted = todo.dependencies.every((depId) =>
          completedTodos.some((t) => t.id === depId && t.status === 'completed')
        );

        if (!allDepsCompleted) {
          todo.status = 'failed';
          todo.error = 'Dependency TODOs not completed';
          continue;
        }
      }

      // Execute TODO
      const result = await this.executeTodo(todo, messages, completedTodos);
      messages = result.messages;
      completedTodos.push(result.todo);

      // Decide whether to stop on failure (currently continue)
      if (todo.status === 'failed') {
        console.warn(`TODO "${todo.title}" failed:`, todo.error);
      }
    }

    return {
      messages,
      todos,
    };
  }
}
```

**Testing Scenarios**:
- [ ] TODO execution → completion flow
- [ ] Dependency verification
- [ ] Error handling (TODO failure)
- [ ] Progress callback verification

### Phase 3: Docs Search Agent Tool (1 day) ✅ COMPLETED

**Status**: ✅ Completed (2025-11-06)
**Enhanced in Phase 2.8**: Framework detection, batch loading, enhanced security
**Details**: See [HISTORY_ALL.md#L2936-L3200](HISTORY_ALL.md#L2936-L3200)

**Files Created**:
- `src/core/bash-command-tool.ts` (CREATED ✅)
- `src/core/docs-search-agent.ts` (CREATED ✅)
- `src/core/agent-framework-handler.ts` (CREATED ✅ - Phase 2.8 enhancement)

**Bash Command Tool**:

```typescript
// src/core/bash-command-tool.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Execute bash command
 * Security: Restricted to ~/.open-cli/docs directory
 */
export async function executeBashCommand(
  command: string,
  cwd?: string
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    // Security validation: Block dangerous commands
    const dangerousCommands = ['rm -rf', 'dd', 'mkfs', '>', '>>', 'sudo'];
    if (dangerousCommands.some(cmd => command.includes(cmd))) {
      return {
        success: false,
        error: 'Command blocked for security reasons.',
      };
    }

    // Default working directory: ~/.open-cli/docs
    const docsPath = cwd || path.join(os.homedir(), '.open-cli', 'docs');

    // Execute command (5 second timeout)
    const { stdout, stderr } = await execAsync(command, {
      cwd: docsPath,
      timeout: 5000,
      maxBuffer: 1024 * 1024, // 1MB
    });

    return {
      success: true,
      result: stdout || stderr,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Docs Search Agent**:

```typescript
// src/core/docs-search-agent.ts

import { LLMClient } from './llm-client.js';
import { Message } from '../types/index.js';
import { executeBashCommand } from './bash-command-tool.js';

/**
 * Execute Docs Search Agent
 * Uses sub-LLM with bash tools to search ~/.open-cli/docs
 */
export async function executeDocsSearchAgent(
  llmClient: LLMClient,
  query: string
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    // System prompt: Documentation search expert
    const systemPrompt = `
You are a documentation search expert for ~/.open-cli/docs.

**Your Mission**:
Find information requested by user in ~/.open-cli/docs folder.

**Available Tools**:
- run_bash: Execute bash commands
  - find: Search files/folders (e.g., find . -name "*.md")
  - grep: Search file contents (e.g., grep -r "typescript" .)
  - cat: Read files (e.g., cat README.md)
  - ls: Directory listing (e.g., ls -la)
  - tree: Directory structure (e.g., tree -L 2)

**Search Strategy**:
1. First, understand folder structure (ls, tree)
2. Find related files by filename (find)
3. Search for keywords in file contents (grep)
4. Read related files to extract information (cat)
5. Collect and synthesize information from multiple files

**Important**:
- Maximum 10 tool calls to find information
- Summarize findings clearly and concisely
- Provide information with file paths
- If not found, respond "Information not found"

**Current working directory**: ~/.open-cli/docs
`;

    // Initial messages
    const messages: Message[] = [
      {
        role: 'user',
        content: `Find this information in ~/.open-cli/docs:\n\n${query}`,
      },
    ];

    // Multi-iteration loop (max 10)
    const maxIterations = 10;
    let iteration = 0;
    let finalResult = '';

    const RUN_BASH_TOOL = {
      type: 'function' as const,
      function: {
        name: 'run_bash',
        description: 'Execute bash command. Safely runs only in ~/.open-cli/docs directory.',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Bash command to execute (e.g., find, grep, cat, ls)',
            },
          },
          required: ['command'],
        },
      },
    };

    while (iteration < maxIterations) {
      iteration++;

      // Call LLM (provide RUN_BASH_TOOL)
      const response = await llmClient.chatCompletion({
        messages,
        tools: [RUN_BASH_TOOL],
        tool_choice: 'auto',
      });

      const assistantMessage = response.choices[0].message;
      messages.push(assistantMessage);

      // Execute tool calls if present
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.function.name === 'run_bash') {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await executeBashCommand(args.command);

            // Add tool result to messages
            messages.push({
              role: 'tool',
              content: result.success
                ? result.result || 'Command executed successfully (no output)'
                : `Error: ${result.error}`,
              tool_call_id: toolCall.id,
            });
          }
        }
      } else {
        // No tool call → final response
        finalResult = assistantMessage.content || '';
        break;
      }
    }

    // No result → error
    if (!finalResult) {
      return {
        success: false,
        error: `Maximum iterations (${maxIterations}) exceeded.`,
      };
    }

    return {
      success: true,
      result: finalResult,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**FILE_TOOLS Integration**:

```typescript
// src/tools/file-tools.ts (MODIFY)

import { executeDocsSearchAgent } from '../core/docs-search-agent.js';

export const SEARCH_DOCS_AGENT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'search_docs_agent',
    description: `
      Intelligently search for documentation in ~/.open-cli/docs.
      This tool uses an AI Agent internally to perform complex searches.
      Finds information based on folder structure, file names, and file contents.
    `,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Description of information to search for (e.g., "TypeScript coding standards", "API authentication methods")',
        },
      },
      required: ['query'],
    },
  },
};

export const FILE_TOOLS = [
  READ_FILE_TOOL,
  WRITE_FILE_TOOL,
  LIST_FILES_TOOL,
  FIND_FILES_TOOL,
  SEARCH_DOCS_AGENT_TOOL, // 🆕 Add
];

export async function executeFileTool(
  toolName: string,
  args: any,
  llmClient?: LLMClient // 🆕 Pass LLMClient for Agent Tool
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'read_file':
      return executeReadFile(args.file_path);
    case 'write_file':
      return executeWriteFile(args.file_path, args.content);
    case 'list_files':
      return executeListFiles(args.directory_path, args.recursive);
    case 'find_files':
      return executeFindFiles(args.pattern, args.directory_path);
    case 'search_docs_agent': // 🆕 Add
      if (!llmClient) {
        return { success: false, error: 'LLMClient required' };
      }
      return executeDocsSearchAgent(llmClient, args.query);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
```

**Testing Scenarios**:
- [x] Docs search with multiple iterations ✅
- [x] Bash command execution (find, grep, cat) ✅
- [x] Security validation (dangerous commands blocked) ✅
- [x] Timeout handling (10 seconds - enhanced) ✅
- [x] Multi-iteration (max 10) verification ✅
- [x] Framework detection (ADK/AGNO) ✅ (Phase 2.8)
- [x] Batch loading with command substitution ✅ (Phase 2.8)
- [x] Category-aware path routing ✅ (Phase 2.8)

**Phase 2.8 Enhancements** (2025-11-06):
- ✅ Framework keyword detection (ADK, AGNO)
- ✅ 7 AGNO categories (agent, models, rag, workflows, teams, memory, database)
- ✅ Automatic documentation path resolution
- ✅ Batch loading for agent creation queries
- ✅ Enhanced bash security with safe command substitution
- ✅ Increased timeouts (5s → 10s) and buffers (1MB → 2MB)
- ✅ Complete document preservation (no chunking/context loss)

### Phase 4: TODO List UI (1 day)

**Files to Create**:
- `src/ui/components/TodoListPanel.tsx` (NEW)

**TodoListPanel Component**:

```typescript
// src/ui/components/TodoListPanel.tsx

import React from 'react';
import { Box, Text } from 'ink';
import { TodoItem } from '../../core/planning-llm.js';

interface TodoListPanelProps {
  todos: TodoItem[];
  currentTime?: string;
}

export const TodoListPanel: React.FC<TodoListPanelProps> = ({ todos, currentTime }) => {
  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const totalCount = todos.length;

  const getStatusIcon = (status: TodoItem['status']): string => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '→';
      case 'failed':
        return '✗';
      default:
        return '☐';
    }
  };

  const getStatusColor = (status: TodoItem['status']): string => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'in_progress':
        return 'yellow';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Box justifyContent="space-between" width="100%">
          <Text bold color="cyan">
            📋 TODO List ({completedCount}/{totalCount} completed)
          </Text>
          {currentTime && (
            <Text dimColor>[{currentTime}]</Text>
          )}
        </Box>
      </Box>

      {/* TODO Items */}
      <Box flexDirection="column" paddingX={1}>
        {todos.map((todo, index) => (
          <Box key={todo.id} marginY={0}>
            <Text color={getStatusColor(todo.status)}>
              {getStatusIcon(todo.status)} {index + 1}. {todo.title}
              {todo.status === 'in_progress' && ' (in progress)'}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
```

**UI States**:

1. **Initial state**:
```
┌──────────────────────────────────────────────────────────────┐
│ 📋 TODO List (0/5 completed)                     [12:34:56]  │
├──────────────────────────────────────────────────────────────┤
│ ☐ 1. TypeScript project setup research                      │
│ ☐ 2. Express.js installation and initial setup              │
│ ☐ 3. Create basic route structure                           │
│ ☐ 4. Implement API endpoints                                │
│ ☐ 5. Write test code                                        │
└──────────────────────────────────────────────────────────────┘
```

2. **In progress**:
```
┌──────────────────────────────────────────────────────────────┐
│ 📋 TODO List (2/5 completed)                     [12:36:23]  │
├──────────────────────────────────────────────────────────────┤
│ ✓ 1. TypeScript project setup research                      │
│ ✓ 2. Express.js installation and initial setup              │
│ → 3. Create basic route structure (in progress)             │
│ ☐ 4. Implement API endpoints                                │
│ ☐ 5. Write test code                                        │
└──────────────────────────────────────────────────────────────┘
```

3. **Completed**:
```
┌──────────────────────────────────────────────────────────────┐
│ 📋 TODO List (5/5 completed) ✅                  [12:45:18]  │
├──────────────────────────────────────────────────────────────┤
│ ✓ 1. TypeScript project setup research                      │
│ ✓ 2. Express.js installation and initial setup              │
│ ✓ 3. Create basic route structure                           │
│ ✓ 4. Implement API endpoints                                │
│ ✓ 5. Write test code                                        │
└──────────────────────────────────────────────────────────────┘
```

**InteractiveApp Integration**:

```typescript
// src/ui/InteractiveApp.tsx (MODIFY)

import React, { useState } from 'react';
import { Box } from 'ink';
import { LLMClient } from '../core/llm-client.js';
import { PlanningLLM, TodoItem } from '../core/planning-llm.js';
import { TodoExecutor } from '../core/todo-executor.js';
import { Message } from '../types/index.js';
import { TodoListPanel } from './components/TodoListPanel.js';

export const InteractiveApp: React.FC<InteractiveAppProps> = ({ llmClient, modelInfo }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize Planning LLM & Executor
  const planningLLM = new PlanningLLM(llmClient);
  const todoExecutor = new TodoExecutor(llmClient, (updatedTodo) => {
    // Update UI when TODO status changes
    setTodos((prev) =>
      prev.map((t) => (t.id === updatedTodo.id ? updatedTodo : t))
    );
  });

  const handleSubmit = async (value: string) => {
    if (!value.trim() || isProcessing) return;

    const userMessage = value.trim();
    setInput('');
    setIsProcessing(true);

    // Add user message
    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ];
    setMessages(newMessages);

    try {
      // 1. Planning Phase: Generate TODO List
      const planningResult = await planningLLM.generateTODOList(userMessage);
      setTodos(planningResult.todos);

      // Add planning result message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Planned ${planningResult.todos.length} tasks.`,
        },
      ]);

      // 2. Execution Phase: Execute TODOs sequentially
      const result = await todoExecutor.executeAll(planningResult.todos, newMessages);

      // Update final messages
      setMessages(result.messages);
      setTodos(result.todos);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Header modelInfo={modelInfo} />

      {/* Messages (scrollable) */}
      <Box flexDirection="column" flexGrow={1}>
        <MessageList messages={messages} />
      </Box>

      {/* TODO List Panel (fixed at bottom) */}
      {todos.length > 0 && (
        <TodoListPanel todos={todos} currentTime={new Date().toLocaleTimeString()} />
      )}

      {/* Input Box */}
      <InputBox
        input={input}
        isProcessing={isProcessing}
        onInputChange={setInput}
        onSubmit={handleSubmit}
      />
    </Box>
  );
};
```

**Testing Scenarios**:
- [ ] TODO list display
- [ ] Status icon changes (☐ → → ✓)
- [ ] Progress indicator
- [ ] Fixed bottom layout (messages scroll, TODO stays)

### Phase 5: Session Integration (1 day)

**SessionData Type Extension**:

```typescript
// src/types/index.ts (MODIFY)

import { TodoItem } from './planning-llm.js';

export interface SessionData {
  sessionId: string;
  messages: Message[];
  todos?: TodoItem[]; // 🆕
  timestamp: string;
  metadata: {
    model: string;
    mode: ExecutionMode;
    completedTodos?: number; // 🆕
    totalTodos?: number; // 🆕
    lastTodoCompleted?: string; // 🆕 TODO title
  };
}
```

**SessionManager Modifications**:

```typescript
// src/core/session-manager.ts (MODIFY)

export class SessionManager {
  /**
   * Save session (with TODO state)
   */
  async saveSession(sessionId: string, data: SessionData): Promise<void> {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    try {
      // Merge with existing data (incremental save)
      let existingData: SessionData | null = null;
      if (fs.existsSync(sessionPath)) {
        existingData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      }

      const mergedData: SessionData = {
        ...existingData,
        ...data,
        timestamp: new Date().toISOString(), // Always latest timestamp
      };

      fs.writeFileSync(sessionPath, JSON.stringify(mergedData, null, 2), 'utf-8');

      console.log(`[SessionManager] Session saved: ${sessionId}`);
    } catch (error: any) {
      console.error(`[SessionManager] Failed to save session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Recover session (with TODO state)
   */
  async recoverSession(sessionId: string): Promise<{
    messages: Message[];
    todos: TodoItem[];
    nextTodoIndex: number;
  } | null> {
    const session = await this.loadSession(sessionId);

    if (!session || !session.todos) {
      return null;
    }

    // Find next TODO to execute (pending or failed)
    const nextTodoIndex = session.todos.findIndex(
      (t) => t.status === 'pending' || t.status === 'failed'
    );

    return {
      messages: session.messages,
      todos: session.todos,
      nextTodoIndex: nextTodoIndex === -1 ? session.todos.length : nextTodoIndex,
    };
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<
    Array<{ sessionId: string; timestamp: string; metadata?: any }>
  > {
    try {
      const files = fs.readdirSync(this.sessionsDir);
      const sessions = files
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
          const sessionPath = path.join(this.sessionsDir, file);
          const data: SessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
          return {
            sessionId: data.sessionId,
            timestamp: data.timestamp,
            metadata: data.metadata,
          };
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return sessions;
    } catch (error: any) {
      console.error(`[SessionManager] Failed to list sessions: ${error.message}`);
      return [];
    }
  }
}
```

**CLI Startup Session Recovery**:

```typescript
// src/cli.ts (MODIFY)

async function main() {
  // ...

  // Detect previous session
  const sessions = await sessionManager.listSessions();
  const latestSession = sessions[0];

  if (latestSession && latestSession.metadata?.todos) {
    const completed = latestSession.metadata.completedTodos || 0;
    const total = latestSession.metadata.totalTodos || 0;

    if (completed < total) {
      // Incomplete TODOs found
      console.log('\n┌────────────────────────────────────────────┐');
      console.log(`│ 💾 Session found: ${latestSession.sessionId.slice(0, 20)}...  │`);
      console.log('│                                            │');
      console.log(`│ Progress: ${completed}/${total} TODO completed              │`);
      console.log(`│ Last TODO: "${latestSession.metadata.lastTodoCompleted?.slice(0, 30)}..." │`);
      console.log('│                                            │');
      console.log('└────────────────────────────────────────────┘');

      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'resume',
          message: 'Resume this session?',
          default: true,
        },
      ]);

      if (answer.resume) {
        // Recover session
        const recovered = await sessionManager.recoverSession(latestSession.sessionId);

        if (recovered) {
          console.log('\n✅ Session recovered! Resuming from TODO #' + (recovered.nextTodoIndex + 1) + '\n');

          // Pass recovered data to InteractiveMode
          await startInteractiveMode({
            messages: recovered.messages,
            todos: recovered.todos,
            resumeFromIndex: recovered.nextTodoIndex,
          });

          return;
        }
      } else {
        console.log('\nStarting fresh session...\n');
      }
    }
  }

  // Normal start
  await startInteractiveMode();
}
```

**Testing Scenarios**:
- [ ] TODO completion → save
- [ ] Interruption → restart → recovery prompt
- [ ] Multiple TODOs → save after each completion
- [ ] Session file verification

### Completion Criteria

- [ ] User request automatically broken into TODO list
- [ ] UI displays TODO list (fixed bottom)
- [ ] Each TODO executes Docs Search before main work
- [ ] TODO status saved to Session
- [ ] Session recovery works correctly
- [ ] All tests passing

---

# PRIORITY 1: IMPORTANT FEATURES

---

## P1-1: Model Compatibility Layer (gpt-oss-120b/20b)

**Goal**: Resolve Harmony format 422 error and handle model-specific quirks

**Priority**: P1 (Important)
**Estimated Time**: 1-2 hours (Simple If-Branch) or 3-5 days (Adapter Pattern)
**Dependencies**: None
**Status**: Not Started

### Overview

gpt-oss-120b and gpt-oss-20b use Harmony format requiring `content` field in assistant messages even when `tool_calls` are present. This causes 422 errors with standard OpenAI-compatible format.

### Error Situation

```
Error: API error (400): litellm.BadRequestError: OpenAIException - Error code: 422
{'detail': [{'type': 'missing', 'loc': ['body', 'messages', 1, 'content'],
'msg': 'Field required', 'input': {'role': 'assistant', 'tool_calls': [...],
'reasoning_content': "..."}}]}
```

### Recommended: Phase 1 (Simple If-Branch) - Quick Fix

**Files to Modify**:
- `src/core/llm-client.ts`

**Implementation**:

```typescript
// src/core/llm-client.ts (MODIFY)

/**
 * Preprocess messages for model-specific requirements
 */
private preprocessMessages(messages: Message[], modelId: string): Message[] {
  // gpt-oss-120b / gpt-oss-20b: Harmony format handling
  if (/^gpt-oss-(120b|20b)$/i.test(modelId)) {
    return messages.map((msg) => {
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        if (!msg.content || msg.content.trim() === '') {
          return {
            ...msg,
            content: msg.reasoning_content || `Calling tools: ${msg.tool_calls.map(tc => tc.function.name).join(', ')}`,
          };
        }
      }
      return msg;
    });
  }

  // Default: return as-is
  return messages;
}

async chatCompletion(options: Partial<LLMRequestOptions>): Promise<LLMResponse> {
  const messages = options.messages ? this.preprocessMessages(options.messages, this.model) : [];

  const requestBody = {
    model: options.model || this.model,
    messages,
    // ...
  };

  // Rest of logic
}
```

**Pros**: Fast implementation, simple code
**Cons**: If statements become complex as more models are added

### Optional: Phase 2 (Adapter Pattern) - Refactoring

**Files to Create**:
- `src/core/adapters/base-adapter.ts`
- `src/core/adapters/openai-adapter.ts`
- `src/core/adapters/harmony-adapter.ts`
- `src/core/adapters/adapter-factory.ts`

**Architecture**:

```
LLMClient (main client)
    ↓
ModelAdapterFactory (factory)
    ↓
    ├─ OpenAIAdapter (default)
    ├─ HarmonyAdapter (gpt-oss-120b/20b)
    ├─ GeminiAdapter (if needed)
    └─ CustomAdapter (extensible)
```

**Base Adapter**:

```typescript
// src/core/adapters/base-adapter.ts

import { Message, LLMRequestOptions } from '../../types/index.js';

/**
 * Model Adapter interface
 */
export interface IModelAdapter {
  name: string;
  modelPattern: RegExp | string[];

  /**
   * Preprocess request: Convert messages to model-required format
   */
  preprocessRequest(options: Partial<LLMRequestOptions>): Partial<LLMRequestOptions>;

  /**
   * Postprocess response: Convert model response to standard format
   */
  postprocessResponse(response: any): any;

  /**
   * Validate messages: Check if messages meet model requirements
   */
  validateMessages(messages: Message[]): { valid: boolean; errors?: string[] };
}

/**
 * Base Adapter abstract class
 */
export abstract class BaseModelAdapter implements IModelAdapter {
  abstract name: string;
  abstract modelPattern: RegExp | string[];

  preprocessRequest(options: Partial<LLMRequestOptions>): Partial<LLMRequestOptions> {
    return options;
  }

  postprocessResponse(response: any): any {
    return response;
  }

  validateMessages(messages: Message[]): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  /**
   * Check if this adapter supports given model
   */
  supportsModel(modelId: string): boolean {
    if (this.modelPattern instanceof RegExp) {
      return this.modelPattern.test(modelId);
    } else {
      return this.modelPattern.includes(modelId);
    }
  }
}
```

**Harmony Adapter**:

```typescript
// src/core/adapters/harmony-adapter.ts

import { BaseModelAdapter } from './base-adapter.js';
import { Message, LLMRequestOptions } from '../../types/index.js';

/**
 * Harmony Format Adapter (gpt-oss-120b, gpt-oss-20b)
 *
 * Harmony format requirements:
 * 1. Assistant messages must have content field
 * 2. content cannot be empty even with tool_calls
 * 3. reasoning_content is optional but recommended
 */
export class HarmonyAdapter extends BaseModelAdapter {
  name = 'HarmonyAdapter';
  modelPattern = /^gpt-oss-(120b|20b)$/i;

  /**
   * Preprocess request: Add content to assistant messages
   */
  preprocessRequest(options: Partial<LLMRequestOptions>): Partial<LLMRequestOptions> {
    if (!options.messages) {
      return options;
    }

    // Copy messages (avoid mutating original)
    const processedMessages = options.messages.map((msg) => {
      // Assistant message with tool_calls
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        // Add content if missing or empty
        if (!msg.content || msg.content.trim() === '') {
          return {
            ...msg,
            content: this.generateDefaultContent(msg),
          };
        }
      }

      return msg;
    });

    return {
      ...options,
      messages: processedMessages,
    };
  }

  /**
   * Generate default content (when tool_calls present)
   */
  private generateDefaultContent(message: Message): string {
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return '';
    }

    // Use reasoning_content if available
    if (message.reasoning_content) {
      return message.reasoning_content;
    }

    // Otherwise generate simple text describing tool intent
    const toolNames = message.tool_calls.map((tc) => tc.function.name).join(', ');
    return `Calling tools: ${toolNames}`;
  }

  /**
   * Validate messages: Check assistant message content requirement
   */
  validateMessages(messages: Message[]): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    messages.forEach((msg, index) => {
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        if (!msg.content || msg.content.trim() === '') {
          errors.push(
            `Message ${index}: Harmony models require 'content' field in assistant messages with tool_calls`
          );
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
```

**OpenAI Adapter** (Default):

```typescript
// src/core/adapters/openai-adapter.ts

import { BaseModelAdapter } from './base-adapter.js';

/**
 * OpenAI Compatible Adapter (default)
 *
 * Most models follow this format:
 * - GPT-4, GPT-3.5
 * - Anthropic Claude (OpenAI Compatible API)
 * - Mistral, Mixtral
 * - Llama, etc.
 */
export class OpenAIAdapter extends BaseModelAdapter {
  name = 'OpenAIAdapter';
  modelPattern = /.*/; // All models (default)

  // Use default implementation (no preprocessing/postprocessing)
}
```

**Adapter Factory**:

```typescript
// src/core/adapters/adapter-factory.ts

import { IModelAdapter, BaseModelAdapter } from './base-adapter.js';
import { OpenAIAdapter } from './openai-adapter.js';
import { HarmonyAdapter } from './harmony-adapter.js';

/**
 * Model Adapter Factory
 *
 * Returns appropriate adapter for given model ID
 */
export class ModelAdapterFactory {
  private static adapters: BaseModelAdapter[] = [
    new HarmonyAdapter(), // Check special models first
    new OpenAIAdapter(),  // Default (last)
  ];

  /**
   * Get adapter for model ID
   */
  static getAdapter(modelId: string): IModelAdapter {
    for (const adapter of this.adapters) {
      if (adapter.supportsModel(modelId)) {
        console.log(`[ModelAdapterFactory] Using ${adapter.name} for model: ${modelId}`);
        return adapter;
      }
    }

    // Default: OpenAIAdapter
    return this.adapters[this.adapters.length - 1];
  }

  /**
   * Register new adapter (extensible)
   */
  static registerAdapter(adapter: BaseModelAdapter): void {
    // Insert before default OpenAIAdapter (priority)
    this.adapters.splice(this.adapters.length - 1, 0, adapter);
  }
}
```

**LLMClient Integration**:

```typescript
// src/core/llm-client.ts (MODIFY)

import { ModelAdapterFactory } from './adapters/adapter-factory.js';
import { IModelAdapter } from './adapters/base-adapter.js';

export class LLMClient {
  private axiosInstance: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private adapter: IModelAdapter; // ← Add

  constructor() {
    // ... existing code ...

    // Select adapter
    this.adapter = ModelAdapterFactory.getAdapter(this.model);

    // ... rest of constructor ...
  }

  /**
   * Chat Completion API call (with Adapter)
   */
  async chatCompletion(options: Partial<LLMRequestOptions>): Promise<LLMResponse> {
    try {
      // 1. Validate messages
      if (options.messages) {
        const validation = this.adapter.validateMessages(options.messages);
        if (!validation.valid) {
          console.warn('[LLMClient] Message validation warnings:', validation.errors);
        }
      }

      // 2. Preprocess request (Adapter)
      const preprocessedOptions = this.adapter.preprocessRequest(options);

      const requestBody = {
        model: preprocessedOptions.model || this.model,
        messages: preprocessedOptions.messages || [],
        temperature: preprocessedOptions.temperature ?? 0.7,
        max_tokens: preprocessedOptions.max_tokens,
        stream: false,
        ...(preprocessedOptions.tools && { tools: preprocessedOptions.tools }),
      };

      const response = await this.axiosInstance.post<LLMResponse>('/chat/completions', requestBody);

      // 3. Postprocess response (Adapter)
      const processedResponse = this.adapter.postprocessResponse(response.data);

      return processedResponse;
    } catch (error) {
      // Error handling...
    }
  }

  // Apply same to chatCompletionStream, chatCompletionWithTools, etc.
}
```

### Testing Scenarios

- [ ] gpt-oss-120b: Tool call without content → Adapter adds content
- [ ] General model: Tool call without content → Passes through
- [ ] Validation error detection
- [ ] Multiple tool calls handling

### Completion Criteria

- [ ] gpt-oss-120b/20b no longer causes 422 error
- [ ] General OpenAI-compatible models work normally
- [ ] (If Adapter Pattern) Easy to add new model quirks
- [ ] All tests passing

---

## P1-2: ESC Key LLM Interrupt

**Goal**: Press ESC key to immediately stop LLM response generation

**Priority**: P1 (Important)
**Estimated Time**: 1 day
**Dependencies**: None
**Status**: Not Started
**Source**: NEW_FEATURES.md Section 2.7

### Overview

Allow users to interrupt LLM response generation by pressing ESC key during streaming. Preserves partial response and provides clean termination.

### Architecture

```
User presses ESC
    ↓
Ink useInput hook captures ESC key
    ↓
Set abortController.abort() flag
    ↓
LLM streaming loop checks abort flag
    ↓
Stop fetching, save partial response
    ↓
Display "⚠️ Generation interrupted by user"
    ↓
Return to input prompt
```

### Implementation

**Dependencies**:
```bash
npm install node-abort-controller
```

**Files to Modify**:
- `src/core/llm-client.ts`
- `src/ui/InteractiveApp.tsx`

**LLMClient Modification**:

```typescript
// src/core/llm-client.ts (MODIFY)

import { AbortController } from 'node-abort-controller';
import axios, { AxiosInstance } from 'axios';

export class LLMClient {
  private axiosInstance: AxiosInstance;
  private currentAbortController: AbortController | null = null;

  /**
   * Interrupt current request
   */
  interrupt(): void {
    if (this.currentAbortController) {
      console.log('[LLMClient] Interrupting current request...');
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  /**
   * Chat Completion Stream (with Abort support)
   */
  async chatCompletionStream(
    options: Partial<LLMRequestOptions>,
    onChunk: (chunk: string) => void,
    onComplete: () => void
  ): Promise<void> {
    // Create AbortController
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    try {
      const requestBody = {
        model: options.model || this.model,
        messages: options.messages || [],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
        stream: true,
        ...(options.tools && { tools: options.tools }),
      };

      const response = await this.axiosInstance.post(
        '/chat/completions',
        requestBody,
        {
          responseType: 'stream',
          signal, // ← Pass abort signal
        }
      );

      const stream = response.data;

      // Abort event listener
      signal.addEventListener('abort', () => {
        console.log('[LLMClient] Abort signal received, destroying stream');
        stream.destroy();
      });

      // Read stream
      for await (const chunk of stream) {
        // Check abort
        if (signal.aborted) {
          console.log('[LLMClient] Stream aborted');
          break;
        }

        const lines = chunk.toString().split('\n').filter(Boolean);

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;

              if (content) {
                onChunk(content);
              }
            } catch (error) {
              console.error('[LLMClient] Stream parsing error:', error);
            }
          }
        }
      }

      // Normal completion
      onComplete();
    } catch (error: any) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        // Normal abort → not an error
        console.log('[LLMClient] Stream aborted by user');
        onComplete();
      } else {
        // Actual error
        throw error;
      }
    } finally {
      this.currentAbortController = null;
    }
  }
}
```

**InteractiveApp Modification**:

```typescript
// src/ui/InteractiveApp.tsx (MODIFY)

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { LLMClient } from '../core/llm-client.js';
import { Message } from '../types/index.js';

export const InteractiveApp: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [wasInterrupted, setWasInterrupted] = useState(false);
  const llmClient = new LLMClient();

  // ESC key handler
  useInput((input, key) => {
    if (key.escape && isGenerating) {
      // ESC pressed → Interrupt LLM
      console.log('[UI] ESC pressed, interrupting LLM...');
      llmClient.interrupt();
      setIsGenerating(false);
      setWasInterrupted(true);

      // Hide interrupt message after 2 seconds
      setTimeout(() => setWasInterrupted(false), 2000);
    }
  });

  // LLM response generation
  const handleSubmit = async (userInput: string) => {
    setIsGenerating(true);
    setWasInterrupted(false);

    const userMessage: Message = { role: 'user', content: userInput };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    let assistantMessage = '';
    const assistantMessageObj: Message = { role: 'assistant', content: '' };

    try {
      await llmClient.chatCompletionStream(
        { messages: updatedMessages },
        (chunk) => {
          // Real-time update
          assistantMessage += chunk;
          assistantMessageObj.content = assistantMessage;
          setMessages([...updatedMessages, assistantMessageObj]);
        },
        () => {
          // Complete
          setIsGenerating(false);
        }
      );
    } catch (error) {
      setIsGenerating(false);
      console.error('[UI] Error during generation:', error);
    }
  };

  return (
    <Box flexDirection="column">
      {/* Messages */}
      <MessageList messages={messages} />

      {/* Interrupt Indicator */}
      {wasInterrupted && (
        <Box borderStyle="round" borderColor="yellow" paddingX={1} marginY={1}>
          <Text color="yellow">⚠️ Generation interrupted by user (ESC)</Text>
        </Box>
      )}

      {/* Input */}
      <InputBox
        onSubmit={handleSubmit}
        disabled={isGenerating}
        placeholder={
          isGenerating
            ? 'Generating... (Press ESC to stop)'
            : 'Type your message...'
        }
      />
    </Box>
  );
};
```

### UI States

**State 1: Normal generation**:
```
You: Hello

🤖 Assistant: Hello! How can I help you tod█

Type your message... (Press ESC to stop)
```

**State 2: ESC pressed (interrupted)**:
```
You: Hello

🤖 Assistant: Hello! How can I help you tod

┌──────────────────────────────────────────┐
│ ⚠️ Generation interrupted by user (ESC)  │
└──────────────────────────────────────────┘

Type your message...
```

**State 3: Partial response preserved**:
```
You: Explain quantum computing in detail

🤖 Assistant: Quantum computing is a revolutionary technology that
leverages the principles of quantum mechanics to process inform
[interrupted]

You: _
```

### Testing Scenarios

- [ ] Short response interrupt → partial response preserved
- [ ] Long response interrupt → partial response verified
- [ ] Tool call interrupt → clean termination
- [ ] Multiple interrupts → no memory leaks
- [ ] Interrupt then restart → normal operation

### Completion Criteria

- [ ] ESC key immediately interrupts generation
- [ ] Partial response is preserved
- [ ] UI shows interrupt message
- [ ] No memory leaks
- [ ] All tests passing

---

## P1-3: YOLO Mode vs Ask Mode

**Goal**: Tab key to toggle YOLO/Ask mode, confirm dangerous operations

**Priority**: P1 (Important)
**Estimated Time**: 1-2 days
**Dependencies**: None
**Status**: Not Started
**Source**: NEW_FEATURES.md Section 2.8

### Overview

Two execution modes:
- **YOLO Mode**: LLM autonomously executes all operations (no user confirmation)
- **Ask Mode** (default): Confirms dangerous operations (file write, delete, etc.) before execution

### Mode Definitions

**YOLO Mode** (You Only Live Once):
```
Features:
- LLM freely calls all tools
- File write, modify, delete without confirmation
- Fast operation speed
- Suitable for trusted tasks

Risk: ⚠️ High (possible file loss on mistakes)

Use cases:
- Test projects
- When backups exist
- Full trust in LLM
```

**Ask Mode** (default):
```
Features:
- User confirmation before dangerous operations
- Y/n prompt before file write/modify/delete
- Safe operation guarantee
- Suitable for beginners and important projects

Risk: ✅ Low (all changes confirmable)

Use cases:
- Production code
- Important file operations
- When wanting to verify LLM behavior
```

### Architecture

**Mode switching flow**:
```
User presses Tab
    ↓
Toggle mode: YOLO ↔ Ask
    ↓
Update UI indicator
    ↓
Save mode preference to config
```

**Tool execution flow** (Ask Mode):
```
LLM wants to call write_file
    ↓
Check current mode
    ↓
If Ask Mode:
    ├─ Show confirmation prompt
    ├─ User input (Y/n)
    └─ Execute if Y, skip if n
    ↓
If YOLO Mode:
    └─ Execute immediately
```

### Implementation

**Type Definitions**:

```typescript
// src/types/index.ts (MODIFY)

export type ExecutionMode = 'yolo' | 'ask';

export interface AppState {
  mode: ExecutionMode;
  messages: Message[];
  isGenerating: boolean;
}
```

**ConfigManager Modification**:

```typescript
// src/core/config-manager.ts (MODIFY)

export interface Config {
  models: ModelConfig[];
  currentModel: string;
  executionMode: ExecutionMode; // ← Add
  autoUpdate: AutoUpdateConfig;
}

export class ConfigManager {
  /**
   * Get execution mode
   */
  getExecutionMode(): ExecutionMode {
    const config = this.loadConfig();
    return config.executionMode || 'ask'; // Default: ask
  }

  /**
   * Set execution mode
   */
  setExecutionMode(mode: ExecutionMode): void {
    const config = this.loadConfig();
    config.executionMode = mode;
    this.saveConfig(config);
    console.log(`[ConfigManager] Execution mode set to: ${mode}`);
  }
}
```

**InteractiveApp Modification**:

```typescript
// src/ui/InteractiveApp.tsx (MODIFY)

import { useInput } from 'ink';
import { useState, useEffect } from 'react';
import { configManager } from '../core/config-manager.js';
import { ExecutionMode } from '../types/index.js';

export const InteractiveApp: React.FC = () => {
  const [mode, setMode] = useState<ExecutionMode>(
    configManager.getExecutionMode()
  );
  const [isGenerating, setIsGenerating] = useState(false);

  // Tab: mode switch, ESC: interrupt
  useInput((input, key) => {
    // Tab: Mode switch
    if (key.tab && !isGenerating) {
      const newMode: ExecutionMode = mode === 'yolo' ? 'ask' : 'yolo';
      setMode(newMode);
      configManager.setExecutionMode(newMode);
      console.log(`[UI] Mode switched to: ${newMode.toUpperCase()}`);
    }

    // ESC: Interrupt LLM (existing)
    if (key.escape && isGenerating) {
      llmClient.interrupt();
      setIsGenerating(false);
    }
  });

  return (
    <Box flexDirection="column">
      {/* Header with Mode Indicator */}
      <Header mode={mode} />

      {/* Messages */}
      <MessageList messages={messages} />

      {/* Input with Mode Display */}
      <InputBox
        mode={mode}
        placeholder={`[${mode.toUpperCase()}] Type your message... (Tab to switch mode, ESC to stop)`}
        onSubmit={handleSubmit}
        disabled={isGenerating}
      />
    </Box>
  );
};
```

**Header Component**:

```typescript
// src/ui/components/Header.tsx (MODIFY)

import React from 'react';
import { Box, Text } from 'ink';
import { ExecutionMode } from '../../types/index.js';

interface HeaderProps {
  mode: ExecutionMode;
  model?: string;
  workingDir?: string;
}

export const Header: React.FC<HeaderProps> = ({ mode, model, workingDir }) => {
  const modeColor = mode === 'yolo' ? 'red' : 'green';
  const modeLabel = mode.toUpperCase();
  const otherMode = mode === 'yolo' ? 'Ask' : 'YOLO';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginBottom={1}
    >
      <Box justifyContent="space-between">
        <Text bold>OPEN-CLI Interactive Mode</Text>
        <Box>
          <Text>[</Text>
          <Text color={modeColor} bold>{modeLabel} MODE</Text>
          <Text>] Tab↔{otherMode}</Text>
        </Box>
      </Box>
      <Box>
        <Text dimColor>Model: {model || 'unknown'} | {workingDir || '~'}</Text>
      </Box>
    </Box>
  );
};
```

**ToolExecutor Modification**:

```typescript
// src/core/tool-executor.ts (MODIFY)

import { ExecutionMode } from '../types/index.js';
import inquirer from 'inquirer';

export class ToolExecutor {
  private mode: ExecutionMode;

  constructor(mode: ExecutionMode) {
    this.mode = mode;
  }

  /**
   * Update mode
   */
  setMode(mode: ExecutionMode): void {
    this.mode = mode;
  }

  /**
   * Execute tool (confirm based on mode)
   */
  async executeTool(toolName: string, args: any): Promise<any> {
    // Check if dangerous tool
    const dangerousTools = [
      'write_file',
      'edit_file',
      'delete_file',
      'execute_command',
      'create_directory',
      'move_file',
    ];

    const isDangerous = dangerousTools.includes(toolName);

    // Ask Mode and dangerous tool → request confirmation
    if (this.mode === 'ask' && isDangerous) {
      console.log('\n');

      const confirmed = await this.askConfirmation(toolName, args);

      if (!confirmed) {
        return {
          success: false,
          message: `Operation cancelled by user (Ask Mode)`,
        };
      }
    }

    // Execute tool
    return await this.executeToolInternal(toolName, args);
  }

  /**
   * Request user confirmation
   */
  private async askConfirmation(toolName: string, args: any): Promise<boolean> {
    console.log(`⚠️  ${toolName} will be executed with:`);
    console.log(JSON.stringify(args, null, 2));
    console.log('');

    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed with this operation?',
        default: true,
      },
    ]);

    return answer.proceed;
  }

  /**
   * Execute tool (internal)
   */
  private async executeToolInternal(toolName: string, args: any): Promise<any> {
    // Actual tool execution logic
    // (keep existing code)
    switch (toolName) {
      case 'write_file':
        return await writeFile(args);
      case 'edit_file':
        return await editFile(args);
      // ...
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }
}
```

### UI Design

**Mode Indicator (Header)**:

YOLO Mode:
```
┌────────────────────────────────────────────────────────────┐
│ OPEN-CLI Interactive Mode          [YOLO MODE] Tab↔Ask    │
│ Model: gemini-2.0-flash | ~/project                       │
└────────────────────────────────────────────────────────────┘
```

Ask Mode:
```
┌────────────────────────────────────────────────────────────┐
│ OPEN-CLI Interactive Mode          [ASK MODE] Tab↔YOLO    │
│ Model: gemini-2.0-flash | ~/project                       │
└────────────────────────────────────────────────────────────┘
```

**Confirmation Prompt (Ask Mode)**:
```
🤖 Assistant: I'll create a new file for you.

⚠️  write_file will be executed with:
{
  "file_path": "./new-file.txt",
  "content": "Hello World"
}

? Proceed with this operation? (Y/n) _
```

**YOLO Mode (No Prompt)**:
```
🤖 Assistant: I'll create a new file for you.

✓ write_file executed: ./new-file.txt (23 bytes written)
```

### Testing Scenarios

- [ ] Tab switch: Ask Mode → Tab → YOLO Mode → Tab → Ask Mode
- [ ] Ask Mode confirm: write_file call → prompt → Y → execute
- [ ] Ask Mode reject: write_file call → prompt → n → cancel
- [ ] YOLO Mode immediate: write_file call → execute immediately
- [ ] Mode save: mode switch → CLI restart → previous mode retained
- [ ] Read-only tool: read_file call → immediate execution in all modes

### Completion Criteria

- [ ] Tab key toggles mode
- [ ] UI clearly shows current mode
- [ ] Ask Mode confirms dangerous operations
- [ ] YOLO Mode executes all operations immediately
- [ ] All tests passing

---

(Continuing with remaining P1 features and all P2/P3 features in next section due to length...)


## P1-4: File Edit Tool Improvements (Replace Method)

**Goal**: Original content verification before replace, retry on mismatch

**Priority**: P1 (Important)
**Estimated Time**: 1 day
**Dependencies**: None
**Status**: Not Started
**Source**: NEW_FEATURES.md Section 2.9

### Overview

Improve existing edit_file tool to use line numbers and exact content verification. On content mismatch, provide actual content and prompt for retry.

### Current Issues

**Existing method problems**:
```typescript
// Current edit_file
{
  file_path: 'src/app.ts',
  old_content: 'console.log("hello")',  // ← Must match exactly
  new_content: 'console.log("world")'
}

Problems:
1. Whitespace, tabs, newlines must match exactly
2. LLM doesn't perfectly remember original
3. Retry method unclear on failure
4. Inefficient for multiple edits
```

### New Design: Replace with Line Numbers

**New edit_file schema**:
```typescript
{
  file_path: string;
  original_lines: {
    start: number;  // Start line number (1-based)
    end: number;    // End line number (inclusive)
    content: string; // Original content (for verification)
  };
  replace_lines: {
    content: string; // New content
  };
}
```

**Execution flow**:
```
1. Read file
2. Extract actual content from original_lines.start ~ end
3. Compare with original_lines.content
4. Match → replace with replace_lines.content
5. Mismatch → return error + actual content + retry request
```

### Implementation

**New EDIT_FILE_TOOL Definition**:

```typescript
// src/tools/file-tools.ts (MODIFY)

import fs from 'fs';
import path from 'path';

/**
 * Edit File Tool (new method)
 */
export const EDIT_FILE_TOOL = {
  type: 'function',
  function: {
    name: 'edit_file',
    description: `Edit a file by replacing specific lines with new content.

IMPORTANT INSTRUCTIONS:
1. First, ALWAYS read the file with read_file to see current content and line numbers
2. Identify exact lines to modify (count carefully, 1-based indexing)
3. Copy EXACT original content (including all whitespace, tabs, newlines)
4. Provide new content to replace those lines
5. If you get "Original content mismatch" error:
   - Read actual_content from error response
   - Retry edit_file with EXACT content provided

Example:
  File has 10 lines, you want to change lines 5-7:
  {
    "file_path": "src/app.ts",
    "original_lines": {
      "start": 5,
      "end": 7,
      "content": "function hello() {\\n  console.log('hello');\\n}"
    },
    "replace_lines": {
      "content": "function hello() {\\n  console.log('Hello, World!');\\n}"
    }
  }`,
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to file to edit (relative or absolute)',
        },
        original_lines: {
          type: 'object',
          description: 'Original lines to be replaced (for verification)',
          properties: {
            start: {
              type: 'number',
              description: 'Start line number (1-based, inclusive)',
            },
            end: {
              type: 'number',
              description: 'End line number (1-based, inclusive)',
            },
            content: {
              type: 'string',
              description: 'Exact original content of these lines (must match exactly, including whitespace)',
            },
          },
          required: ['start', 'end', 'content'],
        },
        replace_lines: {
          type: 'object',
          description: 'New content to replace original lines',
          properties: {
            content: {
              type: 'string',
              description: 'New content (can be multiple lines, use \\n for line breaks)',
            },
          },
          required: ['content'],
        },
      },
      required: ['file_path', 'original_lines', 'replace_lines'],
    },
  },
};

/**
 * Edit File execution logic
 */
export async function editFile(args: {
  file_path: string;
  original_lines: {
    start: number;
    end: number;
    content: string;
  };
  replace_lines: {
    content: string;
  };
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  actual_content?: string;
}> {
  const { file_path, original_lines, replace_lines } = args;

  try {
    // 1. Check file exists
    const absPath = path.resolve(file_path);

    if (!fs.existsSync(absPath)) {
      return {
        success: false,
        error: `File not found: ${file_path}`,
      };
    }

    // 2. Read file
    const fileContent = fs.readFileSync(absPath, 'utf-8');
    const lines = fileContent.split('\n');

    // 3. Validate line numbers
    if (original_lines.start < 1) {
      return {
        success: false,
        error: `Line numbers must be >= 1. You provided start: ${original_lines.start}`,
      };
    }

    if (original_lines.end > lines.length) {
      return {
        success: false,
        error: `Line numbers out of range. File has ${lines.length} lines, but you requested end line: ${original_lines.end}`,
      };
    }

    if (original_lines.start > original_lines.end) {
      return {
        success: false,
        error: `Invalid line range: start (${original_lines.start}) > end (${original_lines.end})`,
      };
    }

    // 4. Extract original content (convert to 0-based indexing)
    const actualContent = lines
      .slice(original_lines.start - 1, original_lines.end)
      .join('\n');

    // 5. Verify original content
    if (actualContent !== original_lines.content) {
      return {
        success: false,
        error: `Original content mismatch. The actual content of lines ${original_lines.start}-${original_lines.end} doesn't match what you provided.`,
        actual_content: actualContent,
        message: `Please retry with correct original content:

Lines ${original_lines.start}-${original_lines.end} (actual content):
\`\`\`
${actualContent}
\`\`\`

Retry edit_file with this EXACT content in original_lines.content field.`,
      };
    }

    // 6. Replace content
    const replaceLines = replace_lines.content.split('\n');
    const newLines = [
      ...lines.slice(0, original_lines.start - 1),
      ...replaceLines,
      ...lines.slice(original_lines.end),
    ];

    // 7. Write file
    fs.writeFileSync(absPath, newLines.join('\n'), 'utf-8');

    const bytesWritten = Buffer.byteLength(newLines.join('\n'), 'utf-8');

    return {
      success: true,
      message: `Successfully edited ${file_path}:
- Replaced lines ${original_lines.start}-${original_lines.end} (${original_lines.end - original_lines.start + 1} lines)
- New content: ${replaceLines.length} lines
- File size: ${bytesWritten} bytes`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to edit file: ${error.message}`,
    };
  }
}
```

### LLM Usage Examples

**Scenario 1: Successful edit**

Step 1: Read file first
```json
{
  "tool": "read_file",
  "arguments": {
    "file_path": "src/app.ts"
  }
}
```

Response:
```
     1  import express from 'express';
     2
     3  const app = express();
     4
     5  function hello() {
     6    console.log('hello');
     7  }
     8
     9  app.listen(3000);
    10
```

Step 2: Edit with correct line numbers
```json
{
  "tool": "edit_file",
  "arguments": {
    "file_path": "src/app.ts",
    "original_lines": {
      "start": 5,
      "end": 7,
      "content": "function hello() {\n  console.log('hello');\n}"
    },
    "replace_lines": {
      "content": "function hello() {\n  console.log('Hello, World!');\n}"
    }
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Successfully edited src/app.ts:\n- Replaced lines 5-7 (3 lines)\n- New content: 3 lines\n- File size: 145 bytes"
}
```

**Scenario 2: Content mismatch → retry**

LLM call (wrong original):
```json
{
  "tool": "edit_file",
  "arguments": {
    "file_path": "src/app.ts",
    "original_lines": {
      "start": 5,
      "end": 7,
      "content": "function hello(){\nconsole.log('hello');}"  // ← Wrong spacing
    },
    "replace_lines": {
      "content": "function hello() {\n  console.log('Hello, World!');\n}"
    }
  }
}
```

Error response:
```json
{
  "success": false,
  "error": "Original content mismatch. The actual content of lines 5-7 doesn't match what you provided.",
  "actual_content": "function hello() {\n  console.log('hello');\n}",
  "message": "Please retry with correct original content:\n\nLines 5-7 (actual content):\n```\nfunction hello() {\n  console.log('hello');\n}\n```\n\nRetry edit_file with this EXACT content in original_lines.content field."
}
```

LLM retries with correct content:
```json
{
  "original_lines": {
    "start": 5,
    "end": 7,
    "content": "function hello() {\n  console.log('hello');\n}"  // ← Correct
  },
  "replace_lines": {
    "content": "function hello() {\n  console.log('Hello, World!');\n}"
  }
}
```

Success!

### System Prompt Update

**LLM instructions** (`src/prompts/system-prompt.ts`):

```typescript
export const SYSTEM_PROMPT = `You are a helpful AI assistant with file system tool access.

**IMPORTANT RULES for edit_file:**
1. ALWAYS read file with read_file before editing
2. Count line numbers carefully (1-based indexing: first line is 1, not 0)
3. Copy EXACT original content including:
   - All spaces and tabs
   - All newlines (use \\n in JSON)
   - All special characters
4. If you get "Original content mismatch" error:
   - Carefully read actual_content from error response
   - Copy it EXACTLY and retry edit_file
   - Do NOT try to guess or approximate content
5. For large files, edit small sections at a time (5-10 lines max)
6. After editing, you can read file again to verify changes

**Example workflow:**
1. read_file("src/app.ts") → see lines 1-100
2. Identify lines to change (e.g., lines 25-28)
3. Copy EXACT content of lines 25-28
4. Call edit_file with original_lines and replace_lines
5. If error, read actual_content and retry
6. Success!

Available tools: read_file, write_file, edit_file, list_files, find_files, execute_command
`;
```

### Testing Scenarios

- [ ] Normal edit: read file → exact line numbers → success
- [ ] Content mismatch: wrong original → error + actual_content → retry → success
- [ ] Line number overflow: end > file line count → error message
- [ ] File not found: non-existent file → error message
- [ ] Multi-line edit: 10 lines → 3 lines compression → success
- [ ] Single line edit: start == end → single line replace → success

### Completion Criteria

- [ ] Line numbers enable precise editing
- [ ] Original content mismatch → error + actual_content provided
- [ ] LLM can successfully retry
- [ ] All tests passing

---

## P1-5: Config Init Improvements & Model Management

**Goal**: One-time `open` command setup, /addmodel /deletemodel /model /reset commands

**Priority**: P1 (Important)
**Estimated Time**: 2 days
**Dependencies**: None
**Status**: Not Started
**Source**: NEW_FEATURES.md Section 2.10

### Overview

Simplify configuration:
- Remove `open config init` requirement
- First `open` execution automatically runs setup
- Add model management meta-commands
- Provide helpful messages when no models configured

### New Flow

**Current flow** (inconvenient):
```bash
$ open config init
? Enter endpoint name: local
? Enter base URL: http://localhost:8000/v1
? Enter API key: (optional)
? Enter model ID: gemini-2.0-flash

✅ Config saved!

$ open
(CLI starts)
```

**New flow** (convenient):
```bash
$ open

(No models detected)

┌────────────────────────────────────────────┐
│ Welcome to OPEN-CLI! 🚀                    │
│                                            │
│ No models configured yet.                 │
│ Let's set up your first model.            │
└────────────────────────────────────────────┘

? Model name (e.g., local-gemini): local
? Base URL: http://localhost:8000/v1
? API Key (optional):
? Model ID: gemini-2.0-flash

✅ Model 'local' saved!

Starting OPEN-CLI...

You: _
```

### Model Management Commands

**New meta-commands**:

#### 1. /addmodel - Add new model

```
You: /addmodel

? Model name: openrouter
? Base URL: https://openrouter.ai/api/v1
? API Key: sk-or-v1-...
? Model ID: anthropic/claude-3.5-sonnet

✅ Model 'openrouter' added!
Use /model to switch between models.
```

#### 2. /deletemodel - Delete model

```
You: /deletemodel

Available models:
  1. local (current)
  2. openrouter
  3. deepinfra

? Select model to delete: 2

⚠️  Delete model 'openrouter'? This cannot be undone. (y/N): y

✅ Model 'openrouter' deleted!
```

#### 3. /model - Switch model

```
You: /model

Available models:
  1. local (current) - gemini-2.0-flash
  2. openrouter - anthropic/claude-3.5-sonnet
  3. deepinfra - meta-llama/Llama-3.3-70B

? Select model: 2

✅ Switched to 'openrouter'
Model: anthropic/claude-3.5-sonnet
Base URL: https://openrouter.ai/api/v1

Restarting conversation with new model...
```

#### 4. /reset - Reset all configurations

```
You: /reset

⚠️  WARNING: This will delete ALL configurations, models, and sessions.
This action cannot be undone.

? Are you sure you want to reset everything? (y/N): y

✅ All configurations reset!

OPEN-CLI will now exit. Run 'open' to set up again.

(Process exits)
```

### Config Structure

**New config.json structure**:

```json
{
  "models": [
    {
      "name": "local",
      "baseUrl": "http://localhost:8000/v1",
      "apiKey": "",
      "modelId": "gemini-2.0-flash",
      "isDefault": true,
      "createdAt": "2025-11-05T10:30:00Z"
    },
    {
      "name": "openrouter",
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "sk-or-v1-...",
      "modelId": "anthropic/claude-3.5-sonnet",
      "isDefault": false,
      "createdAt": "2025-11-05T11:15:00Z"
    }
  ],
  "currentModel": "local",
  "executionMode": "ask",
  "autoUpdate": {
    "enabled": true,
    "checkOnStartup": true,
    "autoInstall": false
  }
}
```

### Implementation

**Type Definitions**:

```typescript
// src/types/index.ts (MODIFY)

export interface ModelConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  isDefault: boolean;
  createdAt: string;
}

export interface Config {
  models: ModelConfig[];
  currentModel: string;
  executionMode: ExecutionMode;
  autoUpdate: AutoUpdateConfig;
}
```

**ConfigManager Extension**:

```typescript
// src/core/config-manager.ts (MODIFY)

import fs from 'fs';
import path from 'path';
import os from 'os';

export class ConfigManager {
  private configPath: string;

  constructor() {
    const configDir = path.join(os.homedir(), '.open-cli');
    this.configPath = path.join(configDir, 'config.json');

    // Create directory
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  /**
   * Check if models exist
   */
  hasModels(): boolean {
    const config = this.loadConfig();
    return config.models && config.models.length > 0;
  }

  /**
   * Get all models
   */
  getAllModels(): ModelConfig[] {
    const config = this.loadConfig();
    return config.models || [];
  }

  /**
   * Add model
   */
  addModel(model: Omit<ModelConfig, 'createdAt'>): void {
    const config = this.loadConfig();

    if (!config.models) {
      config.models = [];
    }

    // Check for duplicate name
    if (config.models.some((m) => m.name === model.name)) {
      throw new Error(`Model '${model.name}' already exists. Use a different name.`);
    }

    // Add model (with timestamp)
    const newModel: ModelConfig = {
      ...model,
      createdAt: new Date().toISOString(),
    };

    // First model automatically becomes current
    if (config.models.length === 0) {
      newModel.isDefault = true;
      config.currentModel = newModel.name;
    }

    config.models.push(newModel);
    this.saveConfig(config);

    console.log(`[ConfigManager] Model '${model.name}' added`);
  }

  /**
   * Delete model
   */
  deleteModel(modelName: string): void {
    const config = this.loadConfig();

    const index = config.models.findIndex((m) => m.name === modelName);
    if (index === -1) {
      throw new Error(`Model '${modelName}' not found.`);
    }

    // Cannot delete current model
    if (config.currentModel === modelName) {
      throw new Error(
        `Cannot delete the current model '${modelName}'. Switch to another model first using /model.`
      );
    }

    // Cannot delete last model
    if (config.models.length === 1) {
      throw new Error(
        `Cannot delete the only model. Add another model first using /addmodel.`
      );
    }

    config.models.splice(index, 1);
    this.saveConfig(config);

    console.log(`[ConfigManager] Model '${modelName}' deleted`);
  }

  /**
   * Switch model
   */
  switchModel(modelName: string): void {
    const config = this.loadConfig();

    const model = config.models.find((m) => m.name === modelName);
    if (!model) {
      throw new Error(`Model '${modelName}' not found.`);
    }

    config.currentModel = modelName;
    this.saveConfig(config);

    console.log(`[ConfigManager] Switched to model: ${modelName}`);
  }

  /**
   * Get current model
   */
  getCurrentModel(): ModelConfig | null {
    const config = this.loadConfig();

    if (!config.currentModel || !config.models) {
      return null;
    }

    return config.models.find((m) => m.name === config.currentModel) || null;
  }

  /**
   * Reset all configurations
   */
  reset(): void {
    const defaultConfig: Config = {
      models: [],
      currentModel: '',
      executionMode: 'ask',
      autoUpdate: {
        enabled: true,
        checkOnStartup: true,
        autoInstall: false,
      },
    };

    this.saveConfig(defaultConfig);

    // Delete sessions directory as well
    const sessionsDir = path.join(path.dirname(this.configPath), 'sessions');
    if (fs.existsSync(sessionsDir)) {
      fs.rmSync(sessionsDir, { recursive: true, force: true });
    }

    console.log('[ConfigManager] All configurations reset');
  }

  /**
   * Load config
   */
  private loadConfig(): Config {
    if (!fs.existsSync(this.configPath)) {
      return {
        models: [],
        currentModel: '',
        executionMode: 'ask',
        autoUpdate: { enabled: true, checkOnStartup: true },
      };
    }

    return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
  }

  /**
   * Save config
   */
  private saveConfig(config: Config): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }
}

export const configManager = new ConfigManager();
```

**CLI Startup Logic**:

```typescript
// src/cli.ts (MODIFY)

#!/usr/bin/env node

import { program } from 'commander';
import { configManager } from './core/config-manager.js';
import inquirer from 'inquirer';
import { checkAndUpdate } from './core/auto-updater.js';

async function main() {
  // 1. Auto-update check
  await checkAndUpdate();

  // 2. Check if models exist
  if (!configManager.hasModels()) {
    await runFirstTimeSetup();
  }

  // 3. Start CLI
  program
    .name('open')
    .description('Offline Enterprise AI-Powered CLI Platform')
    .version('0.2.0')
    .option('--no-update', 'Skip auto-update check')
    .action(async () => {
      // Start Interactive mode
      const { startInteractiveMode } = await import('./modes/interactive.js');
      await startInteractiveMode();
    });

  program.parse();
}

/**
 * First-time setup (when no models)
 */
async function runFirstTimeSetup() {
  console.log('\n┌────────────────────────────────────────────┐');
  console.log('│ Welcome to OPEN-CLI! 🚀                    │');
  console.log('│                                            │');
  console.log('│ No models configured yet.                 │');
  console.log('│ Let\'s set up your first model.            │');
  console.log('└────────────────────────────────────────────┘\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Model name (e.g., local-gemini):',
      default: 'local',
      validate: (input) => {
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Model name must contain only lowercase letters, numbers, and hyphens';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL:',
      default: 'http://localhost:8000/v1',
      validate: (input) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key (optional, press Enter to skip):',
      default: '',
    },
    {
      type: 'input',
      name: 'modelId',
      message: 'Model ID:',
      default: 'gemini-2.0-flash',
    },
  ]);

  configManager.addModel({
    name: answers.name,
    baseUrl: answers.baseUrl,
    apiKey: answers.apiKey,
    modelId: answers.modelId,
    isDefault: true,
  });

  console.log(`\n✅ Model '${answers.name}' saved!`);
  console.log('Starting OPEN-CLI...\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**Meta-commands Implementation**:

```typescript
// src/modes/interactive.ts (MODIFY)

import inquirer from 'inquirer';
import { configManager } from '../core/config-manager.js';

export async function startInteractiveMode() {
  // ... existing code ...

  // User input processing
  const userInput = await promptUser();

  // Meta-command processing
  if (userInput.startsWith('/')) {
    const command = userInput.slice(1).split(' ')[0];

    switch (command) {
      case 'addmodel':
        await handleAddModel();
        continue;

      case 'deletemodel':
        await handleDeleteModel();
        continue;

      case 'model':
        await handleSwitchModel();
        continue;

      case 'reset':
        await handleReset();
        process.exit(0); // Exit

      case 'exit':
      case 'quit':
        console.log('\nGoodbye! 👋\n');
        process.exit(0);

      // ... existing commands ...

      default:
        console.log(`Unknown command: /${command}`);
        console.log('Type /help to see available commands');
        continue;
    }
  }

  // Normal message processing
  // ...
}

/**
 * /addmodel handler
 */
async function handleAddModel() {
  console.log('\n📝 Add New Model\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Model name:',
      validate: (input) => {
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Model name must contain only lowercase letters, numbers, and hyphens';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL:',
      validate: (input) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key (optional):',
      default: '',
    },
    {
      type: 'input',
      name: 'modelId',
      message: 'Model ID:',
    },
  ]);

  try {
    configManager.addModel({
      name: answers.name,
      baseUrl: answers.baseUrl,
      apiKey: answers.apiKey,
      modelId: answers.modelId,
      isDefault: false,
    });

    console.log(`\n✅ Model '${answers.name}' added!`);
    console.log('Use /model to switch between models.\n');
  } catch (error: any) {
    console.error(`\n❌ ${error.message}\n`);
  }
}

/**
 * /deletemodel handler
 */
async function handleDeleteModel() {
  const models = configManager.getAllModels();

  if (models.length === 0) {
    console.log('\n❌ No models configured.\n');
    return;
  }

  console.log('\n🗑️  Delete Model\n');
  console.log('Available models:');
  models.forEach((model, index) => {
    const current = configManager.getCurrentModel()?.name === model.name;
    console.log(`  ${index + 1}. ${model.name}${current ? ' (current)' : ''}`);
  });

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'modelIndex',
      message: 'Select model to delete:',
      choices: models.map((model, index) => ({
        name: `${model.name} - ${model.modelId}`,
        value: index,
      })),
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: (answers) => {
        const modelName = models[answers.modelIndex].name;
        return `Delete model '${modelName}'? This cannot be undone.`;
      },
      default: false,
    },
  ]);

  if (answer.confirm) {
    const modelName = models[answer.modelIndex].name;

    try {
      configManager.deleteModel(modelName);
      console.log(`\n✅ Model '${modelName}' deleted!\n`);
    } catch (error: any) {
      console.error(`\n❌ ${error.message}\n`);
    }
  } else {
    console.log('\n❌ Cancelled.\n');
  }
}

/**
 * /model handler
 */
async function handleSwitchModel() {
  const models = configManager.getAllModels();
  const currentModel = configManager.getCurrentModel();

  if (models.length === 0) {
    console.log('\n❌ No models configured.\n');
    return;
  }

  console.log('\n🔄 Switch Model\n');
  console.log('Available models:');
  models.forEach((model, index) => {
    const current = currentModel?.name === model.name;
    console.log(
      `  ${index + 1}. ${model.name}${current ? ' (current)' : ''} - ${model.modelId}`
    );
  });

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'modelIndex',
      message: 'Select model:',
      choices: models.map((model, index) => ({
        name: `${model.name} - ${model.modelId}`,
        value: index,
      })),
    },
  ]);

  const selectedModel = models[answer.modelIndex];

  if (selectedModel.name === currentModel?.name) {
    console.log(`\n✅ Already using model '${selectedModel.name}'\n`);
    return;
  }

  configManager.switchModel(selectedModel.name);

  console.log(`\n✅ Switched to model '${selectedModel.name}'`);
  console.log(`Model: ${selectedModel.modelId}`);
  console.log(`Base URL: ${selectedModel.baseUrl}`);
  console.log('\nRestarting conversation with new model...\n');

  // Reset message history (optional)
  // messages = [];
}

/**
 * /reset handler
 */
async function handleReset() {
  console.log('\n⚠️  RESET ALL CONFIGURATIONS\n');

  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message:
        'This will delete ALL configurations, models, and sessions. This action cannot be undone. Are you sure?',
      default: false,
    },
  ]);

  if (answer.confirm) {
    configManager.reset();
    console.log('\n✅ All configurations reset!');
    console.log('\nOPEN-CLI will now exit. Run \'open\' to set up again.\n');
    process.exit(0);
  } else {
    console.log('\n❌ Reset cancelled.\n');
  }
}
```

### Testing Scenarios

- [ ] First execution: no models → setup prompt → model add → CLI start
- [ ] /addmodel: new model add → success message
- [ ] /addmodel duplicate: same name add → error message
- [ ] /deletemodel: model select → confirm → delete
- [ ] /deletemodel current model: attempt to delete current → error
- [ ] /model: model select → switch → conversation restart
- [ ] /reset: full reset confirm → reset → program exit
- [ ] Existing config init removed: `open config init` command doesn't exist

### Completion Criteria

- [ ] `open` completes all setup in one command
- [ ] /addmodel, /deletemodel, /model, /reset commands functional
- [ ] Helpful message when no saved models
- [ ] All tests passing

---

## P1-6: TODO Auto-Save on Completion

**Goal**: Auto-save session on each TODO completion, resume on restart

**Priority**: P1 (Important)
**Estimated Time**: 1 day
**Dependencies**: P0-2 (Plan-and-Execute Architecture)
**Status**: Not Started
**Source**: NEW_FEATURES.md Section 2.11

### Overview

In Plan-and-Execute mode, automatically save progress when each TODO completes. On interruption and restart, provide recovery prompt.

### Architecture

**Auto-save trigger**:
```
TODO execution start
    ↓
TODO in progress (in_progress)
    ↓
LLM performs work...
    ↓
TODO complete (completed)
    ↓
✅ Auto-save session ← Auto-save here
    ↓
Move to next TODO
```

**Save content**:
- Completed TODO list (status, result, timestamps)
- Current TODO state
- Conversation message history
- Metadata (timestamp, model info, progress)

**Save frequency**:
- Each TODO completion (incremental save)
- Also save on TODO failure (with error info)
- User can manually save with /save command

### Implementation

**SessionData Extension**:

```typescript
// src/types/index.ts (MODIFY)

export interface TodoItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  requiresDocsSearch: boolean;
  dependencies: string[];
  result?: string;
  error?: string;
  startedAt?: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
}

export interface SessionData {
  sessionId: string;
  messages: Message[];
  todos?: TodoItem[]; // ← Plan-and-Execute mode
  timestamp: string;
  metadata: {
    model: string;
    mode: ExecutionMode;
    completedTodos?: number;
    totalTodos?: number;
    lastTodoCompleted?: string; // TODO title
  };
}
```

**TodoExecutor Modification**:

```typescript
// src/core/todo-executor.ts (MODIFY)

import { sessionManager } from './session-manager.js';
import { LLMClient } from './llm-client.js';
import { Message, TodoItem } from '../types/index.js';
import { executeDocsSearchAgent } from './docs-search-agent.js';

export class TodoExecutor {
  private llmClient: LLMClient;
  private sessionId: string;

  constructor(llmClient: LLMClient, sessionId: string) {
    this.llmClient = llmClient;
    this.sessionId = sessionId;
  }

  /**
   * Execute TODO
   */
  async executeTodo(
    todo: TodoItem,
    messages: Message[],
    allTodos: TodoItem[]
  ): Promise<{ messages: Message[]; todo: TodoItem }> {
    // 1. Change TODO status: pending → in_progress
    todo.status = 'in_progress';
    todo.startedAt = new Date().toISOString();

    // Save progress (optional)
    await this.autoSave(messages, allTodos);

    try {
      // 2. Docs Search (pre-execution)
      if (todo.requiresDocsSearch) {
        console.log(`[TodoExecutor] Running Docs Search for TODO: ${todo.title}`);
        const searchResult = await executeDocsSearchAgent(
          this.llmClient,
          todo.description
        );

        if (searchResult.success) {
          // Add search results to messages
          messages.push({
            role: 'system',
            content: `Docs Search Result:\n${searchResult.result}`,
          });
        }
      }

      // 3. Execute Main LLM (with Tools)
      console.log(`[TodoExecutor] Executing TODO: ${todo.title}`);

      const result = await this.llmClient.chatCompletionWithTools(
        { messages },
        FILE_TOOLS,
        10 // max iterations
      );

      // 4. Complete TODO
      todo.status = 'completed';
      todo.completedAt = new Date().toISOString();
      todo.result = result.content;

      // Add assistant message
      messages.push({
        role: 'assistant',
        content: result.content,
      });

      // ✅ 5. Auto-save (Important!)
      console.log(`[TodoExecutor] TODO completed, auto-saving session...`);
      await this.autoSave(messages, allTodos);

      return { messages, todo };
    } catch (error: any) {
      // Save even on error
      todo.status = 'failed';
      todo.error = error.message;
      todo.completedAt = new Date().toISOString();

      console.error(`[TodoExecutor] TODO failed: ${error.message}`);
      await this.autoSave(messages, allTodos);

      throw error;
    }
  }

  /**
   * Auto-save (incremental save)
   */
  private async autoSave(messages: Message[], todos: TodoItem[]): Promise<void> {
    try {
      const completedTodos = todos.filter((t) => t.status === 'completed').length;
      const lastCompleted = todos
        .filter((t) => t.status === 'completed')
        .pop();

      await sessionManager.saveSession(this.sessionId, {
        sessionId: this.sessionId,
        messages,
        todos,
        timestamp: new Date().toISOString(),
        metadata: {
          model: this.llmClient.model,
          mode: 'ask', // Current mode
          completedTodos,
          totalTodos: todos.length,
          lastTodoCompleted: lastCompleted?.title,
        },
      });

      console.log(
        `[TodoExecutor] Session auto-saved (${completedTodos}/${todos.length} todos completed)`
      );
    } catch (error: any) {
      console.error(`[TodoExecutor] Auto-save failed: ${error.message}`);
      // Continue even if save fails (save failure shouldn't block execution)
    }
  }
}
```

**SessionManager Modification**:

```typescript
// src/core/session-manager.ts (MODIFY)

import fs from 'fs';
import path from 'path';
import os from 'os';
import { SessionData, TodoItem, Message } from '../types/index.js';

export class SessionManager {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = path.join(os.homedir(), '.open-cli', 'sessions');
    fs.mkdirSync(this.sessionsDir, { recursive: true });
  }

  /**
   * Save session (incremental save)
   */
  async saveSession(sessionId: string, data: SessionData): Promise<void> {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    try {
      // Merge with existing data (incremental save)
      let existingData: SessionData | null = null;
      if (fs.existsSync(sessionPath)) {
        existingData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      }

      const mergedData: SessionData = {
        ...existingData,
        ...data,
        timestamp: new Date().toISOString(), // Always latest timestamp
      };

      fs.writeFileSync(sessionPath, JSON.stringify(mergedData, null, 2), 'utf-8');

      console.log(`[SessionManager] Session saved: ${sessionId}`);
    } catch (error: any) {
      console.error(`[SessionManager] Failed to save session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load session
   */
  async loadSession(sessionId: string): Promise<SessionData | null> {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    if (!fs.existsSync(sessionPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    } catch (error: any) {
      console.error(`[SessionManager] Failed to load session: ${error.message}`);
      return null;
    }
  }

  /**
   * Recover session (with TODOs)
   */
  async recoverSession(sessionId: string): Promise<{
    messages: Message[];
    todos: TodoItem[];
    nextTodoIndex: number;
  } | null> {
    const session = await this.loadSession(sessionId);

    if (!session || !session.todos) {
      return null;
    }

    // Find next TODO to execute (pending or failed)
    const nextTodoIndex = session.todos.findIndex(
      (t) => t.status === 'pending' || t.status === 'failed'
    );

    return {
      messages: session.messages,
      todos: session.todos,
      nextTodoIndex: nextTodoIndex === -1 ? session.todos.length : nextTodoIndex,
    };
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<
    Array<{ sessionId: string; timestamp: string; metadata?: any }>
  > {
    try {
      const files = fs.readdirSync(this.sessionsDir);
      const sessions = files
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
          const sessionPath = path.join(this.sessionsDir, file);
          const data: SessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
          return {
            sessionId: data.sessionId,
            timestamp: data.timestamp,
            metadata: data.metadata,
          };
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return sessions;
    } catch (error: any) {
      console.error(`[SessionManager] Failed to list sessions: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
      console.log(`[SessionManager] Session deleted: ${sessionId}`);
    }
  }
}

export const sessionManager = new SessionManager();
```

### Session Recovery Flow

**CLI startup session detection**:

```typescript
// src/cli.ts (MODIFY)

async function main() {
  // ...

  // Detect previous session
  const sessions = await sessionManager.listSessions();
  const latestSession = sessions[0];

  if (latestSession && latestSession.metadata?.todos) {
    const completed = latestSession.metadata.completedTodos || 0;
    const total = latestSession.metadata.totalTodos || 0;

    if (completed < total) {
      // Incomplete TODOs found
      console.log('\n┌────────────────────────────────────────────┐');
      console.log(`│ 💾 Session found: ${latestSession.sessionId.slice(0, 20)}...  │`);
      console.log('│                                            │');
      console.log(`│ Progress: ${completed}/${total} TODO completed              │`);
      console.log(`│ Last TODO: "${latestSession.metadata.lastTodoCompleted?.slice(0, 30)}..." │`);
      console.log('│                                            │');
      console.log('└────────────────────────────────────────────┘');

      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'resume',
          message: 'Resume this session?',
          default: true,
        },
      ]);

      if (answer.resume) {
        // Recover session
        const recovered = await sessionManager.recoverSession(latestSession.sessionId);

        if (recovered) {
          console.log('\n✅ Session recovered! Resuming from TODO #' + (recovered.nextTodoIndex + 1) + '\n');

          // Pass recovered data to InteractiveMode
          await startInteractiveMode({
            messages: recovered.messages,
            todos: recovered.todos,
            resumeFromIndex: recovered.nextTodoIndex,
          });

          return;
        }
      } else {
        console.log('\nStarting fresh session...\n');
      }
    }
  }

  // Normal start
  await startInteractiveMode();
}
```

**Recovered UI**:

```
📋 TODO List (3/5 completed)
├──────────────────────────────────────────┤
│ ✓ 1. TypeScript project setup research   │
│ ✓ 2. Express.js installation and setup   │
│ ✓ 3. Create basic route structure        │
│ → 4. Implement API endpoints (resuming...) │
│ ☐ 5. Write test code                     │
└────────────────────────────────────────────┘

Resuming TODO 4: Implement API endpoints

🤖 Assistant: Let's implement the API endpoints...
```

### UI Feedback (Optional)

**Save indicator** (StatusBar):

```
┌────────────────────────────────────────────────────────────┐
│ Model: gemini-2.0-flash | 💾 Saved 2s ago | Context: 12.5K │
└────────────────────────────────────────────────────────────┘
```

Or TODO completion notification:

```
✓ 3. Create basic route structure (completed) 💾 Auto-saved
```

### Testing Scenarios

- [ ] TODO completion → save → verify session file
- [ ] Interruption → restart → recovery prompt → resume from TODO 3
- [ ] Multiple TODOs → save after each completion → verify todos array in session file
- [ ] TODO failure → save with error info
- [ ] Recovery rejection: recovery prompt → n → start fresh session
- [ ] Session list: /sessions command → show saved sessions

### Completion Criteria

- [ ] Auto-save on each TODO completion
- [ ] Recovery prompt on restart
- [ ] Resume from last completion point
- [ ] All tests passing

---

## P1-7: Tool Usage UI Display

**Goal**: Display tool calls in boxes

**Priority**: P1 (Important)
**Estimated Time**: 1 day
**Dependencies**: None
**Status**: Not Started
**Source**: TODO.md Section 5

### Overview

Show tool calls clearly in box format to help users understand LLM's actions.

### Implementation

**ToolCallBox Component**:

```typescript
// src/ui/components/ToolCallBox.tsx (NEW)

import React from 'react';
import { Box, Text } from 'ink';

interface ToolCallBoxProps {
  toolName: string;
  args: any;
  result?: any;
  error?: string;
  duration?: number;
}

export const ToolCallBox: React.FC<ToolCallBoxProps> = ({
  toolName,
  args,
  result,
  error,
  duration,
}) => {
  const statusIcon = error ? '✗' : '✓';
  const statusColor = error ? 'red' : 'green';

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} marginY={1}>
      <Text color={statusColor} bold>
        {statusIcon} {toolName}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>Args:</Text>
        <Text>{JSON.stringify(args, null, 2)}</Text>
      </Box>
      {result && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Result:</Text>
          <Text>{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</Text>
        </Box>
      )}
      {error && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}
      {duration && (
        <Box marginTop={1}>
          <Text dimColor>Duration: {duration}ms</Text>
        </Box>
      )}
    </Box>
  );
};
```

**MessageList Integration**:

```typescript
// src/ui/components/MessageList.tsx (MODIFY)

import { ToolCallBox } from './ToolCallBox.js';

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  return (
    <Box flexDirection="column">
      {messages.map((message, index) => {
        if (message.role === 'assistant' && message.tool_calls) {
          return (
            <Box key={index} flexDirection="column">
              {message.tool_calls.map((toolCall, i) => (
                <ToolCallBox
                  key={i}
                  toolName={toolCall.function.name}
                  args={JSON.parse(toolCall.function.arguments)}
                />
              ))}
            </Box>
          );
        }

        // Normal message rendering
        return <MessageBox key={index} message={message} />;
      })}
    </Box>
  );
};
```

### UI Examples

**read_file Tool**:
```
┌──────────────────────────────────────────────────────────────┐
│ ✓ ReadFile package.json                                      │
├──────────────────────────────────────────────────────────────┤
│ Args:                                                        │
│   file_path: "package.json"                                  │
│                                                              │
│ Duration: 45ms                                               │
└──────────────────────────────────────────────────────────────┘
```

**search_docs_agent Tool**:
```
┌──────────────────────────────────────────────────────────────┐
│ ✓ DocsSearchAgent "TypeScript setup"                        │
├──────────────────────────────────────────────────────────────┤
│ Query: "TypeScript setup method"                            │
│                                                              │
│ Agent Actions:                                               │
│   1. run_bash("find . -name '*typescript*'")                │
│   2. run_bash("cat setup/typescript.md")                    │
│   3. run_bash("grep -r 'tsconfig' docs/")                   │
│                                                              │
│ Result: Found 3 documents                                    │
│   • setup/typescript.md                                      │
│   • guides/typescript-advanced.md                            │
│   • cheatsheets/typescript.md                                │
│                                                              │
│ Duration: 2.3s (3 iterations)                                │
└──────────────────────────────────────────────────────────────┘
```

**Tool failure**:
```
┌──────────────────────────────────────────────────────────────┐
│ ✗ ReadFile non-existent-file.txt                            │
├──────────────────────────────────────────────────────────────┤
│ Args:                                                        │
│   file_path: "non-existent-file.txt"                        │
│                                                              │
│ Error: ENOENT: no such file or directory                    │
│                                                              │
│ Duration: 12ms                                               │
└──────────────────────────────────────────────────────────────┘
```

### Testing Scenarios

- [ ] read_file tool call → box display
- [ ] write_file tool call → box display with args
- [ ] search_docs_agent tool call → agent actions display
- [ ] Tool failure → error display in red
- [ ] Multiple tool calls → multiple boxes

### Completion Criteria

- [ ] Tool calls clearly shown in boxes
- [ ] Arguments and results easily viewable
- [ ] All tests passing

---

## P1-8: Status Bar & Status Command Implementation

**Goal**: Display path, model, context usage at bottom + /status command for system info

**Priority**: P1 (Important)
**Estimated Time**: 1 day
**Dependencies**: None
**Status**: ✅ Completed (2025-11-05 Status Bar | 2025-11-08 /status Command)
**Source**: TODO.md Section 6, BLUEPRINT.md Section 4

### Overview

**Part 1: Status Bar Component (✅ Completed 2025-11-05)**
Fixed status bar at bottom showing current working directory, model info, and context usage.

**Part 2: /status Command (✅ Completed 2025-11-08)**
Slash command to display comprehensive system information including version, session ID, working directory, endpoint URL, and LLM model name.

### Implementation

**StatusBar Component**:

```typescript
// src/ui/components/StatusBar.tsx (NEW)

import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  workingDir: string;
  model: string;
  contextUsage: number; // Percentage (0-100)
  maxTokens?: number;
  currentTokens?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  workingDir,
  model,
  contextUsage,
  maxTokens,
  currentTokens,
}) => {
  const contextColor = contextUsage > 90 ? 'red' : contextUsage > 70 ? 'yellow' : 'green';
  
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Box justifyContent="space-between" width="100%">
        <Box>
          <Text dimColor>📂 {workingDir}</Text>
        </Box>
        <Box>
          <Text dimColor>🤖 {model}</Text>
        </Box>
        <Box>
          <Text color={contextColor}>
            Context: {contextUsage}% ({currentTokens}/{maxTokens} tokens)
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
```

**InteractiveApp Integration**:

```typescript
// src/ui/InteractiveApp.tsx (MODIFY)

export const InteractiveApp: React.FC = () => {
  // ... existing state ...
  const [contextUsage, setContextUsage] = useState(0);

  // Calculate context usage
  useEffect(() => {
    const totalTokens = messages.reduce((sum, msg) => 
      sum + (msg.content?.length || 0) / 4, 0 // Rough estimate
    );
    const usage = (totalTokens / 100000) * 100; // Assuming 100k max
    setContextUsage(Math.min(usage, 100));
  }, [messages]);

  return (
    <Box flexDirection="column" height="100%">
      <Header modelInfo={modelInfo} />
      <Box flexDirection="column" flexGrow={1}>
        <MessageList messages={messages} />
      </Box>
      {todos.length > 0 && <TodoListPanel todos={todos} />}
      <StatusBar 
        workingDir={process.cwd()}
        model={modelInfo.modelId}
        contextUsage={contextUsage}
        maxTokens={100000}
        currentTokens={Math.floor(contextUsage * 1000)}
      />
      <InputBox onSubmit={handleSubmit} disabled={isGenerating} />
    </Box>
  );
};
```

### UI Example

```
┌────────────────────────────────────────────────────────────┐
│ 📂 ~/project/open-cli    🤖 gemini-2.0-flash   Context: 12% (12K/100K tokens) │
└────────────────────────────────────────────────────────────┘
```

**Part 2: /status Command Implementation**:

```typescript
// src/core/slash-command-handler.ts (MODIFIED)

// Status command - show system information
if (trimmedCommand === '/status') {
  const endpoint = configManager.getCurrentEndpoint();
  const model = configManager.getCurrentModel();
  const cwd = process.cwd();

  // Read package.json for version
  let version = 'unknown';
  try {
    const { readFile } = await import('fs/promises');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    version = packageJson.version;
  } catch {
    version = '0.1.0';
  }

  const statusMessage = `
System Status:
  Version:      ${version}
  Session ID:   ${sessionManager.getCurrentSessionId() || 'No active session'}
  Working Dir:  ${cwd}
  Endpoint URL: ${endpoint?.baseUrl || 'Not configured'}
  LLM Model:    ${model?.name || 'Not configured'} (${model?.id || 'N/A'})
  `;

  // ... rest of implementation
}
```

```typescript
// src/core/session-manager.ts (MODIFIED)

export class SessionManager {
  private sessionsDir: string;
  private currentSessionId: string | null = null;

  constructor() {
    this.sessionsDir = SESSIONS_DIR;
    // Generate a new session ID for this runtime instance
    this.currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  setCurrentSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }
}
```

```typescript
// src/ui/hooks/slashCommandProcessor.ts (MODIFIED)

export const SLASH_COMMANDS: CommandMetadata[] = [
  // ... existing commands
  {
    name: '/status',
    description: 'Show system status',
  },
  // ... more commands
];
```

### /status Command Output Example

**Classic CLI Mode**:
```
📊 System Status

  Version:      0.1.0
  Session ID:   session-1699440000000-abc123de
  Working Dir:  /home/user/project/Open-Code-CLI
  Endpoint URL: https://generativelanguage.googleapis.com/v1beta/openai/
  LLM Model:    Gemini 2.0 Flash (gemini-2.0-flash)
```

**Ink UI Mode**:
```
System Status:
  Version:      0.1.0
  Session ID:   session-1699440000000-abc123de
  Working Dir:  /home/user/project/Open-Code-CLI
  Endpoint URL: https://generativelanguage.googleapis.com/v1beta/openai/
  LLM Model:    Gemini 2.0 Flash (gemini-2.0-flash)
```

### Testing Scenarios

**Status Bar Component**:
- [x] Status bar displays at bottom ✅
- [x] Working directory shows correctly ✅
- [x] Model info displays ✅
- [x] Context usage updates in real-time ✅
- [x] Color changes based on usage (green → yellow → red) ✅

**/status Command**:
- [x] Version read from package.json ✅
- [x] Session ID displays unique runtime ID ✅
- [x] Working directory shows current path ✅
- [x] Endpoint URL displays or shows "Not configured" ✅
- [x] Model name and ID display correctly ✅
- [x] Works in both Ink UI and Classic CLI modes ✅
- [x] Autocomplete shows /status suggestion ✅
- [x] Help menus updated with /status ✅
- [x] Async handler integration works ✅

### Completion Criteria

**Status Bar**:
- [x] Status bar always visible at bottom ✅
- [x] Context usage updates in real-time ✅
- [x] All tests passing ✅

**/status Command**:
- [x] Displays all required information ✅
- [x] Works in both UI modes ✅
- [x] Integrated with autocomplete system ✅
- [x] Error handling with fallbacks ✅
- [x] Performance <10ms execution ✅

### Implementation Files

**Status Bar**:
- `src/ui/components/StatusBar.tsx` (NEW)
- `src/ui/components/PlanExecuteApp.tsx` (Modified)

**/status Command**:
- `src/core/slash-command-handler.ts` (Modified - Lines 195-238, 652-681)
- `src/core/session-manager.ts` (Modified - Lines 52-58, 212-224)
- `src/ui/hooks/slashCommandProcessor.ts` (Modified - Lines 50-53)
- `src/ui/components/PlanExecuteApp.tsx` (Modified - Line 414)

### Code Statistics

**Total**: ~330 lines
- Status Bar Component: ~160 lines
- /status Command: ~170 lines

### Performance

**Status Bar**:
- Render: <50ms
- Context calculation: <1ms

**/status Command**:
- Version read: <5ms
- Config read: <1ms
- Total execution: <10ms
- UI render: <100ms

---

## P1-9: ASCII Logo & Welcome Screen

**Goal**: Welcome screen on CLI startup

**Priority**: P1 (Important)
**Estimated Time**: 1 day
**Dependencies**: None
**Status**: Not Started
**Source**: TODO.md Section 7, BLUEPRINT.md Section 1

### Overview

Show welcome screen with ASCII logo on first execution.

### Implementation

**WelcomeScreen Component**:

```typescript
// src/ui/components/WelcomeScreen.tsx (NEW)

import React from 'react';
import { Box, Text } from 'ink';

interface WelcomeScreenProps {
  version: string;
  model: string;
  onContinue: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  version,
  model,
  onContinue,
}) => {
  return (
    <Box flexDirection="column">
      <Box borderStyle="double" borderColor="cyan" paddingX={2} paddingY={1}>
        <Box flexDirection="column">
          <Text color="cyan" bold>
            {`
  ██████╗ ██████╗ ███████╗███╗   ██╗      ██████╗██╗     ██╗
 ██╔═══██╗██╔══██╗██╔════╝████╗  ██║     ██╔════╝██║     ██║
 ██║   ██║██████╔╝█████╗  ██╔██╗ ██║     ██║     ██║     ██║
 ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║     ██║     ██║     ██║
 ╚██████╔╝██║     ███████╗██║ ╚████║     ╚██████╗███████╗██║
  ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝      ╚═════╝╚══════╝╚═╝
            `}
          </Text>
          <Box justifyContent="center" marginTop={1}>
            <Text bold>Offline Enterprise AI-Powered CLI Platform</Text>
          </Box>
        </Box>
      </Box>

      <Box marginTop={2}>
        <Text bold>Welcome to OPEN-CLI! 🚀</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text>Version: <Text color="green">{version}</Text></Text>
        <Text>Model: <Text color="cyan">{model}</Text></Text>
        <Text>Status: <Text color="green">🟢 Connected</Text></Text>
      </Box>

      <Box flexDirection="column" marginTop={2}>
        <Text bold>Tips for getting started:</Text>
        <Text>1. Ask questions or request tasks in natural language</Text>
        <Text>2. Use @path/to/file to reference specific files</Text>
        <Text>3. LLM can automatically read, write, and search files</Text>
        <Text>4. Create ~/.open-cli/docs/ for your knowledge base</Text>
        <Text>5. Type /help for available commands</Text>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Press Enter to continue...</Text>
      </Box>
    </Box>
  );
};
```

**InteractiveApp Integration**:

```typescript
// src/ui/InteractiveApp.tsx (MODIFY)

export const InteractiveApp: React.FC = () => {
  const [showWelcome, setShowWelcome] = useState(true);
  
  if (showWelcome) {
    return (
      <WelcomeScreen
        version="0.2.0"
        model={modelInfo.modelId}
        onContinue={() => setShowWelcome(false)}
      />
    );
  }

  return (
    // ... normal UI ...
  );
};
```

### UI Example

```
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║   ██████╗ ██████╗ ███████╗███╗   ██╗      ██████╗██╗     ██╗     ║
║  ██╔═══██╗██╔══██╗██╔════╝████╗  ██║     ██╔════╝██║     ██║     ║
║  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║     ██║     ██║     ██║     ║
║  ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║     ██║     ██║     ██║     ║
║  ╚██████╔╝██║     ███████╗██║ ╚████║     ╚██████╗███████╗██║     ║
║   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝      ╚═════╝╚══════╝╚═╝     ║
║                                                                    ║
║            Offline Enterprise AI-Powered CLI Platform             ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝

Welcome to OPEN-CLI! 🚀

Version: 0.2.0
Model: gemini-2.0-flash
Status: 🟢 Connected

Tips for getting started:
1. Ask questions or request tasks in natural language
2. Use @path/to/file to reference specific files
3. LLM can automatically read, write, and search files
4. Create ~/.open-cli/docs/ for your knowledge base
5. Type /help for available commands

Press Enter to continue...
```

### Testing Scenarios

- [ ] First execution → welcome screen shows
- [ ] Logo displays correctly
- [ ] Tips visible
- [ ] Session recovery → welcome screen doesn't show

### Completion Criteria

- [ ] Welcome screen on CLI startup
- [ ] Logo and tips clearly visible
- [ ] All tests passing

---

# PRIORITY 2: MEDIUM FEATURES

---

## P2-1: Tips/Help Section Enhancement

**Goal**: Enhanced /help command with interactive tutorial

**Priority**: P2 (Medium)
**Estimated Time**: 1 day
**Dependencies**: None
**Status**: Not Started
**Source**: TODO.md Section 8

### Overview

Strengthen /help command and add interactive tutorial.

### Implementation Checklist

- [ ] Enhanced /help command with categorized commands
- [ ] Interactive tutorial for beginners
- [ ] Usage examples for each command
- [ ] Quick reference guide
- [ ] Tips and tricks section

### Estimated Time: 1 day

---

## P2-2: Input Hints & Autocomplete

**Goal**: @path/to/file autocomplete and / command autocomplete

**Priority**: P2 (Medium)
**Estimated Time**: 2 days
**Dependencies**: None
**Status**: ✅ Completed
**Source**: TODO.md Section 9

### Overview

Add intelligent autocomplete for file paths and commands.

### Implementation Checklist

- [x] @path/to/file autocomplete with file system browsing ✅ **Completed: 2025-11-05**
- [x] / command autocomplete with available commands ✅ **Completed: 2025-11-08**
- [x] Input hint display (argument hints for commands) ✅ **Completed: 2025-11-08**
- [x] Tab completion support ✅ **Completed: 2025-11-05** (Tab to quick-select first file)
- [x] Fuzzy matching for suggestions ✅ **Completed: 2025-11-05** (Filter-based matching in useFileList)

### Completed Features (2025-11-05)

**@ File Inclusion Feature**:
- ✅ @ trigger detection in input (atFileProcessor.ts)
- ✅ File browser UI component (FileBrowser.tsx)
- ✅ File list pre-loading and filtering (useFileList.ts)
- ✅ Interactive file selection with arrow keys
- ✅ Tab key for quick selection (first file)
- ✅ ESC key to cancel
- ✅ Real-time filtering as user types after @
- ✅ @ 접두사 자동 제거 in file-tools (read_file, write_file)
- ✅ File paths inserted as @path1 @path2 format

**Implementation Details**:
- FileBrowser component with React Ink UI
- Pre-loaded file list cache for instant filtering
- Filters out node_modules, .git, hidden files
- Shows up to 100 files with scrolling
- Integrated into InteractiveApp.tsx

### Slash Command Autocomplete (2025-11-08)

**/ Command Autocomplete Feature**:
- ✅ Slash command processor with detection and validation
- ✅ CommandBrowser UI component for autocomplete display
- ✅ Up to 10 commands with aligned descriptions (25-char column)
- ✅ Keyboard navigation (Tab, Enter, Arrow keys, ESC)
- ✅ Argument hints for parameterized commands (/mode, /save)
- ✅ Command alias support (/exit and /quit as aliases)
- ✅ Smart submission (valid commands can be submitted when browser open)
- ✅ Input clearing after command execution
- ✅ Integrated with PlanExecuteApp
- ✅ Centralized command execution in core/slash-command-handler.ts

**Implementation Details**:
- **slashCommandProcessor.ts**: Detection, filtering, validation logic
- **CommandBrowser.tsx**: Autocomplete UI with SelectInput
- **slash-command-handler.ts**: Centralized command execution for reusability
- Real-time filtering as user types after /
- "//" not recognized as command (edge case handled)
- Tab key inserts command for argument input
- Enter key executes command immediately

### Estimated Time: Completed (2 days total)

---

# PRIORITY 3: LOW PRIORITY FEATURES

---

## P3-1: Message Type Styling Enhancement

**Goal**: Enhanced styling for different message types

**Priority**: P3 (Low)
**Estimated Time**: 1 day
**Dependencies**: None
**Status**: Not Started
**Source**: TODO.md Section 10

### Overview

Improve visual distinction between message types.

### Implementation Checklist

- [ ] User message styling (color, icon, border)
- [ ] Assistant message styling (color, icon, border)
- [ ] System message styling (color, icon, border)
- [ ] Tool message styling (color, icon, border)
- [ ] Error message styling (color, icon, border)
- [ ] Code block syntax highlighting

### Estimated Time: 1 day

---

# SUMMARY & COMPLETION TRACKING

---

## Total Feature Count

**Priority 0 (Critical)**: 2 features
- P0-1: GitHub Release Auto-Update System (3-5 days)
- P0-2: Plan-and-Execute Architecture (5-7 days)

**Priority 1 (Important)**: 9 features  
- P1-1: Model Compatibility Layer (1-2 hours or 3-5 days)
- P1-2: ESC LLM Interrupt (1 day)
- P1-3: YOLO Mode vs Ask Mode (1-2 days)
- P1-4: File Edit Tool Improvements (1 day)
- P1-5: Config Init Improvements (2 days)
- P1-6: TODO Auto-Save (1 day)
- P1-7: Tool Usage UI (1 day)
- P1-8: Status Bar & Status Command (1 day) ✅ COMPLETED
- P1-9: Welcome Screen (1 day)

**Priority 2 (Medium)**: 2 features (1 partially completed)
- P2-1: Tips/Help Section (1 day)
- P2-2: Input Hints & Autocomplete (2 days) - 🚧 Partially Completed: @ file inclusion done, command autocomplete remaining

**Priority 3 (Low)**: 1 feature
- P3-1: Message Type Styling (1 day)

**Total**: 14 major features

**Estimated Total Time**: 8-12 weeks

---

## Implementation Order Recommendation

### Week 1-2: Critical Foundation (P0)
1. Model Compatibility Layer (quick win, 1-2 hours)
2. GitHub Auto-Update System (3-5 days)
3. Plan-and-Execute Architecture Phase 1-2 (5 days)

### Week 3-4: Plan-and-Execute Completion & Essential Features (P0 + P1)
1. Plan-and-Execute Architecture Phase 3-5 (2-3 days)
2. Docs Search Agent Tool (already in P0-2) (1 day)
3. ESC LLM Interrupt (1 day)
4. YOLO Mode vs Ask Mode (1-2 days)

### Week 5-6: Enhanced Features (P1)
1. File Edit Tool Improvements (1 day)
2. Config Init Improvements (2 days)
3. TODO Auto-Save (1 day)
4. Tool Usage UI (1 day)

### Week 7-8: UI Polish (P1)
1. Status Bar (1 day)
2. Welcome Screen (1 day)
3. Tips/Help Section (P2) (1 day)
4. Input Hints & Autocomplete (P2) (2 days)

### Week 9-10: Final Polish (P2 + P3)
1. Message Type Styling (P3) (1 day)
2. Testing & bug fixes (4-5 days)
3. Documentation updates (2-3 days)

---

## Testing Strategy

### Unit Tests
- [ ] All core modules (LLMClient, PlanningLLM, TodoExecutor, etc.)
- [ ] All tools (file operations, docs search, etc.)
- [ ] ConfigManager operations
- [ ] SessionManager operations

### Integration Tests
- [ ] Plan-and-Execute full workflow
- [ ] Tool execution with LLM
- [ ] Session save and recovery
- [ ] Auto-update mechanism

### End-to-End Tests
- [ ] Complete user workflows
- [ ] Error scenarios
- [ ] Edge cases
- [ ] Performance benchmarks

---

## Documentation Requirements

### User Documentation
- [ ] Update README.md with all new features
- [ ] Create USER_GUIDE.md for comprehensive usage
- [ ] Add TROUBLESHOOTING.md for common issues
- [ ] Update CHANGELOG.md for each release

### Developer Documentation
- [ ] Update PROJECT_OVERVIEW.md with architecture changes
- [ ] Document all new APIs and interfaces
- [ ] Add inline code comments (JSDoc)
- [ ] Create CONTRIBUTING.md for contributors

---

## Final Notes

This TODO_ALL.md document represents the complete implementation roadmap for OPEN-CLI Phase 2.5 and beyond. Each feature has:

1. Clear goals and objectives
2. Detailed implementation specifications
3. Code examples and architecture diagrams
4. Testing scenarios and acceptance criteria
5. Estimated time and dependencies

**Total Lines**: 3600+ (exceeding the 3000+ requirement)

**Last Updated**: 2025-11-05
**Version**: 1.0.0
**Status**: Complete

---

**End of TODO_ALL.md**

## P0-3: Claude Code Agent Loop Implementation 🆕

**목표**: gather context → take action → verify work → repeat 에이전트 루프 구현

**Priority**: P0 (Critical)
**Estimated Time**: 7-10 days
**Dependencies**: P0-2 (Plan-and-Execute)
**Status**: Not Started

### Overview

Claude Code의 핵심 에이전트 루프를 완벽하게 구현합니다. 이는 단순한 순차 실행이 아닌,
각 단계마다 명시적인 검증과 피드백을 통해 자율적으로 작업을 수행하는 진정한 에이전트 시스템입니다.

### Architecture

```
┌─────────────────────────────────────────────────┐
│              Agent Loop Controller               │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ 1. Gather Context                        │   │
│  │   - File system exploration (grep, tail) │   │
│  │   - OPEN_CLI.md project config load      │   │
│  │   - Previous loop feedback               │   │
│  └──────────────────────────────────────────┘   │
│                      ↓                           │
│  ┌──────────────────────────────────────────┐   │
│  │ 2. Take Action                           │   │
│  │   - Tool execution                       │   │
│  │   - Code generation                      │   │
│  │   - API calls                            │   │
│  └──────────────────────────────────────────┘   │
│                      ↓                           │
│  ┌──────────────────────────────────────────┐   │
│  │ 3. Verify Work                           │   │
│  │   - Rule-based verification              │   │
│  │   - Visual feedback (screenshots)        │   │
│  │   - LLM-as-Judge evaluation              │   │
│  └──────────────────────────────────────────┘   │
│                      ↓                           │
│  ┌──────────────────────────────────────────┐   │
│  │ 4. Repeat Decision                       │   │
│  │   - Success → Next TODO                  │   │
│  │   - Failure → Retry with feedback        │   │
│  │   - Error → Error recovery strategy      │   │
│  └──────────────────────────────────────────┘   │
│                      ↓                           │
│              [Loop or Complete]                  │
└─────────────────────────────────────────────────┘
```

### Phase 1: Agent Loop Controller (3 days)

**Files to Create**:
- `src/core/agent-loop.ts` (NEW)
- `src/core/context-gatherer.ts` (NEW)
- `src/core/action-executor.ts` (NEW)
- `src/core/work-verifier.ts` (NEW)

**Core Implementation**:

```typescript
// src/core/agent-loop.ts

export interface LoopContext {
  currentTodo: TodoItem;
  previousResults: ExecutionResult[];
  fileSystemContext: FileSystemContext;
  projectConfig: ProjectConfig;
  feedback: VerificationFeedback[];
}

export interface ExecutionResult {
  action: string;
  toolName?: string;
  output: any;
  success: boolean;
  error?: Error;
  timestamp: string;
}

export interface VerificationFeedback {
  rule: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
  suggestions?: string[];
}

export class AgentLoopController {
  private contextGatherer: ContextGatherer;
  private actionExecutor: ActionExecutor;
  private workVerifier: WorkVerifier;
  private maxIterations: number = 10;
  private currentIteration: number = 0;

  constructor(
    private llmClient: LLMClient,
    private toolRegistry: ToolRegistry,
    private config: Config
  ) {
    this.contextGatherer = new ContextGatherer();
    this.actionExecutor = new ActionExecutor(llmClient, toolRegistry);
    this.workVerifier = new WorkVerifier();
  }

  async executeTodoWithLoop(
    todo: TodoItem,
    messages: Message[],
    onProgress?: (update: ProgressUpdate) => void
  ): Promise<TodoExecutionResult> {
    let context = await this.gatherInitialContext(todo);

    while (this.currentIteration < this.maxIterations) {
      // 1. Gather Context
      context = await this.contextGatherer.gather({
        ...context,
        iteration: this.currentIteration,
        previousFeedback: context.feedback
      });

      // 2. Take Action
      const action = await this.actionExecutor.execute(
        context,
        messages
      );

      // 3. Verify Work
      const verification = await this.workVerifier.verify(
        action,
        todo,
        context
      );

      // 4. Decide to Repeat
      if (verification.isComplete) {
        return {
          success: true,
          result: action.output,
          iterations: this.currentIteration + 1,
          verificationReport: verification
        };
      }

      // Add feedback to context for next iteration
      context.feedback.push(...verification.feedback);
      this.currentIteration++;

      // Notify progress
      onProgress?.({
        iteration: this.currentIteration,
        action: action.action,
        verification: verification,
        willRetry: !verification.isComplete
      });
    }

    // Max iterations reached
    return {
      success: false,
      error: 'Max iterations reached without completing task',
      iterations: this.maxIterations,
      lastVerification: context.feedback[context.feedback.length - 1]
    };
  }
}
```

### Phase 2: Context Gathering System (2 days)

**Context Gatherer Implementation**:

```typescript
// src/core/context-gatherer.ts

export class ContextGatherer {
  private fileExplorer: FileExplorer;
  private configLoader: ConfigLoader;

  async gather(request: ContextRequest): Promise<LoopContext> {
    const context: LoopContext = {
      currentTodo: request.todo,
      previousResults: request.previousResults || [],
      fileSystemContext: await this.exploreFileSystem(request),
      projectConfig: await this.loadProjectConfig(),
      feedback: request.previousFeedback || []
    };

    // 1. Active file system exploration
    if (request.todo.requiresDocsSearch) {
      const relevantFiles = await this.searchRelevantFiles(
        request.todo.title
      );
      context.fileSystemContext.relevantFiles = relevantFiles;
    }

    // 2. Load OPEN_CLI.md if exists
    const projectConfigPath = path.join(process.cwd(), 'OPEN_CLI.md');
    if (fs.existsSync(projectConfigPath)) {
      context.projectConfig = await this.loadProjectSpecificConfig(
        projectConfigPath
      );
    }

    // 3. Analyze previous failures
    if (context.feedback.length > 0) {
      const failureAnalysis = await this.analyzeFailures(
        context.feedback
      );
      context.failureAnalysis = failureAnalysis;
    }

    return context;
  }

  private async exploreFileSystem(
    request: ContextRequest
  ): Promise<FileSystemContext> {
    // Use grep, find, ls to explore
    const commands = [
      `find . -type f -name "*.ts" -o -name "*.js" | head -20`,
      `grep -r "${request.todo.title}" --include="*.md" | head -10`,
      `ls -la`
    ];

    const explorationResults = await Promise.all(
      commands.map(cmd => this.executeCommand(cmd))
    );

    return {
      structure: explorationResults[0],
      relevantMentions: explorationResults[1],
      currentDirectory: explorationResults[2]
    };
  }
}
```

### Phase 3: Action Execution Layer (2 days)

**Action Executor with Planning**:

```typescript
// src/core/action-executor.ts

export class ActionExecutor {
  constructor(
    private llmClient: LLMClient,
    private toolRegistry: ToolRegistry
  ) {}

  async execute(
    context: LoopContext,
    messages: Message[]
  ): Promise<ExecutionResult> {
    // 1. Generate action plan based on context
    const actionPlan = await this.generateActionPlan(context, messages);

    // 2. Validate action safety
    const validation = await this.validateAction(actionPlan);
    if (!validation.safe) {
      return {
        action: actionPlan.description,
        success: false,
        error: new Error(`Action blocked: ${validation.reason}`),
        timestamp: new Date().toISOString()
      };
    }

    // 3. Execute the action
    try {
      const result = await this.executeAction(actionPlan);

      return {
        action: actionPlan.description,
        toolName: actionPlan.toolName,
        output: result,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        action: actionPlan.description,
        success: false,
        error: error as Error,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async generateActionPlan(
    context: LoopContext,
    messages: Message[]
  ): Promise<ActionPlan> {
    const systemPrompt = this.buildActionSystemPrompt(context);
    const response = await this.llmClient.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
        {
          role: 'user',
          content: `Based on the context and previous feedback,
                    what specific action should be taken next?
                    Current TODO: ${context.currentTodo.title}
                    Previous failures: ${context.feedback.length}`
        }
      ]
    });

    return this.parseActionPlan(response);
  }
}
```

### Phase 4: Work Verification System (2-3 days)

**Three-Mode Verifier**:

```typescript
// src/core/work-verifier.ts

export class WorkVerifier {
  private ruleEngine: RuleEngine;
  private visualVerifier: VisualVerifier;
  private llmJudge: LLMJudge;

  async verify(
    action: ExecutionResult,
    todo: TodoItem,
    context: LoopContext
  ): Promise<VerificationResult> {
    const verifications: VerificationFeedback[] = [];

    // 1. Rule-based verification (strongest)
    if (todo.verificationRules) {
      const ruleResults = await this.ruleEngine.verify(
        action,
        todo.verificationRules
      );
      verifications.push(...ruleResults);
    }

    // 2. Visual verification (for UI tasks)
    if (todo.requiresVisualVerification) {
      const visualResults = await this.visualVerifier.verify(
        action,
        todo.visualCriteria
      );
      verifications.push(...visualResults);
    }

    // 3. LLM-as-Judge (for fuzzy criteria)
    if (todo.fuzzyCriteria) {
      const llmResults = await this.llmJudge.evaluate(
        action,
        todo.fuzzyCriteria,
        context
      );
      verifications.push(...llmResults);
    }

    // Determine if work is complete
    const failures = verifications.filter(v => !v.passed);
    const isComplete = failures.length === 0;

    return {
      isComplete,
      feedback: verifications,
      summary: this.generateSummary(verifications),
      nextStepSuggestions: isComplete ? [] : this.suggestNextSteps(failures)
    };
  }
}

// Rule Engine for deterministic verification
export class RuleEngine {
  async verify(
    action: ExecutionResult,
    rules: VerificationRule[]
  ): Promise<VerificationFeedback[]> {
    const feedback: VerificationFeedback[] = [];

    for (const rule of rules) {
      let passed = false;
      let message = '';

      switch (rule.type) {
        case 'lint':
          const lintResult = await this.runLint(action.output);
          passed = lintResult.errorCount === 0;
          message = passed
            ? 'No lint errors'
            : `${lintResult.errorCount} lint errors found`;
          break;

        case 'test':
          const testResult = await this.runTests(rule.testPattern);
          passed = testResult.failed === 0;
          message = `${testResult.passed} tests passed, ${testResult.failed} failed`;
          break;

        case 'file_exists':
          passed = fs.existsSync(rule.filePath);
          message = passed
            ? `File exists: ${rule.filePath}`
            : `File not found: ${rule.filePath}`;
          break;

        case 'output_contains':
          passed = action.output?.includes(rule.expectedContent);
          message = passed
            ? `Output contains expected content`
            : `Expected content not found in output`;
          break;
      }

      feedback.push({
        rule: rule.name,
        passed,
        message,
        severity: passed ? 'info' : 'error',
        suggestions: passed ? [] : rule.failureSuggestions
      });
    }

    return feedback;
  }
}
```

### Acceptance Criteria

- [ ] Agent loop executes gather → action → verify → repeat
- [ ] Context gathering includes file system exploration
- [ ] OPEN_CLI.md automatically loaded when present
- [ ] Three verification modes working (rules, visual, LLM)
- [ ] Loop terminates on success or max iterations
- [ ] Feedback from failed iterations used in next attempt
- [ ] Progress updates sent to UI in real-time
- [ ] All tests passing

---

## P0-4: Multi-Layered Execution Architecture 🆕

**목표**: 태스크 복잡도에 따라 동적으로 확장되는 4계층 실행 아키텍처 구현

**Priority**: P0 (Critical)
**Estimated Time**: 10-12 days
**Dependencies**: P0-3 (Agent Loop)
**Status**: Not Started

### Overview

Claude Code의 정교한 다계층 실행 시스템을 구현합니다:
1. **표준 도구 사용**: 간단한 API 호출
2. **Agent SDK**: 동적 코드 생성 및 셸 접근
3. **Task/SubAgent**: 병렬 다중 에이전트 처리
4. **Agent Skills**: 프롬프트 기반 메타-도구

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Execution Layer Manager                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Complexity Analyzer                                         │
│       ↓                                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ Layer 1 │  │ Layer 2 │  │ Layer 3 │  │ Layer 4 │       │
│  │Standard │  │   SDK   │  │SubAgent │  │ Skills  │       │
│  │  Tools  │  │ Dynamic │  │ Parallel│  │  Meta   │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                              │
│  Selection based on:                                         │
│  • Task complexity                                           │
│  • Required parallelism                                      │
│  • Dynamic generation needs                                  │
│  • Workflow complexity                                       │
└─────────────────────────────────────────────────────────────┘
```

### Phase 1: Standard Tool Layer (2 days)

**Implementation**:

```typescript
// src/execution/standard-tools.ts

export class StandardToolLayer implements ExecutionLayer {
  private tools: Map<string, ToolDefinition> = new Map();

  async canHandle(task: Task): Promise<boolean> {
    // Simple, structured API calls
    return task.complexity === 'simple' &&
           task.requiresTools.every(t => this.tools.has(t));
  }

  async execute(task: Task): Promise<ExecutionResult> {
    const tool = this.tools.get(task.toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${task.toolName}`);
    }

    // Validate parameters
    const validation = this.validateParameters(
      task.parameters,
      tool.schema
    );

    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors,
        layer: 'standard-tools'
      };
    }

    // Execute tool
    try {
      const result = await tool.execute(task.parameters);
      return {
        success: true,
        output: result,
        layer: 'standard-tools',
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        layer: 'standard-tools'
      };
    }
  }
}
```

### Phase 2: Dynamic SDK Layer (3 days)

**Dynamic Code Generation**:

```typescript
// src/execution/sdk-layer.ts

export class SDKLayer implements ExecutionLayer {
  private bashExecutor: BashExecutor;
  private codeGenerator: CodeGenerator;
  private sandboxManager: SandboxManager;

  async canHandle(task: Task): Promise<boolean> {
    return task.requiresDynamicCode ||
           task.requiresSystemAccess ||
           task.complexity === 'moderate';
  }

  async execute(task: Task): Promise<ExecutionResult> {
    if (task.requiresDynamicCode) {
      return await this.executeDynamicCode(task);
    }

    if (task.requiresSystemAccess) {
      return await this.executeBashCommands(task);
    }

    return await this.executeHybrid(task);
  }

  private async executeDynamicCode(task: Task): Promise<ExecutionResult> {
    // 1. Generate code based on task
    const code = await this.codeGenerator.generate({
      task: task.description,
      language: task.targetLanguage || 'typescript',
      requirements: task.requirements,
      context: task.context
    });

    // 2. Create sandbox environment
    const sandbox = await this.sandboxManager.create({
      language: task.targetLanguage,
      timeout: task.timeout || 30000,
      memoryLimit: task.memoryLimit || '512MB'
    });

    // 3. Execute in sandbox
    try {
      const result = await sandbox.execute(code);

      // 4. Validate output
      const validation = await this.validateOutput(
        result,
        task.expectedOutputSchema
      );

      return {
        success: validation.valid,
        output: result.output,
        generatedCode: code,
        layer: 'sdk-dynamic',
        sandbox: sandbox.id,
        logs: result.logs
      };
    } finally {
      await sandbox.cleanup();
    }
  }

  private async executeBashCommands(task: Task): Promise<ExecutionResult> {
    const commands = task.commands ||
                    await this.generateBashCommands(task);

    const results = [];
    for (const command of commands) {
      // Safety check
      if (!this.isSafeCommand(command)) {
        return {
          success: false,
          error: `Unsafe command blocked: ${command}`,
          layer: 'sdk-bash'
        };
      }

      const result = await this.bashExecutor.execute(command);
      results.push(result);

      if (!result.success) {
        break; // Stop on first failure
      }
    }

    return {
      success: results.every(r => r.success),
      output: results,
      layer: 'sdk-bash',
      commands: commands
    };
  }
}
```

### Phase 3: SubAgent Parallel Architecture (4 days)

**Task Tool and SubAgent System**:

```typescript
// src/execution/subagent-layer.ts

export interface SubAgentTask {
  id: string;
  description: string;
  assignedAgent: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

export class SubAgentLayer implements ExecutionLayer {
  private taskQueue: TaskQueue;
  private agentPool: AgentPool;
  private resultSynthesizer: ResultSynthesizer;

  async canHandle(task: Task): Promise<boolean> {
    return task.complexity === 'complex' ||
           task.requiresParallelism ||
           task.subtasks?.length > 3;
  }

  async execute(task: Task): Promise<ExecutionResult> {
    // 1. Decompose into subtasks
    const subtasks = await this.decomposeTask(task);

    // 2. Create execution plan with dependencies
    const executionPlan = this.createExecutionPlan(subtasks);

    // 3. Initialize agent pool
    const agents = await this.agentPool.initialize({
      count: Math.min(subtasks.length, this.config.maxAgents || 5),
      model: task.preferredModel || 'default',
      isolated: true // Each agent gets isolated context
    });

    // 4. Execute in parallel with dependency management
    const results = await this.executeParallel(
      executionPlan,
      agents
    );

    // 5. Synthesize results
    const synthesized = await this.resultSynthesizer.synthesize({
      task: task,
      subtaskResults: results,
      synthesisStrategy: task.synthesisStrategy || 'intelligent-merge'
    });

    return {
      success: synthesized.success,
      output: synthesized.output,
      layer: 'subagent',
      subtasks: results.length,
      parallelism: agents.length,
      executionPlan: executionPlan
    };
  }

  private async decomposeTask(task: Task): Promise<SubAgentTask[]> {
    // Use planning LLM to decompose
    const decomposition = await this.planningLLM.decompose({
      task: task.description,
      constraints: task.constraints,
      suggestedDecomposition: task.subtasks
    });

    return decomposition.subtasks.map((st, idx) => ({
      id: `subtask-${idx}`,
      description: st.description,
      assignedAgent: '',
      dependencies: st.dependencies || [],
      status: 'pending' as const
    }));
  }

  private async executeParallel(
    plan: ExecutionPlan,
    agents: Agent[]
  ): Promise<SubTaskResult[]> {
    const results: SubTaskResult[] = [];
    const running = new Map<string, Promise<SubTaskResult>>();

    // Process tasks in dependency order
    for (const batch of plan.executionBatches) {
      const batchPromises = batch.map(async (subtask) => {
        // Wait for dependencies
        await Promise.all(
          subtask.dependencies.map(dep => running.get(dep))
        );

        // Assign to available agent
        const agent = await this.agentPool.getAvailable();

        // Execute subtask
        const promise = this.executeSubtask(subtask, agent);
        running.set(subtask.id, promise);

        const result = await promise;
        results.push(result);

        // Release agent back to pool
        this.agentPool.release(agent);

        return result;
      });

      await Promise.all(batchPromises);
    }

    return results;
  }
}

// Result Synthesizer
export class ResultSynthesizer {
  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const { subtaskResults, synthesisStrategy } = request;

    switch (synthesisStrategy) {
      case 'simple-merge':
        return this.simpleMerge(subtaskResults);

      case 'intelligent-merge':
        return await this.intelligentMerge(subtaskResults, request.task);

      case 'llm-synthesis':
        return await this.llmSynthesis(subtaskResults, request.task);

      default:
        return this.simpleMerge(subtaskResults);
    }
  }

  private async intelligentMerge(
    results: SubTaskResult[],
    originalTask: Task
  ): Promise<SynthesisResult> {
    // 1. Detect conflicts
    const conflicts = this.detectConflicts(results);

    // 2. Resolve conflicts
    const resolved = await this.resolveConflicts(conflicts);

    // 3. Merge non-conflicting results
    const merged = this.mergeResults(results, resolved);

    // 4. Validate against original task
    const validation = await this.validateSynthesis(
      merged,
      originalTask
    );

    return {
      success: validation.valid,
      output: merged,
      conflicts: conflicts.length,
      resolutionStrategy: 'intelligent',
      validation: validation
    };
  }
}
```

### Phase 4: Agent Skills Meta-Layer (3 days)

**Prompt-Based Meta-Tools**:

```typescript
// src/execution/skills-layer.ts

export interface AgentSkill {
  name: string;
  description: string;
  promptExpansion: string;
  requiredTools?: string[];
  modelOverride?: string;
  contextModifications?: ContextModification[];
}

export class SkillsLayer implements ExecutionLayer {
  private skills: Map<string, AgentSkill> = new Map();
  private skillLoader: SkillLoader;

  async canHandle(task: Task): Promise<boolean> {
    // Skills are for complex workflows that need behavior modification
    return task.requiresSkill ||
           task.workflowComplexity === 'high' ||
           task.requiresBehaviorChange;
  }

  async execute(task: Task): Promise<ExecutionResult> {
    // 1. Discover appropriate skill
    const skill = await this.discoverSkill(task);

    if (!skill) {
      return {
        success: false,
        error: 'No appropriate skill found for task',
        layer: 'skills'
      };
    }

    // 2. Load skill definition
    const skillDef = await this.skillLoader.load(skill.name);

    // 3. Modify execution context
    const modifiedContext = await this.applySkill(
      task.context,
      skillDef
    );

    // 4. Execute with modified context
    // Note: Skill doesn't execute directly, it modifies behavior
    const executor = new EnhancedExecutor(modifiedContext);
    const result = await executor.execute(task);

    return {
      success: result.success,
      output: result.output,
      layer: 'skills',
      skillUsed: skill.name,
      contextModifications: skillDef.contextModifications
    };
  }

  private async discoverSkill(task: Task): Promise<AgentSkill | null> {
    // Use LLM to match task intent with available skills
    const skillDescriptions = Array.from(this.skills.values())
      .map(s => `${s.name}: ${s.description}`);

    const match = await this.llm.complete({
      messages: [{
        role: 'system',
        content: `Available skills:\n${skillDescriptions.join('\n')}`
      }, {
        role: 'user',
        content: `Which skill best matches this task: ${task.description}`
      }]
    });

    return this.skills.get(match.skillName);
  }

  private async applySkill(
    context: ExecutionContext,
    skill: AgentSkill
  ): Promise<ExecutionContext> {
    const modified = { ...context };

    // 1. Expand prompt with skill instructions
    modified.systemPrompt = `${context.systemPrompt}\n\n${skill.promptExpansion}`;

    // 2. Modify available tools
    if (skill.requiredTools) {
      modified.availableTools = [
        ...context.availableTools,
        ...skill.requiredTools
      ];
    }

    // 3. Override model if specified
    if (skill.modelOverride) {
      modified.model = skill.modelOverride;
    }

    // 4. Apply context modifications
    for (const mod of skill.contextModifications || []) {
      switch (mod.type) {
        case 'add-instruction':
          modified.additionalInstructions.push(mod.value);
          break;
        case 'set-parameter':
          modified.parameters[mod.key] = mod.value;
          break;
        case 'enable-feature':
          modified.features[mod.feature] = true;
          break;
      }
    }

    return modified;
  }
}
```

### Integration: Execution Layer Manager

```typescript
// src/execution/layer-manager.ts

export class ExecutionLayerManager {
  private layers: ExecutionLayer[] = [
    new StandardToolLayer(),
    new SDKLayer(),
    new SubAgentLayer(),
    new SkillsLayer()
  ];

  async execute(task: Task): Promise<ExecutionResult> {
    // 1. Analyze task complexity
    const analysis = await this.analyzeTask(task);

    // 2. Select appropriate layer
    for (const layer of this.layers) {
      if (await layer.canHandle(task)) {
        console.log(`Executing task with ${layer.name} layer`);

        // 3. Execute with monitoring
        const result = await this.executeWithMonitoring(
          layer,
          task
        );

        // 4. Record metrics
        await this.recordMetrics({
          task: task.id,
          layer: layer.name,
          success: result.success,
          executionTime: result.executionTime,
          complexity: analysis.complexity
        });

        return result;
      }
    }

    throw new Error('No suitable execution layer found for task');
  }

  private async analyzeTask(task: Task): Promise<TaskAnalysis> {
    return {
      complexity: this.calculateComplexity(task),
      estimatedTime: this.estimateTime(task),
      requiredCapabilities: this.identifyCapabilities(task),
      recommendedLayer: this.recommendLayer(task)
    };
  }
}
```

### Acceptance Criteria

- [ ] All 4 execution layers implemented and functional
- [ ] Dynamic layer selection based on task complexity
- [ ] SubAgent system supports true parallel execution
- [ ] Skills system can modify agent behavior dynamically
- [ ] Proper isolation between SubAgents
- [ ] Result synthesis handles conflicts intelligently
- [ ] Performance metrics collected for each layer
- [ ] Safety checks in place for bash/code execution
- [ ] All tests passing

---

## P0-5: Internal Monologue and Scratchpad System 🆕

**목표**: 확장된 사고(Extended Thinking)와 외부 스크래치패드를 통한 계획 수립

**Priority**: P0 (Critical)
**Estimated Time**: 5-6 days
**Dependencies**: P0-2 (Plan-and-Execute)
**Status**: Not Started

### Overview

Claude의 내부 독백과 스크래치패드 시스템을 구현하여, 복잡한 작업을 체계적으로 분해하고
상태를 유지하며 진행할 수 있도록 합니다.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│            Thinking & Planning System                │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │     Internal Monologue (Hidden)              │   │
│  │  - Extended thinking mode                    │   │
│  │  - Question decomposition                    │   │
│  │  - Self-questioning & evaluation             │   │
│  └──────────────────────────────────────────────┘   │
│                      ↓                               │
│  ┌──────────────────────────────────────────────┐   │
│  │     External Scratchpad (Visible)            │   │
│  │  - Markdown TODO lists                       │   │
│  │  - Progress tracking                         │   │
│  │  - State persistence                         │   │
│  └──────────────────────────────────────────────┘   │
│                      ↓                               │
│  ┌──────────────────────────────────────────────┐   │
│  │     Project Config (OPEN_CLI.md)             │   │
│  │  - Project-specific instructions             │   │
│  │  - Custom commands                           │   │
│  │  - Style guides                              │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Phase 1: Internal Monologue System (2 days)

```typescript
// src/core/internal-monologue.ts

export interface ThinkingSession {
  id: string;
  thoughts: Thought[];
  questions: Question[];
  evaluations: Evaluation[];
  finalPlan: Plan;
  duration: number;
  tokenCount: number;
}

export class InternalMonologue {
  private thinkingMode: 'standard' | 'extended' | 'deep';
  private maxThinkingTokens: number = 4000;

  async think(
    task: string,
    context: Context
  ): Promise<ThinkingSession> {
    const session: ThinkingSession = {
      id: generateId(),
      thoughts: [],
      questions: [],
      evaluations: [],
      finalPlan: null,
      duration: 0,
      tokenCount: 0
    };

    const startTime = Date.now();

    // 1. Initial analysis
    const analysis = await this.analyzeTask(task, context);
    session.thoughts.push(analysis);

    // 2. Generate questions (Question Decomposition)
    const questions = await this.generateQuestions(analysis);
    session.questions = questions;

    // 3. Answer each question in separate context
    for (const question of questions) {
      const answer = await this.answerQuestion(
        question,
        context,
        session.thoughts
      );
      session.thoughts.push(answer);
    }

    // 4. Evaluate approach options
    const options = await this.generateOptions(session.thoughts);
    for (const option of options) {
      const evaluation = await this.evaluateOption(option, context);
      session.evaluations.push(evaluation);
    }

    // 5. Synthesize final plan
    session.finalPlan = await this.synthesizePlan(
      session.thoughts,
      session.evaluations
    );

    session.duration = Date.now() - startTime;
    session.tokenCount = this.countTokens(session);

    return session;
  }

  private async generateQuestions(
    analysis: Thought
  ): Promise<Question[]> {
    // Implement question decomposition
    const prompt = `
      Break down this task into simpler questions that, when answered,
      will provide a complete solution:

      Task: ${analysis.content}

      Generate 3-5 specific questions.
    `;

    const response = await this.llm.complete({
      messages: [{ role: 'user', content: prompt }]
    });

    return this.parseQuestions(response);
  }

  private async answerQuestion(
    question: Question,
    context: Context,
    previousThoughts: Thought[]
  ): Promise<Thought> {
    // Answer in separate context for faithfulness
    const isolatedContext = this.createIsolatedContext(context);

    const answer = await this.llm.complete({
      messages: [{
        role: 'system',
        content: 'Answer this specific question based on the context.'
      }, {
        role: 'user',
        content: question.text
      }],
      context: isolatedContext
    });

    return {
      type: 'answer',
      question: question.id,
      content: answer,
      confidence: this.assessConfidence(answer),
      timestamp: Date.now()
    };
  }
}
```

### Phase 2: External Scratchpad System (2 days)

```typescript
// src/core/scratchpad.ts

export class Scratchpad {
  private filePath: string;
  private content: ScratchpadContent;
  private autoSave: boolean = true;

  constructor(
    projectPath: string,
    sessionId?: string
  ) {
    this.filePath = path.join(
      projectPath,
      '.open-cli',
      'scratchpad',
      `${sessionId || 'current'}.md`
    );
    this.load();
  }

  async addTodoList(todos: TodoItem[]): Promise<void> {
    const markdown = this.generateTodoMarkdown(todos);

    this.content.sections.push({
      type: 'todo-list',
      title: 'Task Breakdown',
      content: markdown,
      created: Date.now(),
      items: todos
    });

    if (this.autoSave) {
      await this.save();
    }
  }

  async updateTodoStatus(
    todoId: string,
    status: TodoStatus,
    notes?: string
  ): Promise<void> {
    const section = this.content.sections.find(
      s => s.type === 'todo-list'
    );

    if (section && section.items) {
      const todo = section.items.find(t => t.id === todoId);
      if (todo) {
        todo.status = status;
        if (notes) {
          todo.notes = notes;
        }
        todo.updatedAt = Date.now();

        // Regenerate markdown
        section.content = this.generateTodoMarkdown(section.items);

        if (this.autoSave) {
          await this.save();
        }
      }
    }
  }

  private generateTodoMarkdown(todos: TodoItem[]): string {
    const lines: string[] = ['## TODO List', ''];

    for (const todo of todos) {
      const checkbox = todo.status === 'completed' ? '[x]' : '[ ]';
      const status = todo.status === 'in_progress' ? ' 🔄' : '';

      lines.push(`- ${checkbox} **${todo.title}**${status}`);

      if (todo.description) {
        lines.push(`  ${todo.description}`);
      }

      if (todo.notes) {
        lines.push(`  > ${todo.notes}`);
      }

      if (todo.subtasks && todo.subtasks.length > 0) {
        for (const subtask of todo.subtasks) {
          const subCheck = subtask.completed ? '[x]' : '[ ]';
          lines.push(`  - ${subCheck} ${subtask.title}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  async addNote(note: string, type: 'info' | 'warning' | 'error'): Promise<void> {
    const icon = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌'
    }[type];

    this.content.sections.push({
      type: 'note',
      content: `${icon} ${note}`,
      created: Date.now()
    });

    if (this.autoSave) {
      await this.save();
    }
  }

  getMarkdown(): string {
    const sections = this.content.sections
      .map(s => s.content)
      .join('\n\n---\n\n');

    return `# Scratchpad - ${this.content.sessionId}

Created: ${new Date(this.content.created).toISOString()}
Last Updated: ${new Date(this.content.updated).toISOString()}

---

${sections}`;
  }

  private async save(): Promise<void> {
    const markdown = this.getMarkdown();
    await fs.promises.mkdir(path.dirname(this.filePath), {
      recursive: true
    });
    await fs.promises.writeFile(this.filePath, markdown, 'utf-8');
    this.content.updated = Date.now();
  }
}
```

### Phase 3: Project Configuration System (1-2 days)

```typescript
// src/core/project-config.ts

export interface ProjectConfig {
  instructions: string[];
  commands: CustomCommand[];
  styleGuides: StyleGuide[];
  tools: ToolConfig[];
  constraints: Constraint[];
  metadata: ProjectMetadata;
}

export class ProjectConfigManager {
  private configPath: string = 'OPEN_CLI.md';
  private config: ProjectConfig | null = null;
  private watcher: FSWatcher | null = null;

  async load(): Promise<ProjectConfig> {
    const fullPath = path.join(process.cwd(), this.configPath);

    if (!fs.existsSync(fullPath)) {
      // Create default config
      return this.createDefaultConfig();
    }

    const content = await fs.promises.readFile(fullPath, 'utf-8');
    this.config = await this.parseConfig(content);

    // Start watching for changes
    this.startWatching(fullPath);

    return this.config;
  }

  private async parseConfig(markdown: string): Promise<ProjectConfig> {
    const config: ProjectConfig = {
      instructions: [],
      commands: [],
      styleGuides: [],
      tools: [],
      constraints: [],
      metadata: {}
    };

    // Parse markdown sections
    const sections = this.parseMarkdownSections(markdown);

    // Extract instructions
    if (sections['instructions']) {
      config.instructions = this.parseInstructions(
        sections['instructions']
      );
    }

    // Extract custom commands
    if (sections['commands']) {
      config.commands = this.parseCommands(sections['commands']);
    }

    // Extract style guides
    if (sections['style']) {
      config.styleGuides = this.parseStyleGuides(sections['style']);
    }

    // Extract tool configurations
    if (sections['tools']) {
      config.tools = this.parseToolConfigs(sections['tools']);
    }

    // Extract constraints
    if (sections['constraints']) {
      config.constraints = this.parseConstraints(
        sections['constraints']
      );
    }

    return config;
  }

  async applyToContext(
    context: ExecutionContext
  ): Promise<ExecutionContext> {
    if (!this.config) {
      await this.load();
    }

    const modified = { ...context };

    // Add project instructions to system prompt
    if (this.config.instructions.length > 0) {
      modified.systemPrompt = `
        ${context.systemPrompt}

        Project-specific instructions:
        ${this.config.instructions.join('\n')}
      `;
    }

    // Register custom commands
    for (const command of this.config.commands) {
      modified.customCommands[command.name] = command;
    }

    // Apply constraints
    modified.constraints = [
      ...context.constraints,
      ...this.config.constraints
    ];

    return modified;
  }

  private createDefaultConfig(): ProjectConfig {
    const defaultContent = `# OPEN_CLI Configuration

## Instructions

- Follow the project's coding standards
- Write comprehensive tests for all new features
- Update documentation when making changes
- Use TypeScript for all new code

## Commands

### test
Run all tests with coverage
\`\`\`bash
npm test -- --coverage
\`\`\`

### lint
Check code quality
\`\`\`bash
npm run lint
\`\`\`

## Style Guide

- Use 2 spaces for indentation
- Prefer const over let
- Use async/await over promises
- Add JSDoc comments for public APIs

## Constraints

- Do not modify files in node_modules
- Always run tests before committing
- Keep functions under 50 lines
- Maintain test coverage above 80%
`;

    fs.writeFileSync(this.configPath, defaultContent);
    return this.parseConfig(defaultContent);
  }
}
```

### Acceptance Criteria

- [ ] Internal monologue generates detailed thinking process
- [ ] Question decomposition improves reasoning faithfulness
- [ ] External scratchpad maintains TODO lists
- [ ] Scratchpad auto-saves and persists state
- [ ] OPEN_CLI.md automatically loaded and applied
- [ ] Project config hot-reloads on changes
- [ ] TODO progress tracked in markdown format
- [ ] Custom commands from config work correctly
- [ ] All tests passing

---

## P0-6: TDD Workflow and Verification System 🆕

**목표**: 테스트 주도 개발 워크플로우와 3단계 검증 시스템 구현

**Priority**: P0 (Critical)
**Estimated Time**: 6-7 days
**Dependencies**: P0-3 (Agent Loop)
**Status**: Not Started

### Overview

Claude Code의 가장 강력한 워크플로우인 TDD(Test-Driven Development)와
3가지 검증 방식(Rules, Visual, LLM-as-Judge)을 완벽하게 구현합니다.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│              TDD Workflow Manager                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Test First                                       │
│     └─> Write failing tests                         │
│                                                      │
│  2. Run & Verify Failure                            │
│     └─> Confirm tests fail as expected              │
│                                                      │
│  3. Implementation Loop                              │
│     ├─> Write code                                  │
│     ├─> Run tests                                   │
│     ├─> Analyze failures                            │
│     └─> Iterate until pass                          │
│                                                      │
│  4. Verification System                              │
│     ├─> Rule-based (deterministic)                  │
│     ├─> Visual feedback (UI/screenshots)            │
│     └─> LLM-as-Judge (fuzzy criteria)              │
└─────────────────────────────────────────────────────┘
```

### Phase 1: TDD Workflow Implementation (3 days)

```typescript
// src/workflows/tdd-workflow.ts

export class TDDWorkflow {
  private testRunner: TestRunner;
  private codeGenerator: CodeGenerator;
  private verifier: WorkVerifier;

  async execute(request: TDDRequest): Promise<TDDResult> {
    const session: TDDSession = {
      id: generateId(),
      request,
      tests: [],
      implementations: [],
      iterations: [],
      status: 'in_progress'
    };

    // Phase 1: Write tests first
    const tests = await this.writeTests(request);
    session.tests = tests;

    // Phase 2: Verify tests fail
    const initialRun = await this.runTests(tests);
    if (!this.allTestsFail(initialRun)) {
      return {
        success: false,
        error: 'Tests should fail initially',
        session
      };
    }

    // Phase 3: Implementation loop
    let iteration = 0;
    const maxIterations = request.maxIterations || 10;

    while (iteration < maxIterations) {
      // Generate implementation
      const implementation = await this.generateImplementation({
        tests,
        previousAttempts: session.implementations,
        failures: this.getLatestFailures(session)
      });

      session.implementations.push(implementation);

      // Run tests
      const testResult = await this.runTests(
        tests,
        implementation
      );

      // Record iteration
      session.iterations.push({
        number: iteration + 1,
        implementation,
        testResult,
        timestamp: Date.now()
      });

      // Check if all tests pass
      if (this.allTestsPass(testResult)) {
        session.status = 'completed';
        return {
          success: true,
          session,
          finalImplementation: implementation,
          iterations: iteration + 1
        };
      }

      // Analyze failures for next iteration
      const analysis = await this.analyzeFailures(testResult);
      session.failureAnalysis = analysis;

      iteration++;
    }

    // Max iterations reached
    session.status = 'failed';
    return {
      success: false,
      error: 'Max iterations reached without passing all tests',
      session
    };
  }

  private async writeTests(request: TDDRequest): Promise<Test[]> {
    const prompt = `
      Write comprehensive tests for the following requirement:
      ${request.requirement}

      Include:
      - Happy path tests
      - Edge cases
      - Error scenarios
      - Performance tests (if applicable)

      Use ${request.testFramework || 'jest'} syntax.
    `;

    const response = await this.llm.complete({
      messages: [{ role: 'user', content: prompt }]
    });

    return this.parseTests(response);
  }

  private async generateImplementation(
    context: ImplementationContext
  ): Promise<Implementation> {
    const prompt = `
      Implement code to pass these tests:

      ${context.tests.map(t => t.code).join('\n')}

      Previous failures:
      ${context.failures?.map(f => f.message).join('\n')}

      DO NOT modify the tests. Only implement the code.
    `;

    const response = await this.llm.complete({
      messages: [{ role: 'user', content: prompt }]
    });

    return {
      code: response,
      language: context.language || 'typescript',
      timestamp: Date.now()
    };
  }
}
```

### Phase 2: Three-Mode Verification System (2 days)

```typescript
// src/verification/verification-system.ts

export interface VerificationRule {
  name: string;
  type: 'lint' | 'test' | 'build' | 'custom';
  command?: string;
  expectedOutput?: string | RegExp;
  validator?: (output: any) => boolean;
  failureMessage: string;
  suggestions: string[];
}

export class VerificationSystem {
  private ruleEngine: RuleEngine;
  private visualVerifier: VisualVerifier;
  private llmJudge: LLMJudge;

  async verify(
    work: WorkOutput,
    criteria: VerificationCriteria
  ): Promise<VerificationResult> {
    const results: VerificationOutcome[] = [];

    // 1. Rule-based verification (strongest, deterministic)
    if (criteria.rules && criteria.rules.length > 0) {
      const ruleResults = await this.verifyRules(work, criteria.rules);
      results.push(...ruleResults);
    }

    // 2. Visual verification (for UI work)
    if (criteria.visual) {
      const visualResults = await this.verifyVisual(
        work,
        criteria.visual
      );
      results.push(...visualResults);
    }

    // 3. LLM-as-Judge (for fuzzy criteria)
    if (criteria.fuzzy) {
      const llmResults = await this.verifyWithLLM(
        work,
        criteria.fuzzy
      );
      results.push(...llmResults);
    }

    return this.aggregateResults(results);
  }

  private async verifyRules(
    work: WorkOutput,
    rules: VerificationRule[]
  ): Promise<VerificationOutcome[]> {
    const outcomes: VerificationOutcome[] = [];

    for (const rule of rules) {
      let passed = false;
      let output: any;

      switch (rule.type) {
        case 'lint':
          output = await this.runCommand('npm run lint');
          passed = output.exitCode === 0;
          break;

        case 'test':
          output = await this.runCommand(
            rule.command || 'npm test'
          );
          passed = output.exitCode === 0;
          break;

        case 'build':
          output = await this.runCommand('npm run build');
          passed = output.exitCode === 0;
          break;

        case 'custom':
          if (rule.validator) {
            passed = rule.validator(work);
          } else if (rule.command) {
            output = await this.runCommand(rule.command);
            if (rule.expectedOutput) {
              passed = this.matchesExpected(
                output.stdout,
                rule.expectedOutput
              );
            }
          }
          break;
      }

      outcomes.push({
        rule: rule.name,
        passed,
        output,
        message: passed ? 'Passed' : rule.failureMessage,
        suggestions: passed ? [] : rule.suggestions,
        severity: passed ? 'info' : 'error'
      });
    }

    return outcomes;
  }
}

// Visual Verifier for UI work
export class VisualVerifier {
  private browser: Browser;
  private diffEngine: ImageDiffEngine;

  async verify(
    work: WorkOutput,
    criteria: VisualCriteria
  ): Promise<VerificationOutcome[]> {
    const outcomes: VerificationOutcome[] = [];

    // 1. Render the output
    const screenshot = await this.captureScreenshot(work);

    // 2. Send to LLM for visual analysis
    const analysis = await this.analyzeScreenshot(
      screenshot,
      criteria
    );

    // 3. Check specific visual criteria
    for (const criterion of criteria.checks) {
      const result = await this.checkCriterion(
        screenshot,
        criterion,
        analysis
      );

      outcomes.push({
        rule: `Visual: ${criterion.name}`,
        passed: result.passed,
        output: result.details,
        message: result.message,
        suggestions: result.suggestions || [],
        severity: result.passed ? 'info' : 'warning',
        screenshot: screenshot.path
      });
    }

    return outcomes;
  }

  private async captureScreenshot(
    work: WorkOutput
  ): Promise<Screenshot> {
    // If it's HTML/CSS, render it
    if (work.type === 'html') {
      const page = await this.browser.newPage();
      await page.setContent(work.content);
      const screenshot = await page.screenshot();
      await page.close();
      return { data: screenshot, path: this.saveSc
reenshot(screenshot) };
    }

    // If it's a URL, navigate and capture
    if (work.type === 'url') {
      const page = await this.browser.newPage();
      await page.goto(work.url);
      const screenshot = await page.screenshot();
      await page.close();
      return { data: screenshot, path: this.saveScreenshot(screenshot) };
    }

    throw new Error(`Cannot capture screenshot for type: ${work.type}`);
  }

  private async analyzeScreenshot(
    screenshot: Screenshot,
    criteria: VisualCriteria
  ): Promise<VisualAnalysis> {
    const prompt = `
      Analyze this screenshot for:
      ${criteria.checks.map(c => `- ${c.description}`).join('\n')}

      Provide detailed feedback on each criterion.
    `;

    const response = await this.llm.complete({
      messages: [{
        role: 'user',
        content: prompt,
        images: [screenshot.data]
      }]
    });

    return this.parseAnalysis(response);
  }
}

// LLM-as-Judge for fuzzy criteria
export class LLMJudge {
  async evaluate(
    work: WorkOutput,
    criteria: FuzzyCriteria
  ): Promise<VerificationOutcome[]> {
    const outcomes: VerificationOutcome[] = [];

    for (const criterion of criteria.items) {
      const judgment = await this.judge(work, criterion);

      outcomes.push({
        rule: `Fuzzy: ${criterion.name}`,
        passed: judgment.passed,
        output: judgment,
        message: judgment.reasoning,
        suggestions: judgment.suggestions || [],
        severity: judgment.confidence > 0.8 ?
          (judgment.passed ? 'info' : 'error') : 'warning',
        confidence: judgment.confidence
      });
    }

    return outcomes;
  }

  private async judge(
    work: WorkOutput,
    criterion: FuzzyCriterion
  ): Promise<Judgment> {
    const prompt = `
      Evaluate this work against the criterion:

      Criterion: ${criterion.description}
      Expected: ${criterion.expected}

      Work output:
      ${work.content}

      Provide:
      1. Pass/Fail judgment
      2. Confidence (0-1)
      3. Detailed reasoning
      4. Suggestions if failed
    `;

    const response = await this.llm.complete({
      messages: [{
        role: 'system',
        content: 'You are an expert judge evaluating work quality.'
      }, {
        role: 'user',
        content: prompt
      }]
    });

    return this.parseJudgment(response);
  }
}
```

### Phase 3: Integration with Agent Loop (1-2 days)

```typescript
// src/workflows/tdd-integration.ts

export class TDDIntegration {
  private tddWorkflow: TDDWorkflow;
  private agentLoop: AgentLoopController;
  private verificationSystem: VerificationSystem;

  async executeTDDTodo(
    todo: TodoItem,
    context: Context
  ): Promise<TodoResult> {
    // Check if this is a TDD task
    if (!this.isTDDTask(todo)) {
      // Fall back to regular execution
      return this.agentLoop.executeTodoWithLoop(todo, context);
    }

    // Execute TDD workflow
    const tddResult = await this.tddWorkflow.execute({
      requirement: todo.description,
      testFramework: this.detectTestFramework(context),
      language: this.detectLanguage(context),
      maxIterations: 15
    });

    if (!tddResult.success) {
      return {
        success: false,
        error: tddResult.error,
        todo
      };
    }

    // Verify the final implementation
    const verification = await this.verificationSystem.verify(
      tddResult.finalImplementation,
      {
        rules: [
          {
            name: 'All tests pass',
            type: 'test',
            failureMessage: 'Some tests are still failing',
            suggestions: ['Review test failures', 'Check edge cases']
          },
          {
            name: 'No lint errors',
            type: 'lint',
            failureMessage: 'Code has lint errors',
            suggestions: ['Run auto-fix', 'Review style guide']
          }
        ]
      }
    );

    return {
      success: verification.allPassed,
      todo,
      implementation: tddResult.finalImplementation,
      verification,
      iterations: tddResult.session.iterations.length
    };
  }

  private isTDDTask(todo: TodoItem): boolean {
    const tddKeywords = [
      'test', 'tdd', 'test-driven',
      'write tests', 'implement with tests'
    ];

    const description = todo.description.toLowerCase();
    return tddKeywords.some(keyword =>
      description.includes(keyword)
    );
  }
}
```

### Acceptance Criteria

- [ ] TDD workflow writes tests first
- [ ] Tests verified to fail before implementation
- [ ] Implementation loop runs until tests pass
- [ ] Maximum iteration limit enforced
- [ ] Rule-based verification works for lint/test/build
- [ ] Visual verification captures and analyzes screenshots
- [ ] LLM-as-Judge evaluates fuzzy criteria
- [ ] All three verification modes can be combined
- [ ] Integration with main agent loop seamless
- [ ] All tests passing

---

## P1-10: MCP (Model Context Protocol) Integration 🆕

**목표**: 외부 서비스와의 표준화된 통합을 위한 MCP 구현

**Priority**: P1 (Important)
**Estimated Time**: 4-5 days
**Dependencies**: P0-3 (Agent Loop)
**Status**: Not Started

### Overview

MCP를 통해 GitHub, Slack, Databases 등 외부 서비스와 표준화된 방식으로 통합합니다.

### Implementation

```typescript
// src/mcp/mcp-client.ts

export class MCPClient {
  private servers: Map<string, MCPServer> = new Map();
  private discovery: MCPDiscovery;

  async connect(serverUri: string): Promise<void> {
    const server = await this.discovery.discover(serverUri);

    await server.initialize({
      clientInfo: {
        name: 'open-cli',
        version: '1.0.0'
      }
    });

    this.servers.set(server.name, server);
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: any
  ): Promise<any> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server not found: ${serverName}`);
    }

    return await server.callTool({
      name: toolName,
      arguments: args
    });
  }
}

// GitHub MCP Server
export class GitHubMCPServer implements MCPServer {
  async getTools(): Promise<ToolDefinition[]> {
    return [
      {
        name: 'create_issue',
        description: 'Create a GitHub issue',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
            labels: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      {
        name: 'create_pr',
        description: 'Create a pull request',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
            base: { type: 'string' },
            head: { type: 'string' }
          }
        }
      }
    ];
  }

  async callTool(request: ToolRequest): Promise<any> {
    switch (request.name) {
      case 'create_issue':
        return await this.createIssue(request.arguments);
      case 'create_pr':
        return await this.createPR(request.arguments);
      default:
        throw new Error(`Unknown tool: ${request.name}`);
    }
  }
}
```

### Acceptance Criteria

- [ ] MCP client can discover and connect to servers
- [ ] GitHub integration working (issues, PRs)
- [ ] Tool definitions automatically registered
- [ ] Authentication handled properly
- [ ] Error handling and retries implemented
- [ ] All tests passing

---

## P1-11: Human-in-the-Loop Safety System 🆕

**목표**: 위험한 작업에 대한 명시적 승인 시스템 구현

**Priority**: P1 (Important)
**Estimated Time**: 3 days
**Dependencies**: P0-3 (Agent Loop)
**Status**: Not Started

### Overview

모든 파일 수정, bash 명령어, 외부 API 호출에 대해 사용자 승인을 요청하는
안전성 시스템을 구현합니다.

### Implementation

```typescript
// src/safety/approval-system.ts

export interface ApprovalRequest {
  action: string;
  tool: string;
  args: any;
  risk: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  potentialImpact: string[];
  reversible: boolean;
}

export class ApprovalSystem {
  private autoApprove: Set<string> = new Set();
  private alwaysDeny: Set<string> = new Set();
  private sessionApprovals: Map<string, boolean> = new Map();

  async requestApproval(
    request: ApprovalRequest
  ): Promise<ApprovalResult> {
    // Check auto-approve list
    if (this.autoApprove.has(request.tool)) {
      return { approved: true, automatic: true };
    }

    // Check deny list
    if (this.alwaysDeny.has(request.tool)) {
      return { approved: false, reason: 'Tool is blocked' };
    }

    // Check session approvals
    const sessionKey = this.getSessionKey(request);
    if (this.sessionApprovals.has(sessionKey)) {
      return {
        approved: this.sessionApprovals.get(sessionKey)!,
        fromSession: true
      };
    }

    // Show approval UI
    const response = await this.showApprovalUI(request);

    // Handle "approve all similar"
    if (response.approveAllSimilar) {
      this.sessionApprovals.set(sessionKey, true);
    }

    return response;
  }

  private async showApprovalUI(
    request: ApprovalRequest
  ): Promise<ApprovalResult> {
    const ui = new ApprovalUI();

    return await ui.prompt({
      title: `🔐 Approval Required (Risk: ${request.risk})`,
      action: request.action,
      description: request.description,
      impact: request.potentialImpact,
      reversible: request.reversible,
      options: [
        'Approve',
        'Deny',
        'Approve all similar this session',
        'View details',
        'Modify and approve'
      ]
    });
  }
}

// Risk Assessment
export class RiskAssessor {
  assess(action: Action): RiskLevel {
    // File operations
    if (action.tool === 'delete_file') {
      return 'critical';
    }
    if (action.tool === 'write_file' && action.args.path.includes('config')) {
      return 'high';
    }

    // Bash commands
    if (action.tool === 'bash') {
      const command = action.args.command;
      if (command.includes('rm -rf')) return 'critical';
      if (command.includes('sudo')) return 'critical';
      if (command.includes('chmod')) return 'high';
      if (command.includes('git push --force')) return 'high';
    }

    // API calls
    if (action.tool.includes('api')) {
      if (action.method === 'DELETE') return 'high';
      if (action.method === 'POST') return 'medium';
    }

    return 'low';
  }
}
```

### Acceptance Criteria

- [ ] All file modifications require approval
- [ ] Dangerous bash commands blocked or warned
- [ ] Session-based approval caching works
- [ ] Risk levels correctly assessed
- [ ] UI clearly shows potential impacts
- [ ] "Approve all similar" functionality works
- [ ] YOLO mode bypasses approvals when enabled
- [ ] All tests passing

---

## Summary of New Claude Code Methodology Implementation

이제 OPEN-CLI는 Claude Code의 핵심 방법론을 완벽하게 구현하게 됩니다:

### 🎯 핵심 구현 (P0 - Critical)

1. **P0-3: Agent Loop** - gather → act → verify → repeat
2. **P0-4: Multi-Layer Execution** - 4계층 동적 실행 아키텍처
3. **P0-5: Internal Monologue** - 확장된 사고와 스크래치패드
4. **P0-6: TDD & Verification** - 테스트 주도 개발과 3단계 검증

### ⚡ 추가 구현 (P1 - Important)

5. **P1-10: MCP Integration** - 외부 서비스 표준 통합
6. **P1-11: Safety System** - Human-in-the-Loop 승인 시스템

### 📊 총 예상 소요 시간

- P0 항목들: 28-35일
- P1 항목들: 7-8일
- **총계**: 35-43일 (약 6-7주)

### 🚀 구현 후 기대 효과

1. **진정한 에이전트 시스템**: 단순 응답이 아닌 자율적 작업 수행
2. **신뢰성 향상**: 체계적인 검증과 TDD로 오류 최소화
3. **확장성**: 복잡한 작업도 SubAgent로 병렬 처리
4. **안전성**: 모든 위험 작업에 대한 명시적 제어
5. **표준화**: MCP를 통한 외부 서비스 통합

이 구현이 완료되면 OPEN-CLI는 Claude Code와 동등한 수준의
정교한 AI 에이전트 시스템이 될 것입니다.