/**
 * Robust JSON Parser Utility
 *
 * Handles common issues with LLM-generated JSON:
 * - JSON in markdown code blocks
 * - JavaScript-style comments
 * - Trailing commas
 * - Multiple JSON objects in response
 */

/**
 * Extract and parse JSON from LLM response
 * Handles markdown blocks, comments, and malformed JSON
 */
export function extractJSON(text: string): any {
  if (!text || typeof text !== 'string') {
    throw new Error('Input must be a non-empty string');
  }

  // Try methods in order of likelihood
  const extractors = [
    extractFromMarkdownBlock,
    extractFromFirstBrace,
    extractFromCleanedText,
  ];

  let lastError: Error | null = null;

  for (const extractor of extractors) {
    try {
      const result = extractor(text);
      if (result !== null) {
        // Validate that result is an object or array, not a primitive
        if (typeof result !== 'object' || result === null) {
          throw new Error('Extracted JSON must be an object or array, not a primitive value');
        }
        return result;
      }
    } catch (error) {
      lastError = error as Error;
      // Continue to next extractor
    }
  }

  // All methods failed
  throw new Error(
    `Failed to extract valid JSON from response. Last error: ${lastError?.message || 'Unknown'}\n\nResponse preview: ${text.substring(0, 200)}...`
  );
}

/**
 * Method 1: Extract JSON from markdown code blocks
 */
function extractFromMarkdownBlock(text: string): any | null {
  // Try ```json ... ``` first
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    return parseWithCleanup(jsonBlockMatch[1]!);
  }

  // Try ``` ... ``` (any code block)
  const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return parseWithCleanup(codeBlockMatch[1]!);
  }

  return null;
}

/**
 * Method 2: Extract JSON from first { to matching }
 */
function extractFromFirstBrace(text: string): any | null {
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) {
    return null;
  }

  // Find matching closing brace
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = firstBrace; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          // Found matching brace
          const jsonStr = text.substring(firstBrace, i + 1);
          return parseWithCleanup(jsonStr);
        }
      }
    }
  }

  return null;
}

/**
 * Method 3: Clean the entire text and try to parse
 */
function extractFromCleanedText(text: string): any | null {
  return parseWithCleanup(text);
}

/**
 * Parse JSON with cleanup steps
 */
function parseWithCleanup(text: string): any {
  // Step 1: Remove JavaScript-style comments
  let cleaned = removeComments(text);

  // Step 2: Try to parse
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    // Step 3: Try to fix common issues
    cleaned = fixCommonIssues(cleaned);
    return JSON.parse(cleaned);
  }
}

/**
 * Remove JavaScript-style comments from JSON
 */
function removeComments(text: string): string {
  // Remove single-line comments (// ...)
  let result = text.replace(/\/\/.*$/gm, '');

  // Remove multi-line comments (/* ... */)
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');

  return result;
}

/**
 * Fix common JSON issues
 */
function fixCommonIssues(text: string): string {
  let fixed = text;

  // Remove trailing commas before } or ]
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

  // Fix single quotes to double quotes (risky but common issue)
  // Only do this if there are no double quotes already
  if (!fixed.includes('"') && fixed.includes("'")) {
    fixed = fixed.replace(/'/g, '"');
  }

  return fixed;
}

/**
 * Validate that parsed result matches expected structure
 */
export function validateJSONStructure(
  obj: any,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (typeof obj !== 'object' || obj === null) {
    return { valid: false, missing: ['object'] };
  }

  for (const field of requiredFields) {
    if (!(field in obj)) {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Safe JSON parse with better error messages
 */
export function safeJSONParse(text: string): { success: boolean; data?: any; error?: string } {
  try {
    const data = extractJSON(text);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}
