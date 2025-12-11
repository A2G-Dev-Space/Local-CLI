/**
 * Approval Prompt Component
 *
 * Ink-based approval UI for HITL (Human-in-the-Loop)
 * Phase 2: 승인 모드 - 승인/승인(항상허용)/거부+코멘트
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { CustomTextInput } from '../CustomTextInput.js';
import { TodoItem } from '../../../types/index.js';
import { RiskAssessment } from '../../../orchestration/risk-analyzer.js';
import { logger } from '../../../utils/logger.js';

export type ApprovalAction = 'approve' | 'approve_always' | 'reject_with_comment' | 'stop';

export interface ApprovalResponse {
  action: ApprovalAction;
  comment?: string;
}

interface PlanApprovalPromptProps {
  userRequest: string;
  todos: TodoItem[];
  onResponse: (action: ApprovalAction, comment?: string) => void;
}

interface TaskApprovalPromptProps {
  taskDescription: string;
  risk: RiskAssessment;
  context?: string;
  onResponse: (action: ApprovalAction, comment?: string) => void;
}

/**
 * Plan Approval Prompt
 * - 승인: 이 계획 실행
 * - 승인 (항상 허용): 이 패턴 항상 허용
 * - 거부 + 코멘트: 거부하고 피드백 제공
 */
export const PlanApprovalPrompt: React.FC<PlanApprovalPromptProps> = ({
  userRequest,
  todos,
  onResponse,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState('');

  logger.enter('PlanApprovalPrompt', { userRequest, todoCount: todos.length });

  const options = [
    { label: '✅ 승인 - 이 계획 실행', value: 'approve' as const },
    { label: '✅ 승인 (항상 허용) - 이 유형 항상 허용', value: 'approve_always' as const },
    { label: '❌ 거부 + 코멘트 - 피드백과 함께 거부', value: 'reject_with_comment' as const },
  ];

  const handleSelect = useCallback(() => {
    const selected = options[selectedIndex];
    if (!selected) return;

    logger.flow('Plan approval selection', { action: selected.value });

    if (selected.value === 'reject_with_comment') {
      setShowCommentInput(true);
    } else {
      onResponse(selected.value);
    }
  }, [selectedIndex, onResponse]);

  const handleCommentSubmit = useCallback((text: string) => {
    if (!text.trim()) return;
    logger.flow('Plan rejection with comment', { commentLength: text.length });
    onResponse('reject_with_comment', text.trim());
  }, [onResponse]);

  const handleCommentCancel = useCallback(() => {
    logger.flow('Comment input cancelled');
    setShowCommentInput(false);
    setComment('');
  }, []);

  useInput((input, key) => {
    if (showCommentInput) {
      if (key.escape) {
        handleCommentCancel();
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      handleSelect();
    } else if (input >= '1' && input <= '3') {
      const numIndex = parseInt(input, 10) - 1;
      if (numIndex >= 0 && numIndex < options.length) {
        setSelectedIndex(numIndex);
        setTimeout(() => {
          const selected = options[numIndex];
          if (selected?.value === 'reject_with_comment') {
            setShowCommentInput(true);
          } else if (selected) {
            onResponse(selected.value);
          }
        }, 100);
      }
    }
  }, { isActive: !showCommentInput });

  // Comment input mode
  if (showCommentInput) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="red" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="red">❌ 거부 코멘트 입력</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="gray">LLM에게 전달할 피드백을 입력하세요 (ESC: 취소):</Text>
        </Box>
        <Box>
          <Text color="yellow">▸ </Text>
          <CustomTextInput
            value={comment}
            onChange={setComment}
            onSubmit={handleCommentSubmit}
            placeholder="거부 이유나 수정 요청을 입력..."
            focus={true}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">📋 계획 승인 필요</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>요청: "{userRequest}"</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="yellow">{todos.length}개의 작업이 생성되었습니다:</Text>
        {todos.map((todo, index) => (
          <Box key={todo.id} flexDirection="column" marginLeft={2}>
            <Text>
              {index + 1}. {todo.title}
            </Text>
            {todo.description && (
              <Text dimColor color="gray">   {todo.description}</Text>
            )}
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>어떻게 하시겠습니까? (↑↓ 이동, Enter 선택)</Text>
        {options.map((option, index) => (
          <Text key={option.value} color={index === selectedIndex ? 'green' : 'white'}>
            {index === selectedIndex ? '▸ ' : '  '}
            [{index + 1}] {option.label}
          </Text>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Task Approval Prompt (도구 실행 승인)
 * - 승인: 이 작업 실행
 * - 승인 (항상 허용): 이 패턴 항상 허용
 * - 거부 + 코멘트: 거부하고 피드백 제공
 */
export const TaskApprovalPrompt: React.FC<TaskApprovalPromptProps> = ({
  taskDescription,
  risk,
  context,
  onResponse,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState('');

  logger.enter('TaskApprovalPrompt', { taskDescription, riskLevel: risk.level });

  const options = [
    { label: '✅ 승인 - 이 작업 실행', value: 'approve' as const },
    { label: '✅ 승인 (항상 허용) - 이 패턴 항상 허용', value: 'approve_always' as const },
    { label: '❌ 거부 + 코멘트 - 피드백과 함께 거부', value: 'reject_with_comment' as const },
  ];

  const handleSelect = useCallback(() => {
    const selected = options[selectedIndex];
    if (!selected) return;

    logger.flow('Task approval selection', { action: selected.value });

    if (selected.value === 'reject_with_comment') {
      setShowCommentInput(true);
    } else {
      onResponse(selected.value);
    }
  }, [selectedIndex, onResponse]);

  const handleCommentSubmit = useCallback((text: string) => {
    if (!text.trim()) return;
    logger.flow('Task rejection with comment', { commentLength: text.length });
    onResponse('reject_with_comment', text.trim());
  }, [onResponse]);

  const handleCommentCancel = useCallback(() => {
    logger.flow('Comment input cancelled');
    setShowCommentInput(false);
    setComment('');
  }, []);

  useInput((input, key) => {
    if (showCommentInput) {
      if (key.escape) {
        handleCommentCancel();
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      handleSelect();
    } else if (input >= '1' && input <= '3') {
      const numIndex = parseInt(input, 10) - 1;
      if (numIndex >= 0 && numIndex < options.length) {
        setSelectedIndex(numIndex);
        setTimeout(() => {
          const selected = options[numIndex];
          if (selected?.value === 'reject_with_comment') {
            setShowCommentInput(true);
          } else if (selected) {
            onResponse(selected.value);
          }
        }, 100);
      }
    }
  }, { isActive: !showCommentInput });

  const formatRiskLevel = (level: string): string => {
    const formats: Record<string, string> = {
      low: '🟢 낮음',
      medium: '🟡 중간',
      high: '🟠 높음',
      critical: '🔴 치명적',
    };
    return formats[level] || level.toUpperCase();
  };

  const formatCategory = (category: string): string => {
    const translations: Record<string, string> = {
      file_operation: '파일 작업',
      system_command: '시스템 명령',
      network_access: '네트워크 접근',
      code_execution: '코드 실행',
      data_modification: '데이터 수정',
    };
    return translations[category] || category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Comment input mode
  if (showCommentInput) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="red" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="red">❌ 거부 코멘트 입력</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="gray">LLM에게 전달할 피드백을 입력하세요 (ESC: 취소):</Text>
        </Box>
        <Box>
          <Text color="yellow">▸ </Text>
          <CustomTextInput
            value={comment}
            onChange={setComment}
            onSubmit={handleCommentSubmit}
            placeholder="거부 이유나 대안 요청을 입력..."
            focus={true}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">⚠️ 작업 승인 필요 - 위험 작업</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>작업: {taskDescription}</Text>
        <Text>위험 수준: {formatRiskLevel(risk.level)}</Text>
        <Text>분류: {formatCategory(risk.category)}</Text>
        <Text dimColor color="gray">사유: {risk.reason}</Text>
        {risk.detectedPatterns.length > 0 && (
          <Text dimColor color="gray">
            감지된 패턴: {risk.detectedPatterns.slice(0, 3).join(', ')}
          </Text>
        )}
        {context && (
          <Text dimColor color="gray">컨텍스트: {context}</Text>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>어떻게 하시겠습니까? (↑↓ 이동, Enter 선택)</Text>
        {options.map((option, index) => (
          <Text key={option.value} color={index === selectedIndex ? 'green' : 'white'}>
            {index === selectedIndex ? '▸ ' : '  '}
            [{index + 1}] {option.label}
          </Text>
        ))}
      </Box>
    </Box>
  );
};
