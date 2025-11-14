/**
 * Tests for JSON Parser Utility
 *
 * Tests robust JSON extraction from LLM responses
 */

import { extractJSON, validateJSONStructure, safeJSONParse } from '../../src/utils/json-parser.js';

describe('JSON Parser Utility', () => {
  describe('extractJSON', () => {
    test('parses plain JSON', () => {
      const json = '{"key": "value", "number": 42}';
      const result = extractJSON(json);

      expect(result).toEqual({ key: 'value', number: 42 });
    });

    test('extracts JSON from markdown code block with json tag', () => {
      const markdown = '```json\n{"key": "value"}\n```';
      const result = extractJSON(markdown);

      expect(result).toEqual({ key: 'value' });
    });

    test('extracts JSON from markdown code block without tag', () => {
      const markdown = '```\n{"key": "value"}\n```';
      const result = extractJSON(markdown);

      expect(result).toEqual({ key: 'value' });
    });

    test('extracts JSON with surrounding text', () => {
      const text = 'Here is the result: {"key": "value"} and that\'s it';
      const result = extractJSON(text);

      expect(result).toEqual({ key: 'value' });
    });

    test('handles JSON with single-line comments', () => {
      const jsonWithComments = `{
  "key": "value", // this is a comment
  "number": 42
}`;
      const result = extractJSON(jsonWithComments);

      expect(result).toEqual({ key: 'value', number: 42 });
    });

    test('handles JSON with multi-line comments', () => {
      const jsonWithComments = `{
  /* This is a
     multi-line comment */
  "key": "value",
  "number": 42
}`;
      const result = extractJSON(jsonWithComments);

      expect(result).toEqual({ key: 'value', number: 42 });
    });

    test('handles JSON with trailing commas', () => {
      const jsonWithTrailingComma = `{
  "key": "value",
  "array": [1, 2, 3,],
}`;
      const result = extractJSON(jsonWithTrailingComma);

      expect(result).toEqual({ key: 'value', array: [1, 2, 3] });
    });

    test('handles nested objects', () => {
      const json = `{
  "outer": {
    "inner": {
      "value": 123
    }
  }
}`;
      const result = extractJSON(json);

      expect(result).toEqual({
        outer: {
          inner: {
            value: 123,
          },
        },
      });
    });

    test('handles arrays', () => {
      const json = '{"items": [{"id": 1}, {"id": 2}]}';
      const result = extractJSON(json);

      expect(result).toEqual({
        items: [{ id: 1 }, { id: 2 }],
      });
    });

    test('handles strings with braces', () => {
      const json = '{"message": "This {is} a {test}"}';
      const result = extractJSON(json);

      expect(result).toEqual({
        message: 'This {is} a {test}',
      });
    });

    test('handles escaped quotes', () => {
      const json = '{"message": "He said \\"hello\\""}';
      const result = extractJSON(json);

      expect(result).toEqual({
        message: 'He said "hello"',
      });
    });

    test('handles raw newlines in JSON string values', () => {
      // Simulate LLM returning JSON with actual newlines instead of \n
      const jsonWithRawNewlines = `{
  "status": "success",
  "result": "Line 1
Line 2
Line 3"
}`;
      const result = extractJSON(jsonWithRawNewlines);
      expect(result).toEqual({
        status: 'success',
        result: 'Line 1\nLine 2\nLine 3',
      });
    });

    test('handles control characters in JSON string values', () => {
      const jsonWithControlChars = '{"message": "Tab:\there\nNewline:\nthere"}';
      const result = extractJSON(jsonWithControlChars);
      expect(result.message).toContain('Tab:');
      expect(result.message).toContain('Newline:');
    });

    test('handles truncated JSON by closing unclosed strings and braces', () => {
      // Simulate LLM response that was cut off mid-JSON
      const truncatedJSON = '{"status": "success", "result": "This is a long result that got cut off';
      const result = extractJSON(truncatedJSON);
      expect(result.status).toBe('success');
      expect(result.result).toContain('This is a long result');
    });

    test('handles truncated JSON with missing closing brace', () => {
      const truncatedJSON = '{"status": "success", "result": "Done"';
      const result = extractJSON(truncatedJSON);
      expect(result.status).toBe('success');
      expect(result.result).toBe('Done');
    });

    test('handles truncated JSON with unclosed array and object', () => {
      // More realistic: truncation happens at end of a field value
      const truncatedJSON = '{"status": "success", "items": [{"id": 1, "name": "test"}';
      const result = extractJSON(truncatedJSON);
      expect(result.status).toBe('success');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(1);
      expect(result.items[0].name).toBe('test');
    });

    test('handles truncated JSON with array', () => {
      // Truncation in the middle of string value
      const truncatedJSON = '{"status": "success", "items": ["item1", "item2';
      const result = extractJSON(truncatedJSON);
      expect(result.status).toBe('success');
      expect(result.items).toContain('item1');
    });

    test('throws on completely invalid input', () => {
      expect(() => extractJSON('not json at all')).toThrow();
      expect(() => extractJSON('12345')).toThrow();
      expect(() => extractJSON('')).toThrow();
    });

    test('handles real LLM response with markdown', () => {
      const llmResponse = `Here is the result:

\`\`\`json
{
  "status": "success",
  "result": "Task completed",
  "log_entries": [
    {
      "level": "info",
      "message": "Done",
      "timestamp": "2025-01-13T12:00:00.000Z"
    }
  ]
}
\`\`\`

Hope this helps!`;

      const result = extractJSON(llmResponse);

      expect(result.status).toBe('success');
      expect(result.log_entries).toHaveLength(1);
    });

    test('handles LLM response with comments', () => {
      const llmResponse = `{
  "status": "success", // completed successfully
  "result": "Task done",
  /* Log entries below */
  "log_entries": []
}`;

      const result = extractJSON(llmResponse);

      expect(result.status).toBe('success');
      expect(result.result).toBe('Task done');
    });
  });

  describe('validateJSONStructure', () => {
    test('validates object with required fields', () => {
      const obj = { name: 'John', age: 30, email: 'john@example.com' };
      const result = validateJSONStructure(obj, ['name', 'age']);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    test('detects missing fields', () => {
      const obj = { name: 'John' };
      const result = validateJSONStructure(obj, ['name', 'age', 'email']);

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['age', 'email']);
    });

    test('rejects non-objects', () => {
      const result1 = validateJSONStructure(null, ['name']);
      expect(result1.valid).toBe(false);

      const result2 = validateJSONStructure('string', ['name']);
      expect(result2.valid).toBe(false);

      const result3 = validateJSONStructure(123, ['name']);
      expect(result3.valid).toBe(false);
    });

    test('handles empty required fields', () => {
      const obj = { name: 'John' };
      const result = validateJSONStructure(obj, []);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  describe('safeJSONParse', () => {
    test('successfully parses valid JSON', () => {
      const result = safeJSONParse('{"key": "value"}');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
      expect(result.error).toBeUndefined();
    });

    test('returns error for invalid JSON', () => {
      const result = safeJSONParse('not json');

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test('extracts JSON from markdown', () => {
      const result = safeJSONParse('```json\n{"key": "value"}\n```');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
    });
  });
});
