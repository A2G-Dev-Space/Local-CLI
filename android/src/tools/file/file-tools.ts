/**
 * Android File Tools
 *
 * expo-file-system 기반 파일 조작 도구.
 * CLI의 file-tools.ts와 동일한 인터페이스 제공.
 */

import * as FileSystem from 'expo-file-system';
import type { AndroidTool } from '../types';

const DOCUMENT_DIR = FileSystem.documentDirectory || '';
const CACHE_DIR = FileSystem.cacheDirectory || '';

function resolvePath(path: string): string {
  if (path.startsWith('file://') || path.startsWith('/')) return path;
  return DOCUMENT_DIR + path;
}

const file_read: AndroidTool = {
  name: 'file_read',
  description: 'Read the contents of a file from device storage.',
  category: 'file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path (relative to app documents directory or absolute)' },
      encoding: { type: 'string', description: 'Encoding (utf8 or base64)', default: 'utf8' },
    },
    required: ['path'],
  },
  execute: async (args) => {
    try {
      const fullPath = resolvePath(String(args.path));
      const encoding = args.encoding === 'base64'
        ? FileSystem.EncodingType.Base64
        : FileSystem.EncodingType.UTF8;
      const content = await FileSystem.readAsStringAsync(fullPath, { encoding });
      return { success: true, output: content };
    } catch (error) {
      return { success: false, output: '', error: `Failed to read file: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const file_write: AndroidTool = {
  name: 'file_write',
  description: 'Write content to a file on device storage.',
  category: 'file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write to' },
      content: { type: 'string', description: 'Content to write' },
      encoding: { type: 'string', description: 'Encoding (utf8 or base64)', default: 'utf8' },
    },
    required: ['path', 'content'],
  },
  execute: async (args) => {
    try {
      const fullPath = resolvePath(String(args.path));
      const encoding = args.encoding === 'base64'
        ? FileSystem.EncodingType.Base64
        : FileSystem.EncodingType.UTF8;
      await FileSystem.writeAsStringAsync(fullPath, String(args.content), { encoding });
      return { success: true, output: `Written to: ${args.path}` };
    } catch (error) {
      return { success: false, output: '', error: `Failed to write file: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const file_list: AndroidTool = {
  name: 'file_list',
  description: 'List files and directories in the specified path.',
  category: 'file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to list (defaults to documents root)', default: '' },
    },
  },
  execute: async (args) => {
    try {
      const fullPath = resolvePath(String(args.path || ''));
      const items = await FileSystem.readDirectoryAsync(fullPath);
      const detailed: string[] = [];
      for (const item of items) {
        try {
          const info = await FileSystem.getInfoAsync(fullPath + item);
          const type = info.isDirectory ? 'DIR' : 'FILE';
          const size = info.isDirectory ? '' : ` (${info.size || 0} bytes)`;
          detailed.push(`[${type}] ${item}${size}`);
        } catch {
          detailed.push(`[???] ${item}`);
        }
      }
      return { success: true, output: detailed.join('\n') || '(empty directory)' };
    } catch (error) {
      return { success: false, output: '', error: `Failed to list directory: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const file_delete: AndroidTool = {
  name: 'file_delete',
  description: 'Delete a file or directory from device storage.',
  category: 'file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File or directory path to delete' },
    },
    required: ['path'],
  },
  execute: async (args) => {
    try {
      const fullPath = resolvePath(String(args.path));
      await FileSystem.deleteAsync(fullPath, { idempotent: true });
      return { success: true, output: `Deleted: ${args.path}` };
    } catch (error) {
      return { success: false, output: '', error: `Failed to delete: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const file_info: AndroidTool = {
  name: 'file_info',
  description: 'Get information about a file (size, type, modification time).',
  category: 'file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to inspect' },
    },
    required: ['path'],
  },
  execute: async (args) => {
    try {
      const fullPath = resolvePath(String(args.path));
      const info = await FileSystem.getInfoAsync(fullPath);
      if (!info.exists) {
        return { success: false, output: '', error: `File not found: ${args.path}` };
      }
      const details = {
        exists: info.exists,
        isDirectory: info.isDirectory,
        size: info.size,
        modificationTime: info.modificationTime,
        uri: info.uri,
      };
      return { success: true, output: JSON.stringify(details, null, 2) };
    } catch (error) {
      return { success: false, output: '', error: `Failed to get info: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const file_mkdir: AndroidTool = {
  name: 'file_mkdir',
  description: 'Create a directory (and intermediate directories).',
  category: 'file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to create' },
    },
    required: ['path'],
  },
  execute: async (args) => {
    try {
      const fullPath = resolvePath(String(args.path));
      await FileSystem.makeDirectoryAsync(fullPath, { intermediates: true });
      return { success: true, output: `Created directory: ${args.path}` };
    } catch (error) {
      return { success: false, output: '', error: `Failed to create directory: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const file_copy: AndroidTool = {
  name: 'file_copy',
  description: 'Copy a file from source to destination.',
  category: 'file',
  parameters: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Source file path' },
      to: { type: 'string', description: 'Destination file path' },
    },
    required: ['from', 'to'],
  },
  execute: async (args) => {
    try {
      const fromPath = resolvePath(String(args.from));
      const toPath = resolvePath(String(args.to));
      await FileSystem.copyAsync({ from: fromPath, to: toPath });
      return { success: true, output: `Copied: ${args.from} -> ${args.to}` };
    } catch (error) {
      return { success: false, output: '', error: `Failed to copy: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const file_move: AndroidTool = {
  name: 'file_move',
  description: 'Move or rename a file.',
  category: 'file',
  parameters: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Source file path' },
      to: { type: 'string', description: 'Destination file path' },
    },
    required: ['from', 'to'],
  },
  execute: async (args) => {
    try {
      const fromPath = resolvePath(String(args.from));
      const toPath = resolvePath(String(args.to));
      await FileSystem.moveAsync({ from: fromPath, to: toPath });
      return { success: true, output: `Moved: ${args.from} -> ${args.to}` };
    } catch (error) {
      return { success: false, output: '', error: `Failed to move: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const file_download: AndroidTool = {
  name: 'file_download',
  description: 'Download a file from a URL to device storage.',
  category: 'file',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to download from' },
      path: { type: 'string', description: 'Destination file path' },
    },
    required: ['url', 'path'],
  },
  execute: async (args) => {
    try {
      const fullPath = resolvePath(String(args.path));
      const result = await FileSystem.downloadAsync(String(args.url), fullPath);
      return {
        success: true,
        output: `Downloaded to: ${args.path} (status: ${result.status})`,
        data: { status: result.status, uri: result.uri },
      };
    } catch (error) {
      return { success: false, output: '', error: `Failed to download: ${error instanceof Error ? error.message : error}` };
    }
  },
};

export const fileTools: AndroidTool[] = [
  file_read,
  file_write,
  file_list,
  file_delete,
  file_info,
  file_mkdir,
  file_copy,
  file_move,
  file_download,
];
