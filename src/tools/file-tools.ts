/**
 * File System Tools
 *
 * LLM이 파일 시스템과 상호작용할 수 있는 도구들
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolDefinition } from '../types/index.js';

/**
 * read_file Tool 정의
 */
export const READ_FILE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: '파일의 내용을 읽습니다. 텍스트 파일만 지원됩니다.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '읽을 파일의 절대 경로 또는 상대 경로',
        },
      },
      required: ['file_path'],
    },
  },
};

/**
 * write_file Tool 정의
 */
export const WRITE_FILE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'write_file',
    description: '파일에 내용을 씁니다. 기존 파일이 있으면 덮어씁니다.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '쓸 파일의 절대 경로 또는 상대 경로',
        },
        content: {
          type: 'string',
          description: '파일에 쓸 내용',
        },
      },
      required: ['file_path', 'content'],
    },
  },
};

/**
 * list_files Tool 정의
 */
export const LIST_FILES_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_files',
    description: '디렉토리의 파일 및 폴더 목록을 반환합니다.',
    parameters: {
      type: 'object',
      properties: {
        directory_path: {
          type: 'string',
          description: '목록을 조회할 디렉토리 경로 (기본값: 현재 디렉토리)',
        },
        recursive: {
          type: 'boolean',
          description: '하위 디렉토리까지 재귀적으로 조회할지 여부 (기본값: false)',
        },
      },
      required: [],
    },
  },
};

/**
 * find_files Tool 정의
 */
export const FIND_FILES_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'find_files',
    description: '파일명 패턴으로 파일을 검색합니다.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '검색할 파일명 패턴 (예: *.ts, package.json)',
        },
        directory_path: {
          type: 'string',
          description: '검색을 시작할 디렉토리 경로 (기본값: 현재 디렉토리)',
        },
      },
      required: ['pattern'],
    },
  },
};

/**
 * 모든 파일 도구 배열
 */
export const FILE_TOOLS: ToolDefinition[] = [
  READ_FILE_TOOL,
  WRITE_FILE_TOOL,
  LIST_FILES_TOOL,
  FIND_FILES_TOOL,
];

/**
 * Tool 실행 결과 타입
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
}

/**
 * read_file 도구 실행
 */
export async function executeReadFile(filePath: string): Promise<ToolExecutionResult> {
  try {
    // @ 접두사 제거
    const cleanPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;

    const resolvedPath = path.resolve(cleanPath);
    const content = await fs.readFile(resolvedPath, 'utf-8');

    return {
      success: true,
      result: content,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    // 에러 메시지는 원본 경로 사용 (@ 제거 후)
    const displayPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;

    if (err.code === 'ENOENT') {
      return {
        success: false,
        error: `파일을 찾을 수 없습니다: ${displayPath}`,
      };
    } else if (err.code === 'EACCES') {
      return {
        success: false,
        error: `파일 읽기 권한이 없습니다: ${displayPath}`,
      };
    } else {
      return {
        success: false,
        error: `파일 읽기 실패: ${err.message}`,
      };
    }
  }
}

/**
 * write_file 도구 실행
 */
export async function executeWriteFile(
  filePath: string,
  content: string
): Promise<ToolExecutionResult> {
  try {
    // @ 접두사 제거
    const cleanPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;

    const resolvedPath = path.resolve(cleanPath);

    // 디렉토리가 없으면 생성
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(resolvedPath, content, 'utf-8');

    // 성공 메시지는 정리된 경로 사용
    const displayPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;
    return {
      success: true,
      result: `파일이 성공적으로 작성되었습니다: ${displayPath}`,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const displayPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;
    return {
      success: false,
      error: `파일 쓰기 실패 (${displayPath}): ${err.message}`,
    };
  }
}

/**
 * list_files 도구 실행
 */
export async function executeListFiles(
  directoryPath: string = '.',
  recursive: boolean = false
): Promise<ToolExecutionResult> {
  try {
    const resolvedPath = path.resolve(directoryPath);

    if (recursive) {
      // 재귀적으로 파일 목록 가져오기
      const files = await getFilesRecursively(resolvedPath);
      return {
        success: true,
        result: JSON.stringify(files, null, 2),
      };
    } else {
      // 현재 디렉토리만
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      const files = entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(directoryPath, entry.name),
      }));

      return {
        success: true,
        result: JSON.stringify(files, null, 2),
      };
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return {
        success: false,
        error: `디렉토리를 찾을 수 없습니다: ${directoryPath}`,
      };
    } else {
      return {
        success: false,
        error: `디렉토리 읽기 실패: ${err.message}`,
      };
    }
  }
}

/**
 * 재귀적으로 파일 목록 가져오기
 */
async function getFilesRecursively(
  dirPath: string,
  baseDir: string = dirPath
): Promise<Array<{ name: string; type: string; path: string }>> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files: Array<{ name: string; type: string; path: string }> = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      files.push({
        name: entry.name,
        type: 'directory',
        path: relativePath,
      });

      // 재귀 호출
      const subFiles = await getFilesRecursively(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      files.push({
        name: entry.name,
        type: 'file',
        path: relativePath,
      });
    }
  }

  return files;
}

/**
 * find_files 도구 실행
 */
export async function executeFindFiles(
  pattern: string,
  directoryPath: string = '.'
): Promise<ToolExecutionResult> {
  try {
    const resolvedPath = path.resolve(directoryPath);

    // 패턴을 정규식으로 변환 (간단한 glob 패턴 지원)
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);

    const matchedFiles = await findFilesRecursively(resolvedPath, regex, resolvedPath);

    if (matchedFiles.length === 0) {
      return {
        success: true,
        result: `패턴 "${pattern}"과 일치하는 파일을 찾지 못했습니다.`,
      };
    }

    return {
      success: true,
      result: JSON.stringify(matchedFiles, null, 2),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return {
      success: false,
      error: `파일 검색 실패: ${err.message}`,
    };
  }
}

/**
 * 재귀적으로 파일 검색
 */
async function findFilesRecursively(
  dirPath: string,
  regex: RegExp,
  baseDir: string
): Promise<Array<{ name: string; path: string }>> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const matchedFiles: Array<{ name: string; path: string }> = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // 재귀 호출
      const subFiles = await findFilesRecursively(fullPath, regex, baseDir);
      matchedFiles.push(...subFiles);
    } else if (regex.test(entry.name)) {
      const relativePath = path.relative(baseDir, fullPath);
      matchedFiles.push({
        name: entry.name,
        path: relativePath,
      });
    }
  }

  return matchedFiles;
}

/**
 * Tool 실행 함수 (통합)
 */
export async function executeFileTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'read_file':
      return executeReadFile(args['file_path'] as string);

    case 'write_file':
      return executeWriteFile(args['file_path'] as string, args['content'] as string);

    case 'list_files':
      return executeListFiles(
        args['directory_path'] as string | undefined,
        args['recursive'] as boolean | undefined
      );

    case 'find_files':
      return executeFindFiles(
        args['pattern'] as string,
        args['directory_path'] as string | undefined
      );

    default:
      return {
        success: false,
        error: `알 수 없는 도구: ${toolName}`,
      };
  }
}
