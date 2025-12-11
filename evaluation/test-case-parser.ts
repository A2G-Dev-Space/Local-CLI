import fs from 'fs/promises';

export interface TestCase {
  id: number;
  prompt: string;
  filePaths: string[];
}

/**
 * Parse agno_prompts.md to extract test cases
 */
export async function parseTestCases(filePath: string): Promise<TestCase[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  const testCases: TestCase[] = [];
  let currentTestCase: Partial<TestCase> | null = null;
  let inFilePaths = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Detect test case start
    const testCaseMatch = line.match(/^## Test Case (\d+)/);
    if (testCaseMatch && testCaseMatch[1]) {
      // Save previous test case if exists
      if (currentTestCase && currentTestCase.id && currentTestCase.prompt) {
        testCases.push(currentTestCase as TestCase);
      }

      // Start new test case
      currentTestCase = {
        id: parseInt(testCaseMatch[1], 10),
        prompt: '',
        filePaths: [],
      };
      inFilePaths = false;
      continue;
    }

    // Extract prompt
    if (currentTestCase && line.startsWith('**프롬프트**:')) {
      currentTestCase.prompt = line.replace(/^\*\*프롬프트\*\*:\s*/, '').trim();
      continue;
    }

    // Detect file paths section
    if (currentTestCase && line.startsWith('**파일 경로**')) {
      inFilePaths = true;
      continue;
    }

    // Extract file paths
    if (currentTestCase && inFilePaths && line.startsWith('- `')) {
      const filePathMatch = line.match(/`([^`]+)`/);
      if (filePathMatch && filePathMatch[1]) {
        currentTestCase.filePaths?.push(filePathMatch[1]);
      }
      continue;
    }

    // End of file paths section
    if (inFilePaths && line.trim() === '---') {
      inFilePaths = false;
    }
  }

  // Save last test case
  if (currentTestCase && currentTestCase.id && currentTestCase.prompt) {
    testCases.push(currentTestCase as TestCase);
  }

  return testCases;
}

/**
 * Select specific test cases by IDs
 */
export function selectTestCases(
  testCases: TestCase[],
  ids?: number[]
): TestCase[] {
  if (!ids || ids.length === 0) {
    return testCases;
  }
  return testCases.filter(tc => ids.includes(tc.id));
}
