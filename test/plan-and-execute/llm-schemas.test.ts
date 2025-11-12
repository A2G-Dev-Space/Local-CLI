/**
 * Tests for Plan & Execute LLM Schemas
 *
 * Verifies Schema & I/O section from CHECKLIST_PLAN_AND_EXECUTE.md
 */

import {
  validateLLMOutput,
  parseLLMResponse,
  PlanExecuteLLMOutput,
} from '../../src/plan-and-execute/llm-schemas.js';

describe('Plan & Execute LLM Schemas', () => {
  describe('validateLLMOutput', () => {
    test('validates correct output schema with all required fields', () => {
      const validOutput: PlanExecuteLLMOutput = {
        status: 'success',
        result: 'Task completed successfully',
        log_entries: [
          {
            level: 'info',
            message: 'Starting task',
            timestamp: '2025-01-01T00:00:00Z',
          },
          {
            level: 'debug',
            message: 'Processing step 1',
            timestamp: '2025-01-01T00:00:01Z',
          },
        ],
        files_changed: [
          {
            path: '/src/test.ts',
            action: 'created',
          },
        ],
        next_steps: ['Run tests', 'Deploy'],
      };

      const validation = validateLLMOutput(validOutput);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.parsed).toBeDefined();
      expect(validation.parsed!.status).toBe('success');
      expect(validation.parsed!.result).toBe('Task completed successfully');
      expect(validation.parsed!.log_entries).toHaveLength(2);
      expect(validation.parsed!.files_changed).toHaveLength(1);
      expect(validation.parsed!.next_steps).toHaveLength(2);
    });

    test('rejects output with missing required fields', () => {
      const invalidOutputs = [
        { result: 'test', log_entries: [] }, // missing status
        { status: 'success', log_entries: [] }, // missing result
        { status: 'success', result: 'test' }, // missing log_entries
      ];

      invalidOutputs.forEach((output) => {
        const validation = validateLLMOutput(output);
        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });

    test('rejects output with invalid status value', () => {
      const invalidOutput = {
        status: 'invalid_status',
        result: 'test',
        log_entries: [],
      };

      const validation = validateLLMOutput(invalidOutput);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid status value. Must be one of: success, failed, needs_debug'
      );
    });

    test('validates log_entries structure', () => {
      const invalidOutput = {
        status: 'success',
        result: 'Done',
        log_entries: [
          {
            level: 'info',
            // missing message and timestamp
          },
        ],
      };

      const validation = validateLLMOutput(invalidOutput);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('parseLLMResponse', () => {
    test('parses valid JSON response', () => {
      const response = JSON.stringify({
        status: 'success',
        result: 'Done',
        log_entries: [
          {
            level: 'info',
            message: 'Test',
            timestamp: '2025-01-01T00:00:00Z',
          },
        ],
      });

      const result = parseLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.status).toBe('success');
    });

    test('handles JSON in markdown code blocks', () => {
      const markdownResponse = `\`\`\`json
{
  "status": "success",
  "result": "Done",
  "log_entries": [
    {
      "level": "info",
      "message": "Test",
      "timestamp": "2025-01-01T00:00:00Z"
    }
  ]
}
\`\`\``;

      const result = parseLLMResponse(markdownResponse);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.status).toBe('success');
    });

    test('gracefully handles malformed responses', () => {
      const malformedResponses = [
        'This is not JSON',
        '{ incomplete json',
        '',
        'null',
      ];

      malformedResponses.forEach((response) => {
        const result = parseLLMResponse(response);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('rejects non-JSON response', () => {
      const result = parseLLMResponse('This is not JSON');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse LLM response as JSON');
    });

    test('rejects invalid schema', () => {
      const response = JSON.stringify({
        status: 'invalid_status',
        result: 'test',
      });

      const result = parseLLMResponse(response);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid LLM output schema');
    });
  });
});
