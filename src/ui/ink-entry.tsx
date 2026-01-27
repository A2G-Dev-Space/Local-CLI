#!/usr/bin/env node
/**
 * Ink UI Entry Point
 *
 * ESM으로 Ink UI를 직접 실행
 */

import React from 'react';
import { render } from 'ink';
import { PlanExecuteApp } from './components/PlanExecuteApp.js';
import { createLLMClient } from '../core/llm/llm-client.js';
import { configManager } from '../core/config/config-manager.js';
import { initializeOptionalTools } from '../tools/registry.js';
import { logger } from '../utils/logger.js';

// Async 초기화
(async () => {
  try {
    // ConfigManager 초기화
    await configManager.initialize();

    // Load saved optional tool states (e.g., browser tools, Office tools)
    await initializeOptionalTools();

    // LLM Client 생성
    const llmClient = createLLMClient();
    const modelInfo = llmClient.getModelInfo();

    // Ink UI 렌더링 (PlanExecuteApp supports both direct and plan-execute modes)
    // exitOnCtrlC: false - Ctrl+C is handled manually in PlanExecuteApp for smart behavior
    render(<PlanExecuteApp llmClient={llmClient} modelInfo={modelInfo} />, { exitOnCtrlC: false });
  } catch (error) {
    logger.error('Ink UI initialization failed', error);
    process.exit(1);
  }
})();
