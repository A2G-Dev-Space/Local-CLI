#!/usr/bin/env node
/**
 * Ink UI Entry Point
 *
 * ESM으로 Ink UI를 직접 실행
 */

import React from 'react';
import { render } from 'ink';
import { PlanExecuteApp } from './components/PlanExecuteApp.js';
import { createLLMClient } from '../core/llm-client.js';
import { configManager } from '../core/config-manager.js';

// Async 초기화
(async () => {
  try {
    // ConfigManager 초기화
    await configManager.initialize();

    // LLM Client 생성
    const llmClient = createLLMClient();
    const modelInfo = llmClient.getModelInfo();

    // Ink UI 렌더링 (PlanExecuteApp supports both direct and plan-execute modes)
    render(<PlanExecuteApp llmClient={llmClient} modelInfo={modelInfo} />);
  } catch (error) {
    console.error('❌ 에러 발생:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();
